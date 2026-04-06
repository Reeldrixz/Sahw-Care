"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/Avatar";

const TABS = [
  { path: "/", label: "Discover", icon: "🧭" },
  { path: "/registers", label: "Registers", icon: "📋" },
  { path: "/browse", label: "Browse", icon: "🔍" },
  { path: "/favourites", label: "Favourites", icon: "🤍", activeIcon: "❤️" },
  { path: "/profile", label: "Profile", icon: "👤" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div className="bnav">
      {TABS.map(({ path, label, icon, activeIcon }) => {
        const isActive = path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");
        const isProfile = path === "/profile";

        return (
          <div
            key={path}
            className={`bnav-item ${isActive ? "active" : ""}`}
            onClick={() => router.push(path)}
          >
            <div className="bnav-icon">
              {isProfile && user ? (
                <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", border: isActive ? "2px solid var(--green)" : "2px solid transparent", flexShrink: 0 }}>
                  <Avatar src={user.avatar} name={user.name} size={24} />
                </div>
              ) : (
                isActive && activeIcon ? activeIcon : icon
              )}
            </div>
            <div className="bnav-label">{label}</div>
          </div>
        );
      })}
    </div>
  );
}
