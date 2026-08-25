"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/Avatar";
import {
  Compass, ClipboardList, Users,
  CircleUser, Gift, PackageCheck,
} from "lucide-react";

const ACTIVE_COLOR   = "#1a7a5e";
const INACTIVE_COLOR = "#9ca3af";
const STROKE = 1.75;
const SIZE   = 20;

// Tabs shown to pregnant / postpartum users (Circles access)
const MOM_TABS = [
  { path: "/",            label: "Home",       Icon: Compass,       section: "discover"  },
  { path: "/registers",   label: "Registers",  Icon: ClipboardList, section: "registers" },
  { path: "/bundles",     label: "Bundles",    Icon: Gift,          section: "bundles"   },
  { path: "/circles",     label: "Circles",    Icon: Users,         section: "circles"   },
  { path: "/pickups",     label: "Pickups",    Icon: PackageCheck,  section: "pickups"   },
  { path: "/profile",     label: "Profile",    Icon: CircleUser,    section: "profile"   },
];

// Tabs shown to donor users (no Circles, no Favourites)
const DONOR_TABS = [
  { path: "/",           label: "Home",      Icon: Compass,       section: "discover"  },
  { path: "/registers",  label: "Registers", Icon: ClipboardList, section: "registers" },
  { path: "/bundles",    label: "Bundles",   Icon: Gift,          section: "bundles"   },
  { path: "/pickups",    label: "Pickups",   Icon: PackageCheck,  section: "pickups"   },
  { path: "/profile",    label: "Profile",   Icon: CircleUser,    section: "profile"   },
];

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  const isPill = count > 9;
  return (
    <span style={{
      position: "absolute", top: -4, right: -4,
      minWidth: 16, height: 16,
      borderRadius: isPill ? 8 : "50%",
      background: "#c0392b", color: "white",
      fontSize: 9, fontWeight: 800, fontFamily: "Nunito, sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: isPill ? "0 4px" : 0,
      zIndex: 1, border: "1.5px solid white", lineHeight: 1,
      boxSizing: "content-box",
    }}>
      {label}
    </span>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user } = useAuth();

  const [navCounts, setNavCounts] = useState<Record<string, number>>({});

  const fetchNavCounts = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/notifications/nav-counts");
      if (res.ok) {
        const data = await res.json();
        setNavCounts(data);
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNavCounts();
    const interval = setInterval(fetchNavCounts, 30000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchNavCounts();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user, fetchNavCounts]);

  const isDonor = user?.journeyType === "donor";
  const TABS    = isDonor ? DONOR_TABS : MOM_TABS;

  const handleTabClick = (path: string, section: string) => {
    const count = navCounts[section] ?? 0;
    if (count > 0) {
      fetch("/api/notifications/mark-read-by-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section }),
      }).catch(() => {});
      setNavCounts((c) => ({ ...c, [section]: 0 }));
    }
    router.push(path);
  };

  return (
    <nav className="bnav" aria-label="Main navigation">
      {TABS.map(({ path, label, Icon, section }) => {
        const isActive  = path === "/" ? pathname === "/" :
          path === "/pickups" ? (pathname === "/pickups" || pathname.startsWith("/pickups/") || pathname.startsWith("/coordination/")) :
          pathname === path || pathname.startsWith(path + "/");
        const isProfile = path === "/profile";
        const color     = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
        const badgeCount = navCounts[section] ?? 0;

        return (
          <button
            key={path}
            className={`bnav-item${isActive ? " active" : ""}`}
            onClick={() => handleTabClick(path, section)}
            aria-current={isActive ? "page" : undefined}
          >
            <div className="bnav-icon" style={{ position: "relative" }}>
              {isProfile && user ? (
                <div style={{
                  width: SIZE, height: SIZE, borderRadius: "50%", overflow: "hidden",
                  border: `1.5px solid ${isActive ? ACTIVE_COLOR : "transparent"}`,
                  flexShrink: 0, transition: "border-color 0.2s",
                }}>
                  <Avatar src={user.avatar} name={user.name} size={SIZE} />
                </div>
              ) : (
                <Icon size={SIZE} strokeWidth={STROKE} color={color} style={{ transition: "color 0.2s" }} />
              )}
              <NavBadge count={badgeCount} />
            </div>
            <span className="bnav-label" style={{ color }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
