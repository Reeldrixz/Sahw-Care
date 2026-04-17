"use client";

import { useState, useEffect, useRef } from "react";

// ── Country code list ─────────────────────────────────────────────────────────

interface CountryOption {
  flag: string;
  name: string;
  code: string; // e.g. "+234"
}

const COUNTRIES: CountryOption[] = [
  { flag: "🇳🇬", name: "Nigeria",          code: "+234" },
  { flag: "🇺🇸", name: "United States",    code: "+1"   },
  { flag: "🇨🇦", name: "Canada",           code: "+1"   },
  { flag: "🇬🇧", name: "United Kingdom",   code: "+44"  },
  { flag: "🇬🇭", name: "Ghana",            code: "+233" },
  { flag: "🇰🇪", name: "Kenya",            code: "+254" },
  { flag: "🇿🇦", name: "South Africa",     code: "+27"  },
  { flag: "🇮🇳", name: "India",            code: "+91"  },
  { flag: "🇦🇺", name: "Australia",        code: "+61"  },
  { flag: "🇪🇹", name: "Ethiopia",         code: "+251" },
  { flag: "🇹🇿", name: "Tanzania",         code: "+255" },
  { flag: "🇺🇬", name: "Uganda",           code: "+256" },
  { flag: "🇸🇳", name: "Senegal",          code: "+221" },
  { flag: "🇨🇮", name: "Ivory Coast",      code: "+225" },
  { flag: "🇿🇲", name: "Zambia",           code: "+260" },
  { flag: "🇿🇼", name: "Zimbabwe",         code: "+263" },
  { flag: "🇲🇦", name: "Morocco",          code: "+212" },
  { flag: "🇩🇿", name: "Algeria",          code: "+213" },
  { flag: "🇹🇳", name: "Tunisia",          code: "+216" },
  { flag: "🇪🇬", name: "Egypt",            code: "+20"  },
  { flag: "🇨🇲", name: "Cameroon",         code: "+237" },
  { flag: "🇷🇼", name: "Rwanda",           code: "+250" },
  { flag: "🇲🇿", name: "Mozambique",       code: "+258" },
  { flag: "🇿🇦", name: "South Africa",     code: "+27"  },
  { flag: "🇫🇷", name: "France",           code: "+33"  },
  { flag: "🇩🇪", name: "Germany",          code: "+49"  },
  { flag: "🇮🇹", name: "Italy",            code: "+39"  },
  { flag: "🇪🇸", name: "Spain",            code: "+34"  },
  { flag: "🇳🇱", name: "Netherlands",      code: "+31"  },
  { flag: "🇧🇪", name: "Belgium",          code: "+32"  },
  { flag: "🇸🇪", name: "Sweden",           code: "+46"  },
  { flag: "🇳🇴", name: "Norway",           code: "+47"  },
  { flag: "🇩🇰", name: "Denmark",          code: "+45"  },
  { flag: "🇧🇷", name: "Brazil",           code: "+55"  },
  { flag: "🇲🇽", name: "Mexico",           code: "+52"  },
  { flag: "🇨🇴", name: "Colombia",         code: "+57"  },
  { flag: "🇦🇷", name: "Argentina",        code: "+54"  },
  { flag: "🇵🇭", name: "Philippines",      code: "+63"  },
  { flag: "🇮🇩", name: "Indonesia",        code: "+62"  },
  { flag: "🇵🇰", name: "Pakistan",         code: "+92"  },
  { flag: "🇧🇩", name: "Bangladesh",       code: "+880" },
  { flag: "🇯🇵", name: "Japan",            code: "+81"  },
  { flag: "🇰🇷", name: "South Korea",      code: "+82"  },
  { flag: "🇨🇳", name: "China",            code: "+86"  },
  { flag: "🇸🇦", name: "Saudi Arabia",     code: "+966" },
  { flag: "🇦🇪", name: "UAE",              code: "+971" },
];

// De-dupe by name
const COUNTRY_LIST = COUNTRIES.filter((c, i, arr) => arr.findIndex((x) => x.name === c.name) === i);

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  const visible = phone.slice(-4);
  const hidden = phone.slice(0, phone.length - 4).replace(/\d/g, "•");
  return hidden + visible;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** Pre-fill if user already has a number (e.g. "change number" flow). */
  existingPhone?: string | null;
  onClose: () => void;
  onSuccess: (phone: string) => void;
}

export default function PhoneSetupSheet({ existingPhone, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<"number" | "otp">("number");

  // Number entry
  const [countryCode, setCountryCode] = useState("+1");
  const [localNumber, setLocalNumber] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  // OTP
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // The full E.164 number being verified
  const fullPhone = countryCode + localNumber.replace(/\D/g, "").replace(/^0+/, "");

  // Pre-fill country code if editing an existing number
  useEffect(() => {
    if (!existingPhone) return;
    const match = COUNTRY_LIST.find((c) => existingPhone.startsWith(c.code));
    if (match) {
      setCountryCode(match.code);
      setLocalNumber(existingPhone.slice(match.code.length));
    }
  }, [existingPhone]);

  const startResendTimer = () => {
    setResendCountdown(60);
    countdownRef.current = setInterval(() => {
      setResendCountdown((n) => {
        if (n <= 1) { clearInterval(countdownRef.current!); return 0; }
        return n - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const sendCode = async () => {
    setError(null);
    if (localNumber.replace(/\D/g, "").length < 5) {
      setError("Please enter a valid phone number.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/user/phone-setup", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone: fullPhone }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Failed to send code"); return; }
    setStep("otp");
    startResendTimer();
  };

  const verifyCode = async () => {
    setError(null);
    if (otp.length < 6) { setError("Enter the 6-digit code."); return; }
    setLoading(true);
    const res = await fetch("/api/user/phone-setup", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone: fullPhone, code: otp }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Verification failed"); return; }
    onSuccess(fullPhone);
  };

  const resend = async () => {
    if (resendCountdown > 0) return;
    setOtp(""); setError(null); setLoading(true);
    const res = await fetch("/api/user/phone-setup", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone: fullPhone }),
    });
    setLoading(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to resend"); return; }
    startResendTimer();
  };

  const filteredCountries = COUNTRY_LIST.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.includes(countrySearch)
  );

  const selectedCountry = COUNTRY_LIST.find((c) => c.code === countryCode) ?? COUNTRY_LIST[0];

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--white)", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 430, display: "flex", flexDirection: "column", animation: "sheetUp 0.3s ease", overflow: "hidden" }}>

        {/* Handle */}
        <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 0" }} />
        </div>

        {/* ── Step: Enter number ─────────────────────────────────────────── */}
        {step === "number" && (
          <div style={{ padding: "20px 24px 36px" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
              {existingPhone ? "Change phone number" : "Add phone number"}
            </div>
            <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 22, lineHeight: 1.6 }}>
              We'll send a verification code by text. Standard rates may apply.
            </p>

            {/* Country + number row */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {/* Country picker trigger */}
              <button
                onClick={() => { setShowCountryPicker((p) => !p); setCountrySearch(""); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "12px 14px",
                  borderRadius: 12, border: "2px solid var(--border)", background: "var(--white)",
                  cursor: "pointer", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 14,
                  whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 18 }}>{selectedCountry.flag}</span>
                <span style={{ color: "var(--ink)" }}>{countryCode}</span>
                <span style={{ fontSize: 10, color: "var(--mid)" }}>▾</span>
              </button>

              {/* Local number input */}
              <input
                type="tel"
                inputMode="numeric"
                value={localNumber}
                onChange={(e) => setLocalNumber(e.target.value.replace(/[^\d\s\-()]/g, ""))}
                placeholder="800 123 4567"
                style={{
                  flex: 1, padding: "12px 14px", borderRadius: 12,
                  border: "2px solid var(--border)", fontSize: 16,
                  fontFamily: "Nunito, sans-serif", fontWeight: 700, outline: "none",
                }}
                onKeyDown={(e) => e.key === "Enter" && sendCode()}
              />
            </div>

            {/* Country picker dropdown */}
            {showCountryPicker && (
              <div style={{
                border: "1.5px solid var(--border)", borderRadius: 14, overflow: "hidden",
                marginBottom: 14, background: "var(--white)", boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              }}>
                <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                  <input
                    autoFocus
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder="Search country…"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {filteredCountries.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => { setCountryCode(c.code); setShowCountryPicker(false); setCountrySearch(""); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%",
                        padding: "10px 14px", border: "none", background: c.code === countryCode ? "var(--green-light)" : "transparent",
                        cursor: "pointer", fontFamily: "Nunito, sans-serif", textAlign: "left",
                        color: c.code === countryCode ? "var(--green)" : "var(--ink)",
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{c.flag}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                      <span style={{ fontSize: 12, color: "var(--mid)", fontWeight: 700 }}>{c.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div style={{ color: "var(--terra)", fontSize: 13, marginBottom: 12, fontWeight: 600 }}>
                {error}
              </div>
            )}

            <button
              onClick={sendCode}
              disabled={loading || localNumber.replace(/\D/g, "").length < 5}
              style={{
                width: "100%", padding: "14px", borderRadius: 14, border: "none",
                background: "var(--green)", color: "white", fontSize: 15, fontWeight: 800,
                cursor: loading ? "default" : "pointer", fontFamily: "Nunito, sans-serif",
                opacity: loading || localNumber.replace(/\D/g, "").length < 5 ? 0.6 : 1,
              }}
            >
              {loading ? "Sending…" : "Send verification code"}
            </button>
          </div>
        )}

        {/* ── Step: Enter OTP ────────────────────────────────────────────── */}
        {step === "otp" && (
          <div style={{ padding: "20px 24px 36px" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
              Enter the code
            </div>
            <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 22, lineHeight: 1.6 }}>
              We texted a 6-digit code to <strong>{maskPhone(fullPhone)}</strong>.
            </p>

            <input
              type="tel"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              autoFocus
              style={{
                width: "100%", padding: "16px", borderRadius: 14,
                border: `2px solid ${error ? "var(--terra)" : "var(--border)"}`,
                fontSize: 28, textAlign: "center", letterSpacing: 10,
                fontFamily: "Nunito, sans-serif", fontWeight: 800, outline: "none",
                boxSizing: "border-box", marginBottom: 12,
              }}
              onKeyDown={(e) => e.key === "Enter" && verifyCode()}
            />

            {error && (
              <div style={{ color: "var(--terra)", fontSize: 13, marginBottom: 12, fontWeight: 600, textAlign: "center" }}>
                {error}
              </div>
            )}

            <button
              onClick={verifyCode}
              disabled={loading || otp.length < 6}
              style={{
                width: "100%", padding: "14px", borderRadius: 14, border: "none",
                background: "var(--green)", color: "white", fontSize: 15, fontWeight: 800,
                cursor: loading || otp.length < 6 ? "default" : "pointer",
                fontFamily: "Nunito, sans-serif",
                opacity: loading || otp.length < 6 ? 0.6 : 1,
                marginBottom: 14,
              }}
            >
              {loading ? "Verifying…" : "Verify →"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={() => { setStep("number"); setOtp(""); setError(null); }}
                style={{ fontSize: 12, color: "var(--mid)", background: "none", border: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
              >
                ← Change number
              </button>
              <button
                onClick={resend}
                disabled={resendCountdown > 0 || loading}
                style={{
                  fontSize: 12, fontWeight: 700, color: resendCountdown > 0 ? "var(--light)" : "var(--green)",
                  background: "none", border: "none", cursor: resendCountdown > 0 ? "default" : "pointer",
                  fontFamily: "Nunito, sans-serif",
                }}
              >
                {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend code"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
