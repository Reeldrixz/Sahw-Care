"use client";

// The livestream name choice on an event checkout: an optional "Name to show
// on the stream" field and a pre-ticked checkbox. One component for both
// checkouts — the guest sheet on /r/[id] and the signed-in checkout on
// /registers/[id] — so they are identical. Never prefilled from account data;
// the server keeps only a cleaned first name (lib/donorName).

const label: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 800, color: "var(--ink)", fontFamily: "Nunito, sans-serif", marginBottom: 7 };
const input: React.CSSProperties = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, fontFamily: "inherit", color: "var(--ink)", background: "white", boxSizing: "border-box" };

export default function StreamNameFields({
  name, onName, showName, onShowName, style,
}: {
  name: string;
  onName: (v: string) => void;
  showName: boolean;
  onShowName: (v: boolean) => void;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <label style={label}>Name to show on the stream <span style={{ fontWeight: 600, color: "var(--mid)" }}>(optional)</span></label>
      <input
        value={name}
        onChange={(e) => onName(e.target.value)}
        placeholder="First name"
        maxLength={40}
        autoComplete="off"
        disabled={!showName}
        style={{ ...input, opacity: showName ? 1 : 0.5 }}
      />
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, minHeight: 44, cursor: "pointer", fontSize: 13, color: "var(--ink)", fontFamily: "Nunito, sans-serif" }}>
        <input
          type="checkbox"
          checked={showName}
          onChange={(e) => onShowName(e.target.checked)}
          style={{ width: 20, height: 20, accentColor: "#1a7a5e", flexShrink: 0 }}
        />
        Show my first name on the stream.
      </label>
      <div style={{ fontSize: 11.5, color: "var(--mid)", lineHeight: 1.6, marginTop: 2 }}>
        Only your first name, and only if you fund this item in full yourself.
      </div>
    </div>
  );
}
