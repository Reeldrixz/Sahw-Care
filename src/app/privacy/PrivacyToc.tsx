"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface Heading {
  text: string;
  id: string;
}

interface Props {
  headings: Heading[];
  mode: "mobile" | "desktop";
}

export default function PrivacyToc({ headings, mode }: Props) {
  const [open, setOpen] = useState(false);

  if (mode === "desktop") {
    return (
      <div style={{ position: "sticky", top: 80, maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
        <div style={{ fontFamily: "Lora, serif", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Contents
        </div>
        <nav>
          {headings.map(({ text, id }) => (
            <a
              key={id}
              href={`#${id}`}
              style={{
                display: "block",
                fontFamily: "Nunito, sans-serif",
                fontSize: 12,
                color: "#555555",
                textDecoration: "none",
                padding: "5px 0 5px 10px",
                lineHeight: 1.5,
                borderLeft: "2px solid #e0e0e0",
                marginBottom: 2,
                transition: "color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color = "#1a7a5e";
                (e.currentTarget as HTMLAnchorElement).style.borderLeftColor = "#1a7a5e";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color = "#555555";
                (e.currentTarget as HTMLAnchorElement).style.borderLeftColor = "#e0e0e0";
              }}
            >
              {text}
            </a>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "#f5f5f5",
          border: "1px solid #e0e0e0",
          borderRadius: 8,
          padding: "10px 14px",
          cursor: "pointer",
          fontFamily: "Nunito, sans-serif",
          fontSize: 14,
          fontWeight: 700,
          color: "var(--ink)",
        }}
        aria-expanded={open}
      >
        Jump to section
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "white",
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
            zIndex: 200,
            maxHeight: 320,
            overflowY: "auto",
            padding: "6px 0",
          }}
        >
          {headings.map(({ text, id }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => setOpen(false)}
              style={{
                display: "block",
                fontFamily: "Nunito, sans-serif",
                fontSize: 13,
                color: "#555555",
                textDecoration: "none",
                padding: "8px 16px",
                transition: "background 0.1s, color 0.1s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "#e8f5f1";
                (e.currentTarget as HTMLAnchorElement).style.color = "#1a7a5e";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                (e.currentTarget as HTMLAnchorElement).style.color = "#555555";
              }}
            >
              {text}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
