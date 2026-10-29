"use client";

import { useState } from "react";

// The live-feature consent card's address step (api/registers/[id]/live-address,
// lib/liveAddress). Her address is sent once and never read back: the server
// returns only whether it was saved.

export const LIVE_ADDRESS_SHEET_TEXT =
  "To be featured on a live stream, we need to hold your shipping address ahead of time. " +
  "We use it only to ship your items. We keep it until your items are delivered, then delete it. " +
  "If nothing is funded within 90 days, we delete it and you can confirm again. " +
  "You can keep the address option you have now. You just won't be featured on live streams.";

const PROVINCES: [string, string][] = [
  ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"], ["NB", "New Brunswick"],
  ["NL", "Newfoundland and Labrador"], ["NS", "Nova Scotia"], ["NT", "Northwest Territories"],
  ["NU", "Nunavut"], ["ON", "Ontario"], ["PE", "Prince Edward Island"], ["QC", "Quebec"],
  ["SK", "Saskatchewan"], ["YT", "Yukon"],
];

export function LiveAddressSheet({ registerId, onClose, onSaved, onNeedsIdentity }: {
  registerId: string; onClose: () => void; onSaved: () => void; onNeedsIdentity: () => void;
}) {
  const [f, setF] = useState({ fullName: "", streetAddress: "", unit: "", city: "", province: "", postalCode: "", phone: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const complete = f.fullName.trim() && f.streetAddress.trim() && f.city.trim() && f.province && f.postalCode.trim() && f.phone.trim();

  const save = async () => {
    setBusy(true); setErr(null);
    const res = await fetch(`/api/registers/${registerId}/live-address`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { onSaved(); return; }
    if (d.code === "NEEDS_IDENTITY_VERIFICATION" || d.code === "ACCOUNT_UNDER_REVIEW") { onNeedsIdentity(); return; }
    setErr(d.error ?? "Couldn't save your address.");
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 220, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--white)", borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 16px" }} />
        <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Confirm shipping address</div>
        <p style={{ fontSize: 12.5, color: "var(--mid)", lineHeight: 1.65, margin: "0 0 16px", fontFamily: "Nunito, sans-serif" }}>
          {LIVE_ADDRESS_SHEET_TEXT}
        </p>

        <div className="form-group">
          <label className="form-label">Full name *</label>
          <input className="form-input" placeholder="As it appears on ID" value={f.fullName} onChange={set("fullName")} autoComplete="name" />
        </div>
        <div className="form-group">
          <label className="form-label">Street address *</label>
          <input className="form-input" placeholder="123 Main Street" value={f.streetAddress} onChange={set("streetAddress")} autoComplete="address-line1" />
        </div>
        <div className="form-group">
          <label className="form-label">Apt / Unit (optional)</label>
          <input className="form-input" placeholder="Unit 4B" value={f.unit} onChange={set("unit")} autoComplete="address-line2" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div className="form-group">
            <label className="form-label">City *</label>
            <input className="form-input" placeholder="Toronto" value={f.city} onChange={set("city")} autoComplete="address-level2" />
          </div>
          <div className="form-group">
            <label className="form-label">Province *</label>
            <select className="form-input" value={f.province} onChange={set("province")} style={{ background: "var(--white)" }}>
              <option value="">Select…</option>
              {PROVINCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div className="form-group">
            <label className="form-label">Postal code *</label>
            <input className="form-input" placeholder="M5V 2T6" value={f.postalCode} onChange={set("postalCode")} autoComplete="postal-code" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone *</label>
            <input className="form-input" type="tel" placeholder="416-555-0100" value={f.phone} onChange={set("phone")} autoComplete="tel" />
          </div>
        </div>

        {err && <div role="alert" style={{ fontSize: 12.5, color: "#c0392b", marginBottom: 12, fontFamily: "Nunito, sans-serif" }}>{err}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} className="btn-clear" style={{ flex: 1 }}>Cancel</button>
          <button onClick={save} disabled={busy || !complete} className="btn-apply" style={{ flex: 2 }}>
            {busy ? "Saving…" : "Confirm address"}
          </button>
        </div>
      </div>
    </div>
  );
}
