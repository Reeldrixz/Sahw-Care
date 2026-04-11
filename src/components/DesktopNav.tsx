"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/Avatar";
import { Compass, ClipboardList, Users, Search, Heart, MessageCircle } from "lucide-react";

const NAV_LINKS = [
  { label: "Discover",   href: "/",           Icon: Compass       },
  { label: "Registers",  href: "/registers",  Icon: ClipboardList },
  { label: "Circles",    href: "/circles",    Icon: Users         },
  { label: "Browse",     href: "/browse",     Icon: Search        },
  { label: "Messages",   href: "/chat",       Icon: MessageCircle },
  { label: "Favourites", href: "/favourites", Icon: Heart         },
];

export default function DesktopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <nav className="dnav">
      <div className="dnav-inner">
        <div className="dnav-logo" onClick={() => router.push("/")}>
          Kradəl
        </div>
        <div className="dnav-links">
          {NAV_LINKS.map(({ label, href, Icon }) => {
            const isActive = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
            return (
              <button
                key={href}
                className={`dnav-link${isActive ? " active" : ""}`}
                onClick={() => router.push(href)}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                {label}
              </button>
            );
          })}
        </div>
        <div className="dnav-right">
          {user ? (
            <>
              <span className="dnav-user" onClick={() => router.push("/profile")} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Avatar src={user.avatar} name={user.name} size={28} />
                {user.name.split(" ")[0]}
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
