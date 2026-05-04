import fs from "fs";
import path from "path";
import matter from "gray-matter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Hash } from "lucide-react";
import PrivacyToc from "./PrivacyToc";

export const metadata = {
  title: "Privacy Policy | Kradəl Care",
  description: "How Kradəl Care collects, uses, and protects your information.",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\./g, "-")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractH2Headings(content: string): { text: string; id: string }[] {
  const matches = content.match(/^## .+$/gm) ?? [];
  return matches.map((h) => {
    const text = h.replace(/^## /, "");
    return { text, id: slugify(text) };
  });
}

function fmtDate(val: unknown): string {
  if (val instanceof Date) {
    return val.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  }
  return String(val ?? "");
}

const BODY: React.CSSProperties = {
  fontFamily: "Nunito, sans-serif",
  fontSize: 16,
  lineHeight: 1.7,
  color: "#555555",
  marginBottom: 16,
};

function headingId(children: React.ReactNode): string {
  const text =
    typeof children === "string"
      ? children
      : Array.isArray(children)
      ? (children as React.ReactNode[])
          .map((c) => (typeof c === "string" ? c : ""))
          .join("")
      : "";
  return slugify(text);
}

const components: Components = {
  h1: ({ children }) => (
    <h1
      style={{
        fontFamily: "Lora, serif",
        fontSize: 32,
        fontWeight: 700,
        color: "var(--ink)",
        marginBottom: 8,
        lineHeight: 1.3,
      }}
    >
      {children}
    </h1>
  ),

  h2: ({ children }) => {
    const id = headingId(children);
    return (
      <h2
        id={id}
        className="privacy-h2"
        style={{
          fontFamily: "Lora, serif",
          fontSize: 24,
          fontWeight: 700,
          color: "var(--ink)",
          marginTop: 48,
          marginBottom: 16,
          lineHeight: 1.3,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>{children}</span>
        <a
          href={`#${id}`}
          className="privacy-anchor"
          aria-label={`Link to this section`}
          style={{ color: "#999999", textDecoration: "none", display: "inline-flex", alignItems: "center" }}
        >
          <Hash size={14} strokeWidth={1.75} />
        </a>
      </h2>
    );
  },

  h3: ({ children }) => (
    <h3
      style={{
        fontFamily: "Lora, serif",
        fontSize: 18,
        fontWeight: 700,
        color: "var(--ink)",
        marginTop: 28,
        marginBottom: 10,
        lineHeight: 1.4,
      }}
    >
      {children}
    </h3>
  ),

  p: ({ children }) => <p style={BODY}>{children}</p>,

  a: ({ href, children }) => (
    <a href={href ?? "#"} style={{ color: "#1a7a5e", textDecoration: "underline" }}>
      {children}
    </a>
  ),

  ul: ({ children }) => (
    <ul style={{ ...BODY, paddingLeft: 24, marginBottom: 16 }}>{children}</ul>
  ),

  ol: ({ children }) => (
    <ol style={{ ...BODY, paddingLeft: 24, marginBottom: 16 }}>{children}</ol>
  ),

  li: ({ children }) => (
    <li style={{ marginBottom: 6, lineHeight: 1.7 }}>{children}</li>
  ),

  strong: ({ children }) => (
    <strong style={{ fontWeight: 700, color: "var(--ink)" }}>{children}</strong>
  ),

  em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,

  hr: () => (
    <hr style={{ border: "none", borderTop: "1px solid #e0e0e0", margin: "32px 0" }} />
  ),

  blockquote: ({ children }) => (
    <blockquote
      style={{
        borderLeft: "3px solid #1a7a5e",
        paddingLeft: 16,
        marginLeft: 0,
        marginBottom: 16,
        color: "#555555",
        fontStyle: "italic",
      }}
    >
      {children}
    </blockquote>
  ),

  code: ({ children }) => (
    <code
      style={{
        background: "#f5f5f5",
        padding: "2px 6px",
        borderRadius: 4,
        fontSize: 14,
        fontFamily: "monospace",
      }}
    >
      {children}
    </code>
  ),

  pre: ({ children }) => (
    <pre
      style={{
        background: "#f5f5f5",
        padding: "14px 16px",
        borderRadius: 8,
        overflowX: "auto",
        marginBottom: 16,
        fontSize: 14,
        fontFamily: "monospace",
      }}
    >
      {children}
    </pre>
  ),

  table: ({ children }) => (
    <div style={{ overflowX: "auto", marginBottom: 24 }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14,
          fontFamily: "Nunito, sans-serif",
        }}
      >
        {children}
      </table>
    </div>
  ),

  thead: ({ children }) => (
    <thead style={{ background: "#e8f5f1" }}>{children}</thead>
  ),

  th: ({ children }) => (
    <th
      style={{
        padding: "10px 14px",
        textAlign: "left",
        fontWeight: 700,
        color: "#1a7a5e",
        borderBottom: "2px solid #c0dfd5",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  ),

  td: ({ children }) => (
    <td
      style={{
        padding: "10px 14px",
        color: "#555555",
        borderBottom: "1px solid #e0e0e0",
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  ),

  tr: ({ children }) => <tr>{children}</tr>,
};

export default function PrivacyPage() {
  const filePath = path.join(process.cwd(), "src/content/privacy-policy.md");
  const raw = fs.readFileSync(filePath, "utf8");
  const { data: fm, content } = matter(raw);
  const headings = extractH2Headings(content);

  return (
    <div style={{ background: "white", minHeight: "100vh" }}>
      <style>{`
        html { scroll-behavior: smooth; scroll-padding-top: 80px; }

        /* anchor hash icon — hidden until h2 hovered */
        .privacy-anchor { opacity: 0; transition: opacity 0.15s; }
        .privacy-h2:hover .privacy-anchor { opacity: 1; }

        /* show/hide TOC variants by breakpoint */
        .privacy-toc-mobile  { display: block; }
        .privacy-toc-desktop { display: none;  }
        @media (min-width: 1024px) {
          .privacy-toc-mobile  { display: none !important; }
          .privacy-toc-desktop { display: block !important; }
        }

        @media print {
          .privacy-toc-mobile,
          .privacy-toc-desktop { display: none !important; }
          nav, .bottom-nav     { display: none !important; }
          body  { color: black !important; background: white !important; }
          h1, h2, h3 { color: black !important; page-break-after: avoid; }
          table { font-size: 12px; }
          a     { color: black !important; text-decoration: none !important; }
          @page { margin: 2cm; }
        }
      `}</style>

      {/* Mobile sticky TOC */}
      <div
        className="privacy-toc-mobile"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "white",
          borderBottom: "1px solid #f0f0f0",
          padding: "10px 16px",
        }}
      >
        <PrivacyToc headings={headings} mode="mobile" />
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ display: "flex", gap: 56, alignItems: "flex-start" }}>

          {/* Main content */}
          <main style={{ flex: 1, minWidth: 0 }}>
            {/* Metadata strip */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px 24px",
                padding: "12px 16px",
                background: "#f9fafb",
                border: "1px solid #e8e8e8",
                borderRadius: 8,
                marginBottom: 32,
                fontFamily: "Nunito, sans-serif",
                fontSize: 13,
                color: "#777777",
              }}
            >
              <span>
                <strong style={{ color: "#444444" }}>Effective date:</strong>{" "}
                {fmtDate(fm.effectiveDate)}
              </span>
              <span>
                <strong style={{ color: "#444444" }}>Last updated:</strong>{" "}
                {fmtDate(fm.lastUpdated)}
              </span>
              <span>
                <strong style={{ color: "#444444" }}>Version:</strong>{" "}
                {String(fm.version ?? "")}
              </span>
            </div>

            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {content}
            </ReactMarkdown>
          </main>

          {/* Desktop sidebar TOC */}
          <aside
            className="privacy-toc-desktop"
            style={{ width: 240, flexShrink: 0 }}
          >
            <PrivacyToc headings={headings} mode="desktop" />
          </aside>
        </div>
      </div>
    </div>
  );
}
