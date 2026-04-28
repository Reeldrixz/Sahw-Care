"use client";

import { useState, useEffect } from "react";
import { MapPin, Navigation, Check, Search, X, ChevronRight } from "lucide-react";

interface City {
  name: string;
  country: string;
}

const DEFAULT_CITIES: City[] = [
  { name: "Toronto",     country: "Canada"  },
  { name: "Lagos",       country: "Nigeria" },
  { name: "Abuja",       country: "Nigeria" },
  { name: "London",      country: "UK"      },
  { name: "New York",    country: "USA"     },
  { name: "Scarborough", country: "Canada"  },
  { name: "Mississauga", country: "Canada"  },
  { name: "Brampton",    country: "Canada"  },
];

interface Props {
  currentCity: string | null;
  setByGPS: boolean;
  radius: number;
  onSelect: (city: string, radius: number, setByGPS: boolean) => void;
  onClose: () => void;
}

type Step = "sheet" | "perm-modal";

export default function LocationSelector({ currentCity, setByGPS, radius, onSelect, onClose }: Props) {
  const [cities, setCities] = useState<City[]>(DEFAULT_CITIES);
  const [search, setSearch] = useState("");
  const [selectedRadius, setSelectedRadius] = useState(radius);
  const [step, setStep] = useState<Step>("sheet");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [permDenied, setPermDenied] = useState(false);

  useEffect(() => {
    fetch("/api/items/cities")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.cities)) setCities(d.cities); })
      .catch(() => {});
  }, []);

  const filteredCities = cities.filter((c) =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.country.toLowerCase().includes(search.toLowerCase())
  );

  const customCity =
    search.trim() &&
    !cities.some((c) => c.name.toLowerCase() === search.trim().toLowerCase())
      ? search.trim()
      : null;

  const doGPS = () => {
    setStep("sheet");
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.county;
          if (city) {
            onSelect(city, selectedRadius, true);
            onClose();
          }
        } catch { /* silently fail */ }
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
        setPermDenied(true);
      }
    );
  };

  const handleCitySelect = (city: string) => {
    onSelect(city, selectedRadius, false);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500 }}
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div
        style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 430, background: "white",
          borderRadius: "20px 20px 0 0", zIndex: 501,
          maxHeight: "85vh", display: "flex", flexDirection: "column",
          animation: "sheetUp 0.25s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed top section */}
        <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: "#e5e7eb", borderRadius: 4, margin: "0 auto 20px" }} />

          <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 20 }}>
            Your location
          </div>

          {/* GPS row */}
          <button
            onClick={() => {
              if (!navigator.geolocation) return;
              setStep("perm-modal");
            }}
            disabled={gpsLoading}
            style={{
              display: "flex", alignItems: "center", width: "100%",
              padding: "14px 0", background: "none", border: "none",
              borderBottom: "1px solid #f5f5f5", cursor: "pointer", textAlign: "left",
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: "#e8f5f1",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, marginRight: 12,
            }}>
              <Navigation size={16} color="#1a7a5e" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", fontFamily: "Nunito, sans-serif" }}>
                {gpsLoading ? "Detecting location…" : "Use my current location"}
              </div>
              <div style={{ fontSize: 12, color: "#555555", fontFamily: "Nunito, sans-serif" }}>
                GPS · Most accurate
              </div>
            </div>
            {setByGPS && !gpsLoading && <Check size={18} color="#1a7a5e" />}
          </button>

          {/* Radius picker — only when GPS is currently active */}
          {setByGPS && (
            <div style={{ padding: "14px 0 0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#555555", fontFamily: "Nunito, sans-serif", marginBottom: 10 }}>
                Search radius
              </div>
              <div style={{ display: "flex", gap: 8, paddingBottom: 14, borderBottom: "1px solid #f5f5f5" }}>
                {[5, 10, 25].map((r) => (
                  <button
                    key={r}
                    onClick={() => setSelectedRadius(r)}
                    style={{
                      padding: "6px 16px", borderRadius: 20, border: "1.5px solid",
                      borderColor: selectedRadius === r ? "#1a7a5e" : "#e5e7eb",
                      background: selectedRadius === r ? "#1a7a5e" : "white",
                      color: selectedRadius === r ? "white" : "#555555",
                      fontSize: 12, fontWeight: 700, cursor: "pointer",
                      fontFamily: "Nunito, sans-serif",
                    }}
                  >
                    {r} km
                  </button>
                ))}
              </div>
            </div>
          )}

          {!setByGPS && <div style={{ marginBottom: 4 }} />}

          {/* Permission denied notice */}
          {permDenied && (
            <div style={{
              padding: "10px 12px", background: "#fff8e1", borderRadius: 8,
              marginBottom: 12, marginTop: 14, fontSize: 12, color: "#92400e",
              fontFamily: "Nunito, sans-serif", lineHeight: 1.5,
            }}>
              Location access was denied. Choose a city to see nearby items.
            </div>
          )}

          {/* City section label */}
          <div style={{ fontSize: 12, fontWeight: 700, color: "#555555", fontFamily: "Nunito, sans-serif", marginTop: 14, marginBottom: 10 }}>
            Or choose a city
          </div>

          {/* Search input */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#f5f5f5", borderRadius: 10, padding: "9px 12px", marginBottom: 4,
          }}>
            <Search size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cities..."
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                fontSize: 13, fontFamily: "Nunito, sans-serif", color: "#1a1a1a",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}
              >
                <X size={14} color="#9ca3af" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable city list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 48px" }}>
          {customCity && (
            <button
              onClick={() => handleCitySelect(customCity)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "13px 0", background: "none", border: "none",
                borderBottom: "1px solid #f5f5f5", cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{ fontSize: 13, fontFamily: "Nunito, sans-serif", color: "#1a7a5e", fontWeight: 700 }}>
                Use &ldquo;{customCity}&rdquo;
              </span>
              <ChevronRight size={14} color="#1a7a5e" />
            </button>
          )}

          {filteredCities.map((city) => (
            <button
              key={city.name}
              onClick={() => handleCitySelect(city.name)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "13px 0", background: "none", border: "none",
                borderBottom: "1px solid #f5f5f5", cursor: "pointer", textAlign: "left",
              }}
            >
              <div>
                <span style={{ fontSize: 14, fontFamily: "Nunito, sans-serif", fontWeight: 700, color: "#1a1a1a" }}>
                  {city.name}
                </span>
                {city.country && (
                  <span style={{ fontSize: 12, color: "#555555", fontFamily: "Nunito, sans-serif", marginLeft: 6 }}>
                    {city.country}
                  </span>
                )}
              </div>
              {currentCity?.toLowerCase() === city.name.toLowerCase() && !setByGPS && (
                <Check size={16} color="#1a7a5e" />
              )}
            </button>
          ))}

          {filteredCities.length === 0 && !customCity && (
            <div style={{ padding: "24px 0", textAlign: "center", fontSize: 13, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>
              No cities found
            </div>
          )}
        </div>
      </div>

      {/* GPS permission modal — shown before triggering browser prompt */}
      {step === "perm-modal" && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 600 }} />
          <div
            style={{
              position: "fixed", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              background: "white", borderRadius: 20, padding: "28px 24px",
              width: "calc(100% - 48px)", maxWidth: 340, zIndex: 601,
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              width: 64, height: 64, borderRadius: "50%", background: "#e8f5f1",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <MapPin size={28} color="#1a7a5e" />
            </div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: 10, color: "#1a1a1a" }}>
              Allow location access?
            </div>
            <div style={{ fontSize: 13, color: "#555555", lineHeight: 1.6, marginBottom: 24, fontFamily: "Nunito, sans-serif" }}>
              Kradəl uses your location to show items near you. Your exact location is never stored or shared.
            </div>
            <button
              onClick={doGPS}
              style={{
                width: "100%", padding: "13px", borderRadius: 12, border: "none",
                background: "#1a7a5e", color: "white", fontSize: 14, fontWeight: 800,
                cursor: "pointer", fontFamily: "Nunito, sans-serif", marginBottom: 10,
              }}
            >
              Allow location
            </button>
            <button
              onClick={() => setStep("sheet")}
              style={{
                width: "100%", padding: "13px", borderRadius: 12,
                border: "1.5px solid #e5e7eb", background: "white",
                color: "#555555", fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: "Nunito, sans-serif",
              }}
            >
              Choose a city instead
            </button>
          </div>
        </>
      )}
    </>
  );
}
