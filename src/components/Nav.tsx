"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface NavProps {
  onDonate?: () => void;
}

export default function Nav({ onDonate }: NavProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <nav className="nav">
      <Link href="/" className="nav-logo" style={{ textDecoration: "none" }}>
        Kradəl
      </Link>

      {user ? (
        <div className="nav-right">
          <Link href="/browse">
            <button className={`nav-tab ${pathname === "/browse" ? "active" : ""}`}>
              Browse
            </button>
          </Link>
          <Link href="/chat">
            <button className={`nav-tab ${pathname === "/chat" ? "active" : ""}`}>
              Messages
            </button>
          </Link>
          <Link href="/profile">
            <button className={`nav-tab ${pathname === "/profile" ? "active" : ""}`}>
              Profile
            </button>
          </Link>
          {user.role === "ADMIN" && (
            <Link href="/admin">
              <button className={`nav-tab ${pathname === "/admin" ? "active" : ""}`}>
                Admin
              </button>
            </Link>
          )}
          {onDonate && (
            <button className="btn-primary" onClick={onDonate}>
              + Donate Item
            </button>
          )}
          <button className="btn-outline" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      ) : (
        <div className="nav-right">
          <Link href="/auth">
            <button className="nav-tab">Sign In</button>
          </Link>
          <Link href="/auth?mode=signup">
            <button className="btn-primary">Join Free</button>
          </Link>
        </div>
      )}
    </nav>
  );
}
