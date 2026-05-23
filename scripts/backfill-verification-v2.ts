/**
 * One-time backfill: Verification System v2.0
 *
 * 1. Recipients with docStatus=VERIFIED or verificationLevel>=2
 *    → identityVerified=true, identityVerifiedAt=old verifiedAt, layer3Status=NONE
 * 2. All other recipients
 *    → identityVerified=false, layer3Status=NONE
 * 3. All shippingHold=false, riskFlagged=false
 * 4. Delete old Cloudinary docs from kradel/documents/ and null documentUrl
 *
 * Run: npx tsx scripts/backfill-verification-v2.ts
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";

// ── Env bootstrap (reads .env.local then .env, no dotenv dep needed) ─────────
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
}

/**
 * Extracts the Cloudinary public_id from a documentUrl.
 * Handles URLs like:
 *   https://res.cloudinary.com/.../upload/v1234/kradel/documents/userId/abc.jpg
 *   https://res.cloudinary.com/.../upload/c_limit,.../v1234/kradel/documents/userId/abc.jpg
 */
function extractPublicId(url: string): string | null {
  const m = url.match(/(kradel\/documents\/[^?.#]+)/);
  if (!m) return null;
  // Strip any trailing extension that snuck in (shouldn't happen but safety)
  return m[1].replace(/\.[^./]+$/, "");
}

async function main() {
  loadEnv();

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const prisma = new PrismaClient();

  try {
    // ── 1. Fetch all recipients ────────────────────────────────────────────
    const recipients = await prisma.user.findMany({
      where: { role: "RECIPIENT" },
      select: {
        id:                true,
        docStatus:         true,
        verificationLevel: true,
        verifiedAt:        true,
        documentUrl:       true,
      },
    });

    const total        = recipients.length;
    const toVerify     = recipients.filter(
      u => u.docStatus === "VERIFIED" || (u.verificationLevel ?? 0) >= 2
    );
    const toUnverify   = recipients.filter(
      u => u.docStatus !== "VERIFIED" && (u.verificationLevel ?? 0) < 2
    );
    const withDocs     = recipients.filter(u => !!u.documentUrl);

    console.log(`\nTotal recipients: ${total}`);
    console.log(`  → identityVerified=true  : ${toVerify.length}`);
    console.log(`  → identityVerified=false : ${toUnverify.length}`);
    console.log(`  → have documentUrl       : ${withDocs.length}\n`);

    // ── 2. Backfill verified mothers ────────────────────────────────────────
    let verifiedCount = 0;
    for (const u of toVerify) {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          identityVerified:   true,
          identityVerifiedAt: u.verifiedAt ?? undefined,
          layer3Status:       "NONE",
          shippingHold:       false,
          riskFlagged:        false,
        },
      });
      verifiedCount++;
    }
    console.log(`✓ Set identityVerified=true for ${verifiedCount} recipients`);

    // ── 3. Backfill unverified mothers (batch) ──────────────────────────────
    if (toUnverify.length > 0) {
      const { count } = await prisma.user.updateMany({
        where: {
          role:              "RECIPIENT",
          docStatus:         { not: "VERIFIED" },
          verificationLevel: { lt: 2 },
        },
        data: {
          identityVerified: false,
          layer3Status:     "NONE",
          shippingHold:     false,
          riskFlagged:      false,
        },
      });
      console.log(`✓ Set identityVerified=false, layer3Status=NONE for ${count} recipients`);
    }

    // ── 4. Delete Cloudinary docs + null documentUrl ────────────────────────
    let deletedCount = 0;
    let skippedCount = 0;

    for (const u of withDocs) {
      const publicId = extractPublicId(u.documentUrl!);

      if (!publicId) {
        console.warn(`  ⚠ Could not extract publicId from: ${u.documentUrl} (user ${u.id}) — skipping`);
        skippedCount++;
        continue;
      }

      try {
        const result = await cloudinary.uploader.destroy(publicId, {
          resource_type: "image",
          invalidate:    true,
        });

        if (result.result === "ok" || result.result === "not found") {
          await prisma.user.update({
            where: { id: u.id },
            data:  { documentUrl: null },
          });
          deletedCount++;
        } else {
          console.warn(`  ⚠ Cloudinary destroy returned '${result.result}' for ${publicId} — nulling URL anyway`);
          await prisma.user.update({ where: { id: u.id }, data: { documentUrl: null } });
          deletedCount++;
        }
      } catch (err) {
        console.error(`  ✗ Failed for user ${u.id} (${publicId}):`, err);
        skippedCount++;
      }
    }

    console.log(`✓ Deleted ${deletedCount} Cloudinary documents (${skippedCount} skipped/failed)`);

    // ── Summary ─────────────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════");
    console.log("  BACKFILL COMPLETE");
    console.log("═══════════════════════════════════════");
    console.log(`  Recipients → identityVerified=true : ${verifiedCount}`);
    console.log(`  Old docs deleted from Cloudinary   : ${deletedCount}`);
    console.log("═══════════════════════════════════════\n");

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
