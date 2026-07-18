"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Partner {
  id: string; name: string; orgType: string; contactEmail: string | null;
  active: boolean; createdAt: string;
  total: number; unused: number; used: number; revoked: number;
}
interface Code {
  id: string; code: string; partnerId: string; partnerName: string;
  status: "UNUSED" | "USED" | "REVOKED";
  createdAt: string; usedAt: string | null; usedByUserId: string | null;
  expiresAt: string | null; note: string | null;
}

const STATUS_STYLE: Record<Code["status"], { bg: string; color: string; label: string }> = {
  UNUSED:  { bg: "#e8f5f1", color: "#1a7a5e", label: "Unused" },
  USED:    { bg: "#eef2ff", color: "#4338ca", label: "Used" },
  REVOKED: { bg: "#f3f4f6", color: "#6b7280", label: "Revoked" },
};

export default function AdminReferralsPage() {
  const router = useRouter();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [codes, setCodes]       = useState<Code[]>([]);
  const [loading, setLoading]   = useState(true);
  const [origin, setOrigin]     = useState("");

  // create-partner form
  const [pName, setPName]           = useState("");
  const [pType, setPType]           = useState("");
  const [pEmail, setPEmail]         = useState("");
  const [creating, setCreating]     = useState(false);

  // generate-codes form
  const [genPartner, setGenPartner] = useState("");
  const [genCount, setGenCount]     = useState(1);
  const [genNote, setGenNote]       = useState("");
  const [genExpiry, setGenExpiry]   = useState("");
  const [generating, setGenerating] = useState(false);

  const [filterPartner, setFilterPartner] = useState("");
  const [copied, setCopied]     = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [pr, cr] = await Promise.all([
      fetch("/api/admin/referrals/partners"),
      fetch(`/api/admin/referrals/codes${filterPartner ? `?partnerId=${filterPartner}` : ""}`),
    ]);
    if (pr.ok) setPartners((await pr.json()).partners ?? []);
    if (cr.ok) setCodes((await cr.json()).codes ?? []);
    setLoading(false);
  }, [filterPartner]);

  useEffect(() => { load(); }, [load]);

  const createPartner = async () => {
    setError(null);
    if (!pName.trim() || !pType.trim()) { setError("Name and organization type are required."); return; }
    setCreating(true);
    const r = await fetch("/api/admin/referrals/partners", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: pName, orgType: pType, contactEmail: pEmail }),
    });
    setCreating(false);
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? "Could not create partner."); return; }
    setPName(""); setPType(""); setPEmail("");
    load();
  };

  const generateCodes = async () => {
    setError(null);
    if (!genPartner) { setError("Choose a partner to generate codes for."); return; }
    setGenerating(true);
    const r = await fetch("/api/admin/referrals/codes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerId: genPartner, count: genCount, note: genNote, expiresAt: genExpiry || null }),
    });
    setGenerating(false);
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? "Could not generate codes."); return; }
    setGenNote(""); setGenExpiry("");
    load();
  };

  const revoke = async (id: string) => {
    const r = await fetch(`/api/admin/referrals/codes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke" }),
    });
    if (r.ok) load();
    else setError((await r.json().catch(() => ({}))).error ?? "Could not revoke.");
  };

  const linkFor = (code: string) => `${origin}/join/${code}`;
  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(code));
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    } catch { /* clipboard blocked — ignore */ }
  };

  const td: React.CSSProperties = { padding: "10px 10px", fontFamily: "Nunito, sans-serif", fontSize: 13 };
  const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontWeight: 800, color: "#555", fontSize: 12, fontFamily: "Nunito, sans-serif" };
  const input: React.CSSProperties = { padding: "9px 12px", border: "1.5px solid #e0e0e0", borderRadius: 10, fontSize: 14, fontFamily: "Nunito, sans-serif", outline: "none", boxSizing: "border-box" };
  const btn: React.CSSProperties = { padding: "9px 18px", background: "#1a7a5e", border: "none", borderRadius: 10, color: "white", fontWeight: 800, fontSize: 13, fontFamily: "Nunito, sans-serif", cursor: "pointer" };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", padding: "24px 20px 80px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <button onClick={() => router.push("/admin")} style={{ background: "none", border: "none", color: "#1a7a5e", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif", marginBottom: 12 }}>← Back to Admin</button>
        <div style={{ fontFamily: "Lora, serif", fontSize: 26, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>Referral Codes</div>
        <div style={{ fontSize: 13, color: "#666", fontFamily: "Nunito, sans-serif", marginBottom: 20 }}>
          Generate single-use invite links for partner organizations. Each code grants one mother the RECIPIENT role.
        </div>

        {error && <div style={{ padding: "10px 14px", background: "#fdecea", borderRadius: 10, fontSize: 13, color: "#c0392b", fontFamily: "Nunito, sans-serif", marginBottom: 16 }}>{error}</div>}

        {/* ── Create partner + generate codes ─────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #e8e8e8", padding: "18px" }}>
            <div style={{ fontWeight: 800, fontSize: 14, fontFamily: "Nunito, sans-serif", marginBottom: 12 }}>Add a partner</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={input} placeholder="Organization name" value={pName} onChange={(e) => setPName(e.target.value)} />
              <input style={input} placeholder="Org type (e.g. Shelter, Clinic, NGO)" value={pType} onChange={(e) => setPType(e.target.value)} />
              <input style={input} placeholder="Contact email (optional)" value={pEmail} onChange={(e) => setPEmail(e.target.value)} />
              <button style={{ ...btn, opacity: creating ? 0.7 : 1 }} disabled={creating} onClick={createPartner}>{creating ? "Adding…" : "Add partner"}</button>
            </div>
          </div>

          <div style={{ background: "white", borderRadius: 14, border: "1px solid #e8e8e8", padding: "18px" }}>
            <div style={{ fontWeight: 800, fontSize: 14, fontFamily: "Nunito, sans-serif", marginBottom: 12 }}>Generate codes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select style={input} value={genPartner} onChange={(e) => setGenPartner(e.target.value)}>
                <option value="">Select partner…</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div style={{ display: "flex", gap: 10 }}>
                <input style={{ ...input, width: 90 }} type="number" min={1} max={25} value={genCount} onChange={(e) => setGenCount(Number(e.target.value))} />
                <input style={{ ...input, flex: 1 }} type="date" value={genExpiry} onChange={(e) => setGenExpiry(e.target.value)} title="Optional expiry" />
              </div>
              <input style={input} placeholder="Note (optional, e.g. mother's first name)" value={genNote} onChange={(e) => setGenNote(e.target.value)} />
              <button style={{ ...btn, opacity: generating ? 0.7 : 1 }} disabled={generating} onClick={generateCodes}>{generating ? "Generating…" : `Generate ${genCount} code${genCount === 1 ? "" : "s"}`}</button>
            </div>
          </div>
        </div>

        {/* ── Partners summary ────────────────────────────────────────────── */}
        <div style={{ background: "white", borderRadius: 14, border: "1px solid #e8e8e8", padding: "12px 6px", marginBottom: 20 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "2px solid #eee" }}>
              {["Partner", "Type", "Contact", "Unused", "Used", "Revoked"].map((h) => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {partners.length === 0 && !loading && (
                <tr><td style={{ ...td, color: "#999" }} colSpan={6}>No partners yet.</td></tr>
              )}
              {partners.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f4f4f4" }}>
                  <td style={{ ...td, fontWeight: 700 }}>{p.name}</td>
                  <td style={td}>{p.orgType}</td>
                  <td style={{ ...td, color: "#666" }}>{p.contactEmail ?? "—"}</td>
                  <td style={{ ...td, color: "#1a7a5e", fontWeight: 700 }}>{p.unused}</td>
                  <td style={td}>{p.used}</td>
                  <td style={{ ...td, color: "#9ca3af" }}>{p.revoked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Codes ───────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 15, fontFamily: "Nunito, sans-serif" }}>Codes</div>
          <select style={{ ...input, padding: "6px 10px", marginLeft: "auto" }} value={filterPartner} onChange={(e) => setFilterPartner(e.target.value)}>
            <option value="">All partners</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div style={{ background: "white", borderRadius: 14, border: "1px solid #e8e8e8", padding: "12px 6px" }}>
          {loading ? <div className="loading"><div className="spinner" /></div> : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: "2px solid #eee" }}>
                {["Code", "Partner", "Status", "Created", "Used", "Note", "Link", ""].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {codes.length === 0 && (
                  <tr><td style={{ ...td, color: "#999" }} colSpan={8}>No codes yet.</td></tr>
                )}
                {codes.map((c) => {
                  const s = STATUS_STYLE[c.status];
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f4f4f4" }}>
                      <td style={{ ...td, fontFamily: "monospace", fontWeight: 700 }}>{c.code}</td>
                      <td style={td}>{c.partnerName}</td>
                      <td style={td}><span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 20 }}>{s.label}</span></td>
                      <td style={{ ...td, color: "#666" }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td style={{ ...td, color: "#666" }}>{c.usedAt ? new Date(c.usedAt).toLocaleDateString() : "—"}</td>
                      <td style={{ ...td, color: "#666" }}>{c.note ?? "—"}</td>
                      <td style={td}>
                        <button onClick={() => copyLink(c.code)} style={{ padding: "4px 10px", borderRadius: 8, border: "1.5px solid #1a7a5e", background: "none", color: "#1a7a5e", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                          {copied === c.code ? "Copied!" : "Copy link"}
                        </button>
                      </td>
                      <td style={td}>
                        {c.status === "UNUSED" && (
                          <button onClick={() => revoke(c.id)} style={{ padding: "4px 10px", borderRadius: 8, border: "1.5px solid #e0e0e0", background: "none", color: "#c0392b", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Revoke</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
