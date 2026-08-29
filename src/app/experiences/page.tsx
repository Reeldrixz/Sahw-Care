"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Search, PencilLine, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { STAGE_META, type StageKey } from "@/lib/stage";

// Browse Experiences.
//
// Built for retrieval, not scrolling. The entry view is the seven fixed topics
// with counts, plus a search box — a mother arrives with a question, not to see
// what is new. There is no infinite scroll: paging is an explicit "show more",
// so the interaction ends when she has found her answer rather than continuing
// until she stops.
//
// The one recency surface is a small, bounded, clearly-labelled "Recently
// added" shelf on the unfiltered view. It exists so a young library does not
// look abandoned, and it is never the default reading order.

const TOPICS: { value: string; label: string }[] = [
  { value: "FEEDING",         label: "Feeding" },
  { value: "SLEEP",           label: "Sleep" },
  { value: "RECOVERY",        label: "Recovery" },
  { value: "MENTAL_HEALTH",   label: "Mental health" },
  { value: "MEDICAL",         label: "Medical" },
  { value: "LOGISTICS_MONEY", label: "Logistics & money" },
  { value: "RELATIONSHIPS",   label: "Relationships" },
];

const STAGES = Object.keys(STAGE_META) as StageKey[];

interface Item {
  id: string; situation: string; whatITried: string; takeaway: string;
  topic: string; stageKey: string | null; stageLabel: string | null;
  helpedCount: number; publishedAt: string | null;
}

function BrowseInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [topic,  setTopic]  = useState(params.get("topic") ?? "");
  const [stage,  setStage]  = useState(params.get("stage") ?? "");
  const [qInput, setQInput] = useState(params.get("q") ?? "");
  const [q,      setQ]      = useState(params.get("q") ?? "");

  const [items,  setItems]  = useState<Item[]>([]);
  const [shelf,  setShelf]  = useState<Item[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total,  setTotal]  = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [denied,  setDenied]  = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/");
  }, [user, authLoading, router]);

  const load = useCallback(async (opts: { topic: string; stage: string; q: string; offset: number; append: boolean }) => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (opts.topic) sp.set("topic", opts.topic);
    if (opts.stage) sp.set("stage", opts.stage);
    if (opts.q)     sp.set("q", opts.q);
    if (opts.offset) sp.set("offset", String(opts.offset));

    const r = await fetch(`/api/experiences/browse?${sp}`, { cache: "no-store" });
    if (r.status === 403) {
      const d = await r.json().catch(() => ({}));
      setDenied(d.error ?? "Experiences is for mothers.");
      setLoading(false);
      return;
    }
    if (r.ok) {
      const d = await r.json();
      setItems((prev) => (opts.append ? [...prev, ...d.items] : d.items));
      setShelf(d.shelf ?? []);
      setCounts(d.topicCounts ?? {});
      setTotal(d.total ?? 0);
      setHasMore(!!d.hasMore);
      setNextOffset(d.nextOffset ?? 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) load({ topic, stage, q, offset: 0, append: false });
  }, [user, topic, stage, q, load]);

  if (authLoading || !user) return null;

  if (denied) {
    return (
      <Shell onBack={() => router.push("/profile")}>
        <div style={card}>
          <p style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.7, margin: 0 }}>{denied}</p>
          <button onClick={() => router.push("/profile/journey")} style={{ ...btnPrimary, marginTop: 14 }}>
            Let us know in your profile
          </button>
        </div>
      </Shell>
    );
  }

  const filtered = !!(topic || stage || q);

  return (
    <Shell onBack={() => router.push("/profile")}>
      {/* Search */}
      <form
        onSubmit={(e) => { e.preventDefault(); setQ(qInput.trim()); }}
        style={{ display: "flex", gap: 8, marginBottom: 14 }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={15} strokeWidth={2} color="var(--light)" style={{ position: "absolute", left: 11, top: 12 }} />
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="What are you looking for? e.g. bottle refusing"
            style={{ ...input, paddingLeft: 32 }}
          />
        </div>
        <button type="submit" style={btnSearch}>Search</button>
      </form>

      {/* Topics */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
        {TOPICS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTopic(topic === t.value ? "" : t.value)}
            style={pill(topic === t.value)}
          >
            {t.label}
            {counts[t.value] ? ` ${counts[t.value]}` : ""}
          </button>
        ))}
      </div>

      {/* Stage */}
      <select
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        style={{ ...input, marginBottom: 16 }}
      >
        <option value="">Any stage</option>
        {STAGES.map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
      </select>

      {(filtered || q) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "var(--mid)" }}>
            {total} {total === 1 ? "experience" : "experiences"}
            {q && <> matching “{q}”</>}
          </div>
          <button
            onClick={() => { setTopic(""); setStage(""); setQ(""); setQInput(""); }}
            style={{ background: "none", border: "none", color: "#1a7a5e", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
          >
            Clear
          </button>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: 32 }}>
          <p style={{ fontSize: 13.5, color: "var(--mid)", lineHeight: 1.7, margin: 0 }}>
            {q
              ? <>Nothing matches “{q}” yet. Try fewer words — search looks for the exact phrase.</>
              : filtered
                ? "Nothing here yet. Try another topic or stage."
                : "No experiences have been published yet. If you've been through something, you could be the first to write it down."}
          </p>
        </div>
      ) : (
        items.map((e) => <Card key={e.id} e={e} onOpen={() => router.push(`/experiences/${e.id}`)} />)
      )}

      {hasMore && (
        <button
          disabled={loading}
          onClick={() => load({ topic, stage, q, offset: nextOffset, append: true })}
          style={{ ...btnMore, marginTop: 6 }}
        >
          {loading ? "Loading…" : "Show more"}
        </button>
      )}

      {/* Bounded recency shelf — unfiltered entry view only */}
      {!filtered && shelf.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--light)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Recently added
          </div>
          {shelf.map((e) => <Card key={`s-${e.id}`} e={e} onOpen={() => router.push(`/experiences/${e.id}`)} compact />)}
        </div>
      )}

      <button onClick={() => router.push("/experiences/new")} style={{ ...btnWrite, marginTop: 24 }}>
        <PencilLine size={15} strokeWidth={2} /> Write your own
      </button>
    </Shell>
  );
}

function Card({ e, onOpen, compact }: { e: Item; onOpen: () => void; compact?: boolean }) {
  return (
    <div onClick={onOpen} style={{ ...card, marginBottom: 10, cursor: "pointer" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={chip}>{e.topic.replace(/_/g, " ").toLowerCase()}</span>
        {e.stageLabel && <span style={chipMuted}>{e.stageLabel}</span>}
        {e.helpedCount > 0 && (
          <span style={{ fontSize: 11, color: "var(--mid)", marginLeft: "auto" }}>
            {e.helpedCount} found this helpful
          </span>
        )}
      </div>
      <div style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.6, fontWeight: 600 }}>
        {e.situation.length > 150 ? e.situation.slice(0, 150) + "…" : e.situation}
      </div>
      {!compact && (
        <div style={{ fontSize: 12.5, color: "var(--mid)", lineHeight: 1.6, marginTop: 6 }}>
          {e.takeaway.length > 110 ? e.takeaway.slice(0, 110) + "…" : e.takeaway}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        {/* The byline. Always this, for every experience, without exception. */}
        <span style={{ fontSize: 11.5, color: "var(--light)", fontStyle: "italic" }}>a mother</span>
        <ChevronRight size={14} strokeWidth={2.5} color="var(--light)" />
      </div>
    </div>
  );
}

export default function ExperiencesPage() {
  return <Suspense fallback={null}><BrowseInner /></Suspense>;
}

function Shell({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 60 }}>
      <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 720, margin: "0 auto" }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <ArrowLeft size={16} strokeWidth={2} color="white" />
          </button>
          <div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white" }}>Experiences</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
              What mothers learned, for the mothers after them
            </div>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>{children}</div>
    </div>
  );
}

const card: React.CSSProperties = { background: "white", border: "1px solid var(--border)", borderRadius: 16, padding: 16 };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13, fontFamily: "inherit", color: "var(--ink)", background: "white" };
const chip: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: "#1a7a5e", background: "#e8f5f1", padding: "3px 8px", borderRadius: 20, textTransform: "capitalize" };
const chipMuted: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: "var(--mid)", background: "var(--bg)", padding: "3px 8px", borderRadius: 20 };
const btnPrimary: React.CSSProperties = { width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: "#1a7a5e", color: "white", fontSize: 13.5, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer" };
const btnSearch: React.CSSProperties = { padding: "0 16px", borderRadius: 10, border: "none", background: "#1a7a5e", color: "white", fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer" };
const btnMore: React.CSSProperties = { width: "100%", padding: "11px 0", borderRadius: 12, border: "1.5px solid var(--border)", background: "white", color: "var(--ink)", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", cursor: "pointer" };
const btnWrite: React.CSSProperties = { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 0", borderRadius: 12, border: "1.5px solid #1a7a5e", background: "white", color: "#1a7a5e", fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer" };
const pill = (active: boolean): React.CSSProperties => ({ padding: "7px 13px", borderRadius: 20, border: `1.5px solid ${active ? "#1a7a5e" : "var(--border)"}`, background: active ? "#1a7a5e" : "white", color: active ? "white" : "var(--mid)", fontSize: 12.5, fontWeight: 700, fontFamily: "Nunito, sans-serif", cursor: "pointer" });
