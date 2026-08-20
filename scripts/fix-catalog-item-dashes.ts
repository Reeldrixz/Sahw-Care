/**
 * One-off: de-dash catalog item names — PUNCTUATION ONLY.
 *
 * Transforms prod's OWN name in place (replaces the " — " separator with a
 * comma, or ": " for the bath set). Quantities, sizes, prices, vendor,
 * descriptions, and verification state are NEVER touched. This deliberately
 * does NOT pull names from seed.ts, whose quantities have drifted from the
 * admin-curated prod catalog (e.g. prod 96ct vs seed 40-count) — reconciling
 * that is a separate product decision, out of scope here.
 *
 * Two name-only, idempotent passes:
 *   1) ItemCatalog.name       (live picker + all future adds)
 *   2) RegisterItem.name       (existing snapshots) — OPT-IN, and only for a
 *      snapshot that is verbatim its catalog item's name (dash aside). A mother
 *      who changed the wording or quantity keeps it.
 *
 * Dry-run by default. Run against the target DB with its DATABASE_URL:
 *   DATABASE_URL="<prod-url>" npx tsx scripts/fix-catalog-item-dashes.ts                          # preview + counts
 *   DATABASE_URL="<prod-url>" npx tsx scripts/fix-catalog-item-dashes.ts --apply                  # catalog pass only
 *   DATABASE_URL="<prod-url>" npx tsx scripts/fix-catalog-item-dashes.ts --apply --fix-register-items
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// SKUs whose names carried a dash separator, and the separator to swap in.
// All use ", " except the bath SET, which introduces a contents list (": ").
const SEP_OVERRIDE: Record<string, string> = { H03: ": " };
const SKUS = [
  "F01", "F02", "F03", "F04", "F07",
  "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09",
  "M01", "M03", "M06", "M09", "H03",
];
const SKU_SET = new Set(SKUS);
const sepFor = (sku: string) => SEP_OVERRIDE[sku] ?? ", ";

// Replace ONLY the first dash separator; leave the rest (quantities!) intact.
// Returns the de-dashed string, or the input unchanged if it has no separator.
function deDash(name: string, sku: string): string {
  const sep = sepFor(sku);
  if (name.includes(" — ")) return name.replace(" — ", sep);
  if (name.includes(" – ")) return name.replace(" – ", sep);
  return name;
}

async function catalogPass(apply: boolean) {
  console.log("── Pass 1: ItemCatalog.name (punctuation only) ──────────");
  let updated = 0, already = 0, missing = 0;
  for (const sku of SKUS) {
    const row = await prisma.itemCatalog.findUnique({ where: { sku }, select: { name: true } });
    if (!row) { console.log(`  MISSING  ${sku}`); missing++; continue; }
    const fixed = deDash(row.name, sku);
    if (fixed === row.name) { already++; continue; }
    console.log(`  ${apply ? "UPDATED" : "WOULD  "}  ${sku}  "${row.name}"  ->  "${fixed}"`);
    if (apply) await prisma.itemCatalog.update({ where: { sku }, data: { name: fixed } });
    updated++;
  }
  console.log(`  ${apply ? "updated" : "would update"}: ${updated} · already clean: ${already} · missing: ${missing}\n`);
}

async function registerItemPass(apply: boolean) {
  console.log("── Pass 2: RegisterItem.name (catalog-linked, dashed) ───");
  const rows = await prisma.registerItem.findMany({
    where: {
      catalogItemId: { not: null },
      OR: [{ name: { contains: "—" } }, { name: { contains: "–" } }],
    },
    select: { id: true, name: true, registerId: true, catalogItem: { select: { name: true, sku: true } } },
  });

  // In scope: linked to one of our renamed SKUs.
  const scoped = rows.filter((r) => r.catalogItem && SKU_SET.has(r.catalogItem.sku));
  const outOfScope = rows.length - scoped.length;

  // Uncustomized snapshot iff it matches its catalog item's name once BOTH are
  // de-dashed — robust whether or not Pass 1 has already run on the catalog.
  const eligible = scoped.filter((r) => {
    const sku = r.catalogItem!.sku;
    return deDash(r.name, sku) === deDash(r.catalogItem!.name, sku) && deDash(r.name, sku) !== r.name;
  });
  const customized = scoped.filter((r) => !eligible.includes(r));

  console.log(`  catalog-linked items with a dash: ${rows.length} (out-of-scope SKUs: ${outOfScope})`);
  console.log(`    eligible (verbatim catalog name, will fix): ${eligible.length}`);
  console.log(`    customized (kept as-is, own wording/qty):   ${customized.length}`);
  for (const r of customized.slice(0, 50)) console.log(`     KEEP  register ${r.registerId}  sku ${r.catalogItem!.sku}  "${r.name}"`);
  if (customized.length > 50) console.log(`     …and ${customized.length - 50} more`);

  if (!apply) { console.log(`  (dry run — pass --apply --fix-register-items to write these ${eligible.length})\n`); return; }
  for (const r of eligible) {
    const fixed = deDash(r.name, r.catalogItem!.sku);
    console.log(`  UPDATED  register ${r.registerId}  "${r.name}"  ->  "${fixed}"`);
    await prisma.registerItem.update({ where: { id: r.id }, data: { name: fixed } });
  }
  console.log(`  updated: ${eligible.length}\n`);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const fixRegisterItems = process.argv.includes("--fix-register-items");
  console.log(apply ? "APPLY mode\n" : "DRY RUN — no writes\n");

  // Pass 2 reads catalog names, so classify/apply it before Pass 1 rewrites them.
  await registerItemPass(apply && fixRegisterItems);
  await catalogPass(apply);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
