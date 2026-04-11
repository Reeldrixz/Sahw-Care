"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/Avatar";
import { Compass, ClipboardList, Users, Search, Heart, MessageCircle } from "lucide-react";

const ALL_NAV_LINKS = [
  { label: "Discover",   href: "/",           Icon: Compass,       donorOnly: false, momOnly: false  },
  { label: "Registers",  href: "/registers",  Icon: ClipboardList, donorOnly: false, momOnly: true   },
  { label: "Circles",    href: "/circles",    Icon: Users,         donorOnly: false, momOnly: true   },
  { label: "Browse",     href: "/browse",     Icon: Search,        donorOnly: false, momOnly: false  },
  { label: "Messages",   href: "/chat",       Icon: MessageCircle, donorOnly: false, momOnly: false  },
  { label: "Favourites", href: "/favourites", Icon: Heart,         donorOnly: false, momOnly: false  },
];

export default function DesktopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isDonor = user?.journeyType === "donor";
  const NAV_LINKS = ALL_NAV_LINKS.filter(({ momOnly }) => !(isDonor && momOnly));

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
