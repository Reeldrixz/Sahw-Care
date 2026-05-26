import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PERSONA_API = "https://withpersona.com/api/v1/inquiries";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey     = process.env.PERSONA_API_KEY;
  const templateId = process.env.PERSONA_TEMPLATE_ID;
  if (!apiKey || !templateId) {
    console.error("[persona/start] PERSONA_API_KEY or PERSONA_TEMPLATE_ID not configured");
    return NextResponse.json({ error: "Identity verification not configured" }, { status: 500 });
  }

  const user = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { id: true, identityVerified: true, personaInquiryId: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (user.identityVerified) {
    return NextResponse.json({ alreadyVerified: true });
  }

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const returnUrl = `${appUrl}/verify/persona/return`;

  const personaRes = await fetch(PERSONA_API, {
    method:  "POST",
    headers: {
      "Authorization":  `Bearer ${apiKey}`,
      "Persona-Version": "2023-01-05",
      "Content-Type":   "application/json",
      "Key-Inflection": "camel",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          inquiryTemplateId: templateId,
          referenceId:       auth.userId,
        },
      },
      meta: { returnUrl },
    }),
  });

  if (!personaRes.ok) {
    const errText = await personaRes.text();
    console.error("[persona/start] Persona API error:", personaRes.status, errText);
    return NextResponse.json({ error: "Failed to create verification inquiry" }, { status: 502 });
  }

  const data         = await personaRes.json();
  const inquiryId    = data.data?.id as string | undefined;
  const sessionToken = data.data?.attributes?.sessionToken as string | undefined;

  if (!inquiryId) {
    console.error("[persona/start] Unexpected Persona response:", JSON.stringify(data));
    return NextResponse.json({ error: "Invalid response from Persona" }, { status: 502 });
  }

  await prisma.user.update({
    where: { id: auth.userId },
    data:  { personaInquiryId: inquiryId, personaStatus: "pending" },
  });

  const hostedUrl =
    `https://withpersona.com/verify?inquiry-id=${inquiryId}` +
    (sessionToken ? `&session-token=${sessionToken}` : "") +
    `&redirect-uri=${encodeURIComponent(returnUrl)}`;

  return NextResponse.json({ inquiryId, hostedUrl });
}
