"use client";

// Inline, in-flow one-liner shown with a success state (register created /
// funding done). Not a popup — it scrolls away with the content. Links to the
// existing report-bug flow with the page URL + a context label prefilled.
export default function InlineFeedbackNudge({ context, lead }: { context: string; lead?: string }) {
  const from = typeof window !== "undefined" ? window.location.href : "";
  const href = `/report-bug?from=${encodeURIComponent(from)}&context=${encodeURIComponent(context)}`;

  return (
    <div style={{
      margin: "0 0 14px", padding: "10px 14px",
      background: "#f8faf9", border: "1px solid #e0ede8", borderRadius: 12,
      fontFamily: "Nunito, sans-serif", fontSize: 13, lineHeight: 1.5, color: "#374151",
    }}>
      {lead && <span style={{ fontWeight: 700, color: "#1a5c45" }}>{lead} </span>}
      How did that go?{" "}
      <a href={href} style={{ color: "#1a7a5e", fontWeight: 800, textDecoration: "underline" }}>
        Anything confusing?
      </a>
    </div>
  );
}
