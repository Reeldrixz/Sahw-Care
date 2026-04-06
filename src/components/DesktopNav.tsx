"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function DesktopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const links = [
    { label: "Discover", href: "/" },
    { label: "Registers", href: "/registers" },
    { label: "Browse", href: "/browse" },
    { label: "Messages", href: "/chat" },
    { label: "Favourites", href: "/favourites" },
  ];

  return (
    <nav className="dnav">
      <div className="dnav-inner">
        <div className="dnav-logo" onClick={() => router.push("/")}>
          🤲 Kradel
        </div>
        <div className="dnav-links">
          {links.map((l) => (
            <button
              key={l.href}
              className={`dnav-link ${pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href)) ? "active" : ""}`}
              onClick={() => router.push(l.href)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="dnav-right">
          {user ? (
            <>
              <span className="dnav-user" onClick={() => router.push("/profile")}>
                👤 {user.name.split(" ")[0]}
              </span>
              {user.role === "ADMIN" && (
                <button className="dnav-btn-outline" onClick={() => router.push("/admin")}>
                  Admin
                </button>
              )}
              <button className="dnav-btn-outline" onClick={async () => { await logout(); router.push("/"); }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button className="dnav-btn-outline" onClick={() => router.push("/auth")}>
                Sign in
              </button>
              <button className="dnav-btn-solid" onClick={() => router.push("/auth?mode=signup")}>
                Join free
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
