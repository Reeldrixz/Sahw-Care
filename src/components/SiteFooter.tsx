"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export default function SiteFooter() {
  const pathname = usePathname();
  // Don't render inside the admin panel to avoid cluttering it
  if (pathname.startsWith("/admin")) return null;

  return (
    <footer className="site-footer" style={{ borderTop: "1px solid #ede8df", background: "#faf8f3", paddingTop: "14px", paddingLeft: "20px", paddingRight: "20px", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>
        <Link href="/privacy" style={{ fontSize: 12, color: "#9ca3af", fontFamily: "Nunito, sans-serif", textDecoration: "none" }}>
          Privacy
        </Link>
        <Link href="/report-bug" style={{ fontSize: 12, color: "#9ca3af", fontFamily: "Nunito, sans-serif", textDecoration: "none" }}>
          🐛 Report a bug
        </Link>
        <a href="mailto:support@kradel.com" style={{ fontSize: 12, color: "#9ca3af", fontFamily: "Nunito, sans-serif", textDecoration: "none" }}>
          Contact
        </a>
      </div>
    </footer>
  );
}
