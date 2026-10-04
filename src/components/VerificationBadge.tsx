import { BadgeCheck, Handshake } from "lucide-react";
import type { VerificationBadge as Badge } from "@/lib/verificationBadge";

// The badge next to a mother's name on every register surface. Always shows the
// label as well as the colour, so it never relies on colour alone.
const STYLES = {
  PARTNER_REFERRED: { label: "Partner referred", Icon: Handshake,  bg: "#dbeafe", fg: "#1d4ed8", border: "#93c5fd" },
  ID_VERIFIED:      { label: "ID verified",      Icon: BadgeCheck, bg: "#dcfce7", fg: "#166534", border: "#86efac" },
} as const;

export const VERIFICATION_BADGE_LABEL = {
  PARTNER_REFERRED: STYLES.PARTNER_REFERRED.label,
  ID_VERIFIED:      STYLES.ID_VERIFIED.label,
} as const;

export default function VerificationBadge({ badge, size = "sm" }: { badge: Badge; size?: "sm" | "lg" }) {
  if (!badge) return null;
  const s = STYLES[badge];
  const fontSize = size === "lg" ? 15 : 11;
  const icon     = size === "lg" ? 15 : 11;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, verticalAlign: "middle",
        fontSize, fontWeight: 800, lineHeight: 1.2, whiteSpace: "nowrap",
        background: s.bg, color: s.fg, border: `1px solid ${s.border}`,
        borderRadius: 20, padding: size === "lg" ? "4px 12px" : "2px 8px",
        fontFamily: "Nunito, sans-serif",
      }}
    >
      <s.Icon size={icon} strokeWidth={2.5} aria-hidden /> {s.label}
    </span>
  );
}
