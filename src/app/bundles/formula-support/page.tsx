import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import FormulaSupportForm from "./FormulaSupportForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Formula support · Kradel",
  description: "Request help affording the formula your baby already uses.",
};

const CARD = "#ffffff";
const INK = "#1a1a1a";
const MUTED = "#555555";
const GREEN = "#1a7a5e";
const SERIF = "Lora, Georgia, serif";
const SANS = "Nunito, sans-serif";

// RECIPIENT-only intake. /bundles is already behind auth (proxy), so a visitor
// here is logged in; we additionally require the RECIPIENT role and show a calm
// message otherwise. The POST API enforces the same gate as the real boundary.
export default async function FormulaSupportPage() {
  const currentUser = await getCurrentUser().catch(() => null);
  const account = currentUser
    ? await prisma.user.findUnique({
        where:  { id: currentUser.userId },
        select: { role: true },
      })
    : null;
  const isRecipient = account?.role === "RECIPIENT";

  return (
    <main style={{ background: "var(--bg, #faf7f2)", minHeight: "100vh", fontFamily: SANS }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 64px" }}>
        <Link href="/bundles" style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: GREEN, textDecoration: "none" }}>
          ← Back to bundles
        </Link>

        {isRecipient ? (
          <>
            <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: INK, margin: "18px 0 10px" }}>
              Request help with infant formula
            </h1>
            <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, lineHeight: 1.7, margin: "0 0 8px" }}>
              This is for mothers whose babies are already formula-fed and who need help affording it. So your baby
              stays on exactly what they are used to, please tell us the precise formula they currently use. We fulfil
              only the formula your baby already has, never a substitute.
            </p>
            <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, lineHeight: 1.7, margin: "0 0 20px" }}>
              If you are also exploring breastfeeding support, let us know below and we can point you to resources.
            </p>
            <FormulaSupportForm />
          </>
        ) : (
          <div style={{ background: CARD, border: "1px solid #e8e8e8", borderRadius: 14, padding: "28px 24px", marginTop: 20 }}>
            <h1 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: INK, margin: "0 0 10px" }}>
              This is available to verified mother accounts
            </h1>
            <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, lineHeight: 1.7, margin: 0 }}>
              If you were referred to Kradel and need help, please complete your account setup first.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
