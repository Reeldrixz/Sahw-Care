"use client";

type FulfillmentStatus = "PENDING" | "VERIFIED" | "DISPUTED" | "AUTO_CONFIRMED";

interface Props {
  status: FulfillmentStatus;
  small?: boolean;
}

const CONFIG: Record<FulfillmentStatus, { label: string; bg: string; color: string; emoji: string }> = {
  PENDING:        { label: "Awaiting confirmation", bg: "#fff8e6", color: "#b8860b",  emoji: "⏳" },
  VERIFIED:       { label: "Confirmed received",    bg: "#e8f5f1", color: "#1a7a5e",  emoji: "✅" },
  DISPUTED:       { label: "Disputed",              bg: "#fdecea", color: "#c0392b",  emoji: "⚠️" },
  AUTO_CONFIRMED: { label: "Auto-confirmed",        bg: "#f0f4ff", color: "#3b5bdb",  emoji: "🔄" },
};

export default function FulfillmentStatusBadge({ status, small }: Props) {
  const { label, bg, color, emoji } = CONFIG[status] ?? CONFIG.PENDING;
  return (
    <span
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            4,
        padding:        small ? "2px 8px" : "4px 10px",
        borderRadius:   20,
        background:     bg,
        color,
        fontSize:       small ? 10 : 11,
        fontWeight:     700,
        fontFamily:     "Nunito, sans-serif",
        whiteSpace:     "nowrap",
      }}
    >
      <span style={{ fontSize: small ? 10 : 11 }}>{emoji}</span>
      {label}
    </span>
  );
}
