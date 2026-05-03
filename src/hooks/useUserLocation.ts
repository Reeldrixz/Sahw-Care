"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function useUserLocation() {
  const { user, loading } = useAuth();
  const [activeCity, setActiveCity]         = useState<string | null>(null);
  const [activeRadius, setActiveRadius]     = useState(10);
  const [activeSetByGPS, setActiveSetByGPS] = useState(false);
  const locationInitRef = useRef(false);

  useEffect(() => {
    if (loading || locationInitRef.current) return;
    locationInitRef.current = true;

    if (user?.preferredCity) {
      setActiveCity(user.preferredCity);
      setActiveRadius(user.preferredRadius ?? 10);
      setActiveSetByGPS(user.locationSetByGPS ?? false);
      return;
    }

    try {
      const stored = localStorage.getItem("kradel_location");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.city) {
          setActiveCity(parsed.city);
          setActiveRadius(parsed.radius ?? 10);
          setActiveSetByGPS(parsed.setByGPS ?? false);
          if (user) {
            fetch("/api/user/location", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ city: parsed.city, radius: parsed.radius ?? 10, setByGPS: parsed.setByGPS ?? false }),
            }).catch(() => {});
          }
        }
      }
    } catch { /* ignore */ }
  }, [loading, user]);

  const handleLocationSelect = useCallback((city: string, radius: number, byGPS: boolean) => {
    setActiveCity(city);
    setActiveRadius(radius);
    setActiveSetByGPS(byGPS);
    if (user) {
      fetch("/api/user/location", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, radius, setByGPS: byGPS }),
      }).catch(() => {});
    } else {
      try {
        localStorage.setItem("kradel_location", JSON.stringify({ city, radius, setByGPS: byGPS }));
      } catch { /* ignore */ }
    }
  }, [user]);

  return { activeCity, activeRadius, activeSetByGPS, handleLocationSelect };
}
