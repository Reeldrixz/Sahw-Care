"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import ReflectionResources from "@/components/ReflectionResources";
import { STAGE_META, type StageKey } from "@/lib/stage";
import { Users, PenLine, ChevronDown, ChevronRight } from "lucide-react";

const SERIF = "Lora, Georgia, serif";
const SANS  = "Nunito, sans-serif";

const STAGE_ORDER: StageKey[] = [
  "pregnancy-0-3", "pregnancy-4-6", "pregnancy-7-9",
  "postpartum-0-3", "postpartum-4-6", "postpartum-7-12", "postpartum-13-24",
];

interface FeedReflection {
  id: string; title: string; body: string; stageKey: string;
  publishedAt: string | null; displayName: string;
}
interface MineReflection {
  id: string; title: string; body: string; stageKey: string;
  status: string; createdAt: string; publishedAt: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export default function ReflectionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { id: circleId } = useParams<{ id: string }>();

  const ownStage = (user?.currentStage as StageKey | undefined) ?? null;
  const [stage, setStage]         = useState<StageKey | null>(ownStage);
  const [feed, setFeed]           = useState<FeedReflection[]>([]);
  const [mine, setMine]           = useState<MineReflection[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);

  const isRecipient = user?.role === "RECIPIENT";

  // Donors never reach this space.
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/auth"); return; }
    if (user.journeyType === "donor") { router.replace("/"); return; }
    if (!stage && ownStage) setStage(ownStage);
  }, [authLoading, user, router, stage, ownStage]);

  const load = useCallback(async () => {
    if (!stage) return;
    setLoading(true);
    const [f, m] = await Promise.all([
      fetch(`/api/circles/reflections?stage=${stage}`, { cache: "no-store" }),
      fetch(`/api/circles/reflections/mine`, { cache: "no-store" }),
    ]);
    if (f.ok) { const d = await f.json(); setFeed(d.reflections ?? []); }
    if (m.ok) { const d = await m.json(); setMine(d.reflections ?? []); }
    setLoading(false);
  }, [stage]);

  useEffect(() => { if (stage) load(); }, [stage, load]);

  const stageLabel = (s: string) => STAGE_META[s as StageKey]?.label ?? s;

  return (
    <div style={{ background: "var(--bg, #faf7f2)", minHeight: "100vh", paddingBottom: 90 }}>
      {/* ── Header + toggle ─────────────────────────────── */}
      <div style={{ background: "var(--white, #fff)", borderBottom: "1px solid #eee", padding: "16px 16px 0" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => router.push(`/circles/${circleId}`)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 20, border: "1.5px solid #e0e0e0", background: "white", color: "#555", fontFamily: SANS, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            <Users size={15} strokeWidth={2} /> Cohort
          </button>
          <button
            aria-current="page"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 20, border: "1.5px solid #1a7a5e", background: "#1a7a5e", color: "white", fontFamily: SANS, fontSize: 13, fontWeight: 800, cursor: "default" }}
          >
            <PenLine size={15} strokeWidth={2} /> Reflections
          </button>
        </div>
        <h1 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: "0 0 4px" }}>Reflections</h1>
        <p style={{ fontFamily: SANS, fontSize: 13, color: "#666", lineHeight: 1.6, margin: "0 0 14px" }}>
          A quiet space to share how this stage of motherhood feels, in your own words. This isn&apos;t for requests or
          urgent help. It&apos;s for your experience and your state of mind.
        </p>
      </div>

      <div style={{ paddingTop: 14 }}>
        {/* Persistent, calm support note */}
        <ReflectionResources />

        {/* Write button (RECIPIENT only) */}
        {isRecipient && (
          <div style={{ margin: "0 16px 14px" }}>
            <button
              onClick={() => router.push(`/circles/${circleId}/reflections/new`)}
              style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: "#1a7a5e", color: "white", fontFamily: SANS, fontSize: 14, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <PenLine size={16} strokeWidth={2} /> Write a reflection
            </button>
          </div>
        )}

        {/* Stage switcher — own stage prominent, browse others read-only */}
        <div style={{ margin: "0 16px 8px", display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
          {STAGE_ORDER.map((s) => {
            const active = s === stage;
            const own    = s === ownStage;
            return (
              <button
                key={s}
                onClick={() => { setStage(s); setExpanded(null); }}
                style={{
                  flexShrink: 0, padding: "6px 12px", borderRadius: 18,
                  border: `1.5px solid ${active ? "#1a7a5e" : "#e0e0e0"}`,
                  background: active ? "#1a7a5e" : "white",
                  color: active ? "white" : "#555",
                  fontFamily: SANS, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                {stageLabel(s)}{own ? " (yours)" : ""}
              </button>
            );
          })}
        </div>

        {/* Your reflections (own, any status) */}
        {mine.length > 0 && (
          <div style={{ margin: "10px 16px 0" }}>
            <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
              Your reflections
            </div>
            {mine.map((r) => (
              <div key={r.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{r.title}</div>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, fontFamily: SANS,
                    background: r.status === "PUBLISHED" ? "#e8f5f1" : r.status === "REJECTED" ? "#fdecea" : "#fff8ed",
                    color:      r.status === "PUBLISHED" ? "#1a7a5e" : r.status === "REJECTED" ? "#c0392b" : "#b45309",
                  }}>
                    {r.status === "PENDING" ? "In review" : r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Published feed for the selected stage */}
        <div style={{ margin: "14px 16px 0" }}>
          <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
            {stage === ownStage ? "Your stage" : stageLabel(stage ?? "")}
          </div>
          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#999", fontFamily: SANS, fontSize: 13 }}>Loading…</div>
          ) : feed.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "#666", fontFamily: SANS, fontSize: 13, lineHeight: 1.6 }}>
              No reflections here yet. {isRecipient && stage === ownStage ? "You could be the first to share how this stage feels." : "Check back soon."}
            </div>
          ) : (
            feed.map((r) => {
              const open = expanded === r.id;
              return (
                <article key={r.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 14, padding: "16px 18px", marginBottom: 12 }}>
                  <button
                    onClick={() => setExpanded(open ? null : r.id)}
                    style={{ width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "space-between" }}
                  >
                    <div>
                      <h2 style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: "#1a1a1a", margin: "0 0 4px", lineHeight: 1.3 }}>{r.title}</h2>
                      <div style={{ fontFamily: SANS, fontSize: 12, color: "#9ca3af" }}>
                        {r.displayName}{r.publishedAt ? ` · ${fmtDate(r.publishedAt)}` : ""}
                      </div>
                    </div>
                    {open ? <ChevronDown size={18} color="#ccc" /> : <ChevronRight size={18} color="#ccc" />}
                  </button>
                  {open && (
                    <div style={{ fontFamily: SANS, fontSize: 14.5, color: "#333", lineHeight: 1.8, whiteSpace: "pre-wrap", marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
                      {r.body}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
