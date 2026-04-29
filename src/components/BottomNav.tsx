"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/Avatar";
import {
  Compass, ClipboardList, Users,
  CircleUser, Heart, MessageCircle, Gift,
} from "lucide-react";

const ACTIVE_COLOR   = "#1a7a5e";
const INACTIVE_COLOR = "#9ca3af";
const STROKE = 1.75;
const SIZE   = 20;

// Tabs shown to pregnant / postpartum users (Circles access)
const MOM_TABS = [
  { path: "/",            label: "Discover",   Icon: Compass       },
  { path: "/registers",   label: "Registers",  Icon: ClipboardList },
  { path: "/bundles",     label: "Bundles",    Icon: Gift          },
  { path: "/circles",     label: "Circles",    Icon: Users         },
  { path: "/favourites",  label: "Favourites", Icon: Heart         },
  { path: "/profile",     label: "Profile",    Icon: CircleUser    },
];

// Tabs shown to donor users (no Circles)
const DONOR_TABS = [
  { path: "/",            label: "Discover",   Icon: Compass       },
  { path: "/registers",   label: "Registers",  Icon: ClipboardList },
  { path: "/bundles",     label: "Bundles",    Icon: Gift          },
  { path: "/favourites",  label: "Favourites", Icon: Heart         },
  { path: "/profile",     label: "Profile",    Icon: CircleUser    },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user } = useAuth();

  const isDonor = user?.journeyType === "donor";
  const TABS    = isDonor ? DONOR_TABS : MOM_TABS;

  return (
    <nav className="bnav" aria-label="Main navigation">
      {TABS.map(({ path, label, Icon }) => {
        const isActive  = path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");
        const isProfile = path === "/profile";
        const color     = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;

        return (
          <button
            key={path}
            className={`bnav-item${isActive ? " active" : ""}`}
            onClick={() => router.push(path)}
            aria-current={isActive ? "page" : undefined}
          >
            <div className="bnav-icon">
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
            </div>
            <span className="bnav-label" style={{ color }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
