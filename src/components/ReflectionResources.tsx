"use client";

// Persistent, calm support-resources note shown on the Reflections space.
// Ambient (not alarming). Approved copy + verified Canadian resources.

const SANS = "Nunito, sans-serif";

export default function ReflectionResources() {
  const link: React.CSSProperties = { color: "#1a7a5e", fontWeight: 800, textDecoration: "none" };
  return (
    <div
      style={{
        margin: "0 16px 14px",
        background: "#e8f5f1",
        border: "1px solid #c3e6cb",
        borderRadius: 12,
        padding: "12px 16px",
        fontFamily: SANS,
        fontSize: 12.5,
        lineHeight: 1.6,
        color: "#1a5c48",
      }}
    >
      <strong style={{ color: "#134a3a" }}>This is a space to reflect, not a place you have to carry alone.</strong>{" "}
      If things feel heavy, support is always here:{" "}
      <a href="tel:988" style={link}>988</a> (call/text, 24/7) ·{" "}
      <a href="tel:18665312600" style={link}>ConnexOntario</a> 1-866-531-2600 ·{" "}
      <a href="https://postpartum.net" target="_blank" rel="noopener noreferrer" style={link}>Postpartum Support International</a> (postpartum.net).
    </div>
  );
}
