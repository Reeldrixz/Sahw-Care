"use client";

import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { path: "/", label: "Discover", icon: "🧭" },
  { path: "/browse", label: "Browse", icon: "🔍" },
  { path: "/favourites", label: "Favourites", icon: "🤍", activeIcon: "❤️" },
  { path: "/profile", label: "Profile", icon: "👤" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="bnav">
      {TABS.map(({ path, label, icon, activeIcon }) => {
        const isActive = pathname === path;
        return (
          <div
            key={path}
            className={`bnav-item ${isActive ? "active" : ""}`}
            onClick={() => router.push(path)}
          >
            <div className="bnav-icon">
              {isActive && activeIcon ? activeIcon : icon}
            </div>
            <div className="bnav-label">{label}</div>
          </div>
        );
      })}
    </div>
  );
}
