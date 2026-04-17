"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: "DONOR" | "RECIPIENT" | "ADMIN";
  avatar: string | null;
  location: string | null;
  isPremium: boolean;
  trustRating: number;
  trustScore: number;
  verificationLevel: number;
  phoneVerified: boolean;
  emailVerified: boolean;
  urgentOverridesUsed: number;
  urgentOverridesResetAt: string | null;
  docStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  documentUrl: string | null;
  documentType: string | null;
  documentNote: string | null;
  verifiedAt: string | null;
  status: string;
  createdAt: string;
  // cohort / onboarding
  onboardingComplete: boolean;
  journeyType: string | null;
  currentStage: string | null;
  countryFlag: string | null;
  subTags: string[];
  currentCircleId: string | null;
  // circle identity
  circleIdentitySet: boolean;
  circleContext: string | null;
  circleDisplayName: string | null;
  circleIdentitySkippedAt: string | null;
  _count?: { items: number; requests: number };
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (name: string, identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = async (identifier: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Login failed");
    // Fetch the full user object (includes onboardingComplete, journeyType, countryFlag, etc.)
    // so the gate never fires on a partial/stale user shape.
    await refreshUser();
  };

  const register = async (name: string, identifier: string, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, identifier, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Registration failed");
    // Same: use the canonical /api/auth/me response.
    await refreshUser();
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
