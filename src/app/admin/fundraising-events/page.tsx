"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Link2, Ban, Play, Square, Copy, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Operating surface for fundraising events. Admin only.
//
// This exists because nothing could list events: create returned an id, and if
// you lost it the only way back was reading the table. It is also the first
// path that exercises the create endpoint the way it will actually be used.
//
// THE TOKEN IS SHOWN ONCE, HERE, AT THE MOMENT OF ISSUE. The list endpoint
// deliberately never returns the value — only whether a live link exists, when
// it expires, and whether it was revoked. So the panel below is the single
// opportunity to copy it, and the copy says so. A lost token is rotated, not
// recovered, which is the honest consequence of not storing a credential
// anywhere it will be casually re-read.

interface EventRow {
  id: string; title: string; slug: string; hostName: string;
  goalCents: number; status: "DRAFT" | "LIVE" | "ENDED";
  startedAt: string | null; endedAt: string | null; createdAt: string;
  hasToken: boolean; tokenIssuedAt: string | null;
  tokenExpiresAt: string | null; tokenRevokedAt: string | null; tokenExpired: boolean;
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function AdminFundraisingEventsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [events, setEvents]   = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState<string | null>(null);
  const [busy, setBusy]       = useState<string | null>(null);

  const [form, setForm] = useState({ title: "", hostName: "", goalDollars: "" });
  const [creating, setCreating] = useState(false);

  // The one-time token reveal. Held in memory only — never re-fetched, gone on
  // refresh, which is exactly the guarantee the list endpoint makes possible.
  const [issued, setIssued] = useState<{ eventId: string; url: string; expiresAt: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "ADMIN")) router.push("/");
  }, [user, authLoading, router]);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/fundraising-events", { cache: "no-store" });
    if (r.ok) { const d = await r.json(); setEvents(d.events ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { if (user?.role === "ADMIN") load(); }, [user, load]);

  const create = async () => {
    setCreating(true);
    const dollars = Number(form.goalDollars);
    const r = await fetch("/api/admin/fundraising-events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        hostName: form.hostName.trim(),
        goalCents: Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0,
      }),
    });
    const d = await r.json().catch(() => ({}));
    setCreating(false);
    if (!r.ok) { setToast(d.error ?? "Could not create event"); return; }
    setForm({ title: "", hostName: "", goalDollars: "" });
    setToast(`Created "${d.event.title}" as DRAFT — no link issued yet`);
    load();
  };

  const changeStatus = async (id: string, status: "LIVE" | "ENDED") => {
    setBusy(id);
    const r = await fetch(`/api/admin/fundraising-events/${id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setToast(d.error ?? "Transition refused"); return; }
    setToast(
      status === "ENDED"
        ? d.tokenRevoked
          ? "Event ended — the host link was revoked with it"
          : "Event ended"
        : "Event is live"
    );
    load();
  };

  const issueToken = async (id: string, hasToken: boolean) => {
    if (hasToken && !confirm("This event already has a live link.\n\nIssuing a new one rotates it — the existing link stops working immediately. Continue?")) return;
    setBusy(id);
    const r = await fetch(`/api/admin/fundraising-events/${id}/token`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresInHours: 8 }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setToast(d.error ?? "Could not issue link"); return; }
    setIssued({ eventId: id, url: `${window.location.origin}/host/${d.accessToken}`, expiresAt: d.tokenExpiresAt ?? null });
    setCopied(false);
    load();
  };

  const revokeToken = async (id: string) => {
    if (!confirm("Revoke this host link?\n\nAnyone holding it loses access immediately, and it cannot be recovered — you would issue a new one.")) return;
    setBusy(id);
    const r = await fetch(`/api/admin/fundraising-events/${id}/token`, { method: "DELETE" });
    setBusy(null);
    if (!r.ok) { setToast("Could not revoke"); return; }
    if (issued?.eventId === id) setIssued(null);
    setToast("Link revoked — the credential no longer exists");
    load();
  };

  if (authLoading || !user || user.role !== "ADMIN") return null;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 60 }}>
      <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 920, margin: "0 auto" }}>
          <button onClick={() => router.push("/admin")} style={btnIcon}>
            <ArrowLeft size={16} strokeWidth={2} color="white" />
          </button>
          <div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white" }}>Fundraising events</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
              Create events, issue host links, control the lifecycle
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 920, margin: "0 auto", padding: 16 }}>
        {/* One-time token reveal */}
        {issued && (
          <div style={{ ...card, background: "#e8f5f1", border: "2px solid #1a7a5e", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0d3d2e", fontFamily: "Nunito, sans-serif", marginBottom: 6 }}>
              Host link — copy it now, it won&apos;t be shown again
            </div>
            <div style={{ fontSize: 12, color: "#1a5c45", lineHeight: 1.6, marginBottom: 10 }}>
              This is the only time the link appears. It isn&apos;t stored anywhere you can read it back —
              if it&apos;s lost, issue a new one, which replaces this.
              {issued.expiresAt && <> Expires {new Date(issued.expiresAt).toLocaleString()}.</>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <code style={{ flex: 1, background: "white", border: "1px solid #bbf0db", borderRadius: 8, padding: "9px 11px", fontSize: 12, wordBreak: "break-all" }}>
                {issued.url}
              </code>
              <button
                onClick={() => { navigator.clipboard?.writeText(issued.url); setCopied(true); }}
                style={{ ...btnSmall, background: "#1a7a5e", color: "white", border: "none", whiteSpace: "nowrap" }}
              >
                {copied ? <><Check size={13} strokeWidth={2.5} /> Copied</> : <><Copy size={13} strokeWidth={2.5} /> Copy</>}
              </button>
            </div>
          </div>
        )}

        {/* Create */}
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
            New event
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <input placeholder="Event title" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} style={input} />
            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder="Host name" value={form.hostName}
                onChange={(e) => setForm({ ...form, hostName: e.target.value })} style={{ ...input, flex: 1 }} />
              <input placeholder="Goal ($, optional)" value={form.goalDollars} inputMode="decimal"
                onChange={(e) => setForm({ ...form, goalDollars: e.target.value })} style={{ ...input, width: 170 }} />
            </div>
            <button
              disabled={creating || form.title.trim().length < 3 || form.hostName.trim().length < 2}
              onClick={create}
              style={{ ...btnPrimary, opacity: form.title.trim().length >= 3 && form.hostName.trim().length >= 2 ? 1 : 0.5 }}
            >
              <Plus size={14} strokeWidth={2.5} /> {creating ? "Creating…" : "Create as draft"}
            </button>
            <div style={{ fontSize: 11.5, color: "var(--light)", lineHeight: 1.5 }}>
              Creating never issues a link. Those are separate decisions — an event shouldn&apos;t
              carry a live credential nobody meant to create.
            </div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><div className="spinner" /></div>
        ) : events.length === 0 ? (
          <div style={{ ...card, textAlign: "center", color: "var(--mid)", fontSize: 13.5, padding: 32 }}>
            No events yet.
          </div>
        ) : (
          events.map((e) => (
            <div key={e.id} style={{ ...card, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={statusChip(e.status)}>{e.status}</span>
                    <span style={{ fontFamily: "Lora, serif", fontSize: 15.5, fontWeight: 700, color: "var(--ink)" }}>{e.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--mid)", marginTop: 4 }}>
                    {e.hostName} · goal {e.goalCents > 0 ? money(e.goalCents) : "none"} · /{e.slug}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--light)", marginTop: 3 }}>
                    {e.startedAt ? `started ${new Date(e.startedAt).toLocaleString()}` : "not started"}
                    {e.endedAt && ` · ended ${new Date(e.endedAt).toLocaleString()}`}
                  </div>
                  <div style={{ fontSize: 11.5, marginTop: 5, color: linkStateColor(e) }}>
                    {linkState(e)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
                  {e.status === "DRAFT" && (
                    <button disabled={busy === e.id} onClick={() => changeStatus(e.id, "LIVE")} style={{ ...btnSmall, borderColor: "#1a7a5e", color: "#1a7a5e" }}>
                      <Play size={13} strokeWidth={2.5} /> Go live
                    </button>
                  )}
                  {e.status !== "ENDED" && (
                    <button disabled={busy === e.id} onClick={() => changeStatus(e.id, "ENDED")} style={{ ...btnSmall, borderColor: "#b45309", color: "#b45309" }}>
                      <Square size={12} strokeWidth={2.5} /> End
                    </button>
                  )}
                  {e.status !== "ENDED" && (
                    <button disabled={busy === e.id} onClick={() => issueToken(e.id, e.hasToken)} style={btnSmall}>
                      <Link2 size={13} strokeWidth={2.5} /> {e.hasToken ? "Rotate link" : "Issue link"}
                    </button>
                  )}
                  {e.hasToken && (
                    <button disabled={busy === e.id} onClick={() => revokeToken(e.id)} style={{ ...btnSmall, borderColor: "#b91c1c", color: "#b91c1c" }}>
                      <Ban size={13} strokeWidth={2.5} /> Revoke
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {toast && (
        <div onClick={() => setToast(null)} style={toastStyle}>{toast}</div>
      )}
    </div>
  );
}

function linkState(e: EventRow): string {
  if (e.hasToken && e.tokenExpired) return "Link expired — rotate to issue a new one";
  if (e.hasToken) return e.tokenExpiresAt ? `Live link · expires ${new Date(e.tokenExpiresAt).toLocaleString()}` : "Live link · no expiry";
  if (e.tokenRevokedAt) return `No live link · revoked ${new Date(e.tokenRevokedAt).toLocaleString()}`;
  return "No link issued";
}
function linkStateColor(e: EventRow): string {
  if (e.hasToken && !e.tokenExpired) return "#1a7a5e";
  if (e.hasToken && e.tokenExpired) return "#b45309";
  return "var(--light)";
}

const card: React.CSSProperties = { background: "white", border: "1px solid var(--border)", borderRadius: 16, padding: 16 };
const input: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13, fontFamily: "inherit", background: "white", color: "var(--ink)" };
const btnIcon: React.CSSProperties = { background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center" };
const btnPrimary: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 12, border: "none", background: "#1a7a5e", color: "white", fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer" };
const btnSmall: React.CSSProperties = { display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, border: "1.5px solid var(--border)", background: "white", color: "var(--ink)", fontSize: 12, fontWeight: 700, fontFamily: "Nunito, sans-serif", cursor: "pointer" };
const toastStyle: React.CSSProperties = { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#0d3d2e", color: "white", padding: "12px 18px", borderRadius: 12, fontSize: 12.5, fontWeight: 600, maxWidth: 460, cursor: "pointer", zIndex: 100, lineHeight: 1.5 };
const statusChip = (s: string): React.CSSProperties => ({
  fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 20, fontFamily: "Nunito, sans-serif",
  background: s === "LIVE" ? "#e8f5f1" : s === "ENDED" ? "#f3f4f6" : "#fffbeb",
  color:      s === "LIVE" ? "#1a7a5e" : s === "ENDED" ? "#6b7280" : "#92400e",
  border:     `1px solid ${s === "LIVE" ? "#bbf0db" : s === "ENDED" ? "#e5e7eb" : "#fde68a"}`,
});
