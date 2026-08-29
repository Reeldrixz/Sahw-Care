"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldAlert, HeartHandshake, Undo2, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  SAFETY_CATEGORIES,
  SEND_BACK_NOTE_MIN_LENGTH,
  type SafetyCategoryCode,
} from "@/lib/experienceSafety";

// The infant-safety review queue.
//
// This is the only surface where an Experiences author's identity appears, and
// only so a human can moderate and, in a crisis, reach out. It never becomes a
// byline: a published experience is written by "a mother", and nothing on it
// indicates whether she gave or received.
//
// The checklist is deliberately always on screen next to the text rather than
// hidden behind a toggle. The failure mode for this queue is not a reviewer who
// disagrees about a hazard — it is a tired reviewer at 11pm who simply does not
// think of unsafe sleep while reading a warm, well-written post. Keeping the
// prompts visible is the mitigation.

interface Author { id: string; name: string | null; email: string | null }
interface AiFlag { field: "situation" | "whatITried" | "takeaway" | "body"; quote: string; hazard: string; why: string }
interface PostItem {
  id: string; situation: string; whatITried: string; takeaway: string;
  topic: string; stageKey: string | null; stageLabel: string | null;
  status: string; reviewNote: string | null; rejectionReasonForAuthor: string | null;
  helpedCount: number; createdAt: string; reviewedAt: string | null; author: Author;
  aiVerdict: string | null; aiNote: string | null; aiFlags: AiFlag[] | null;
  aiCheckedAt: string | null; aiConfirmedByAdminId: string | null; aiConfirmedAt: string | null;
}
interface CommentItem {
  id: string; body: string; status: string;
  reviewNote: string | null; rejectionReasonForAuthor: string | null;
  createdAt: string; reviewedAt: string | null; author: Author;
  experience: { id: string; situation: string; status: string } | null;
  aiVerdict: string | null; aiNote: string | null; aiFlags: AiFlag[] | null;
  aiCheckedAt: string | null; aiConfirmedByAdminId: string | null; aiConfirmedAt: string | null;
}
type Item = PostItem | CommentItem;
const isPost = (i: Item): i is PostItem => "situation" in i;

type Kind = "posts" | "comments";
type StatusTab = "PENDING" | "PUBLISHED" | "REJECTED" | "DRAFT" | "HELD_FOR_SUPPORT" | "AI_FLAGGED";

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: "PENDING",          label: "Awaiting review" },
  { value: "AI_FLAGGED",       label: "Needs a second look" },
  { value: "PUBLISHED",        label: "Published"       },
  { value: "DRAFT",            label: "Sent back"       },
  { value: "REJECTED",         label: "Declined"        },
  { value: "HELD_FOR_SUPPORT", label: "Held for support" },
];

const HAZARD_LABEL: Record<string, string> = {
  UNSAFE_SLEEP: "Unsafe sleep",
  FEEDING:      "Feeding danger",
  MEDICAL:      "Medical",
  HAZARDS:      "Hazards & equipment",
};

// Render a field with the AI-flagged passages marked. Quotes were verified
// server-side as real substrings before storage, so a match is guaranteed to be
// real text from the post rather than something the model invented.
function highlight(text: string, quotes: string[]): React.ReactNode {
  if (!quotes.length) return text;
  const parts: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest.length) {
    let idx = -1, found = "";
    for (const q of quotes) {
      const i = rest.indexOf(q);
      if (q && i !== -1 && (idx === -1 || i < idx)) { idx = i; found = q; }
    }
    if (idx === -1) { parts.push(rest); break; }
    if (idx > 0) parts.push(rest.slice(0, idx));
    parts.push(
      <mark key={`h${key++}`} style={{ background: "#fecaca", color: "#7f1d1d", padding: "1px 2px", borderRadius: 3 }}>
        {found}
      </mark>
    );
    rest = rest.slice(idx + found.length);
  }
  return parts;
}

export default function AdminExperiencesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [kind,   setKind]   = useState<Kind>("posts");
  const [status, setStatus] = useState<StatusTab>("PENDING");
  const [items,  setItems]  = useState<Item[]>([]);
  const [counts, setCounts] = useState({ pendingPosts: 0, pendingComments: 0, aiFlagged: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId,  setBusyId]  = useState<string | null>(null);
  const [toast,   setToast]   = useState<string | null>(null);

  // Per-item draft state for the reviewer's inputs.
  const [categoryMap, setCategoryMap] = useState<Record<string, SafetyCategoryCode | "">>({});
  const [sendBackMap, setSendBackMap] = useState<Record<string, string>>({});
  const [noteMap,     setNoteMap]     = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "ADMIN")) router.push("/");
  }, [user, authLoading, router]);

  const fetchQueue = useCallback(async (k: Kind, s: StatusTab) => {
    setLoading(true);
    // no-store: this queue must reflect the database, not a cached view. A
    // stale list here means two reviewers deciding the same post.
    const r = await fetch(`/api/admin/experiences?kind=${k}&status=${s}`, { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      setItems(d.items ?? []);
      setCounts(d.counts ?? { pendingPosts: 0, pendingComments: 0, aiFlagged: 0 });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user?.role === "ADMIN") fetchQueue(kind, status);
  }, [kind, status, user, fetchQueue]);

  const decide = async (
    id: string,
    action: "approve" | "decline" | "send_back" | "hold_for_support"
  ) => {
    setBusyId(id);
    const r = await fetch(`/api/admin/experiences/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        kind: kind === "comments" ? "comment" : "post",
        safetyCategory: categoryMap[id] || undefined,
        sendBackNote:   sendBackMap[id] || undefined,
        reviewNote:     noteMap[id]     || undefined,
      }),
    });
    const d = await r.json().catch(() => ({}));
    setBusyId(null);

    if (!r.ok) { setToast(d.error ?? "Action failed"); return; }

    setItems((prev) => prev.filter((x) => x.id !== id));

    // The AI stopped the publish. She is told nothing — from her side the post
    // is still simply under review.
    if (d.aiBlocked) {
      setToast("Not published — the safety check flagged a passage. See “Needs a second look”.");
      setStatus("AI_FLAGGED");
      return;
    }
    if (d.warning)                 setToast(d.warning);
    else if (d.notified === false) setToast("Decision saved — but she received nothing. Follow up directly.");
    else if (d.aiUnavailable)      setToast(`Published — but the safety check did not run (${d.aiNote}). Recorded on the post.`);
    else setToast(
      action === "approve"          ? "Published"
      : action === "decline"        ? "Declined — she's been sent the message"
      : action === "send_back"      ? "Sent back to her drafts"
      : "Held for support — crisis message sent"
    );
    fetchQueue(kind, status);
  };

  if (authLoading || !user || user.role !== "ADMIN") return null;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 980, margin: "0 auto" }}>
          <button onClick={() => router.push("/admin")} style={btnIcon}>
            <ArrowLeft size={16} strokeWidth={2} color="white" />
          </button>
          <div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white" }}>
              Experiences review
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
              Nothing reaches another mother unread
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
        {/* Kind tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["posts", "comments"] as Kind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)} style={tab(kind === k)}>
              {k === "posts" ? "Posts" : "Comments"}
              {(k === "posts" ? counts.pendingPosts : counts.pendingComments) > 0 && (
                <span style={badge}>{k === "posts" ? counts.pendingPosts : counts.pendingComments}</span>
              )}
            </button>
          ))}
        </div>

        {/* Status tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {STATUS_TABS.map((s) => (
            <button key={s.value} onClick={() => setStatus(s.value)} style={pill(status === s.value)}>
              {s.label}
              {s.value === "AI_FLAGGED" && counts.aiFlagged > 0 && ` (${counts.aiFlagged})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: 40, color: "var(--mid)", fontSize: 13.5 }}>
            {status === "PENDING" ? "Nothing waiting. The queue is clear." : "Nothing here."}
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} style={{ ...card, marginBottom: 14 }}>
              {/* Author — admin-only, never a byline */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 12 }}>
                <div style={{ fontSize: 12, color: "var(--mid)" }}>
                  <strong style={{ color: "var(--ink)" }}>{item.author.name ?? "—"}</strong>
                  {item.author.email && <span> · {item.author.email}</span>}
                </div>
                <div style={{ fontSize: 11, color: "var(--light)", whiteSpace: "nowrap" }}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </div>
              </div>

              {/* Content */}
              {isPost(item) ? (
                <>
                  <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={chip}>{item.topic.replace(/_/g, " ").toLowerCase()}</span>
                    {item.stageLabel && <span style={chip}>{item.stageLabel}</span>}
                  </div>
                  <Field label="What was happening" value={item.situation}
                         quotes={quotesFor(item, "situation")} />
                  <Field label="What she tried"     value={item.whatITried}
                         quotes={quotesFor(item, "whatITried")} />
                  <Field label="What she'd tell another mother" value={item.takeaway}
                         quotes={quotesFor(item, "takeaway")} />
                </>
              ) : (
                <>
                  {item.experience && (
                    <div style={{ fontSize: 11.5, color: "var(--mid)", background: "var(--bg)", padding: "8px 10px", borderRadius: 8, marginBottom: 10 }}>
                      On: “{item.experience.situation.slice(0, 140)}”
                    </div>
                  )}
                  <Field label="Comment" value={item.body} quotes={quotesFor(item, "body")} />
                </>
              )}

              {/* What the AI stopped, and why. Shown above the checklist so the
                  reviewer reads the objection before the buttons. */}
              {item.status === "AI_FLAGGED" && (
                <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#fef2f2", border: "1.5px solid #fca5a5" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#991b1b", marginBottom: 8, fontFamily: "Nunito, sans-serif" }}>
                    <ShieldAlert size={14} strokeWidth={2.5} />
                    You approved this — the safety check stopped it
                  </div>
                  {item.aiNote && (
                    <div style={{ fontSize: 12, color: "#7f1d1d", lineHeight: 1.6, marginBottom: 8 }}>{item.aiNote}</div>
                  )}
                  <div style={{ display: "grid", gap: 6 }}>
                    {(item.aiFlags ?? []).map((f, i) => (
                      <div key={i} style={{ fontSize: 11.5, color: "#7f1d1d", lineHeight: 1.55 }}>
                        <strong>{HAZARD_LABEL[f.hazard] ?? f.hazard}</strong>
                        {" — "}{f.why}
                        <div style={{ marginTop: 2, fontStyle: "italic", opacity: 0.85 }}>“{f.quote}”</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: "#991b1b", marginTop: 10, lineHeight: 1.55 }}>
                    Highlighted above. She has <strong>not</strong> been told anything — from her side this is still
                    under review. Publish again to confirm, or change your decision.
                  </div>
                </div>
              )}

              {(status === "PENDING" || status === "AI_FLAGGED") && (
                <>
                  {/* The checklist — always visible, never behind a toggle */}
                  <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#9a3412", marginBottom: 8, fontFamily: "Nunito, sans-serif" }}>
                      <ShieldAlert size={14} strokeWidth={2.5} />
                      Would a baby be harmed if she followed this exactly?
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {SAFETY_CATEGORIES.filter((c) => c.isSafety).map((c) => (
                        <div key={c.code}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#7c2d12" }}>{c.label}</div>
                          <div style={{ fontSize: 11, color: "#9a3412", lineHeight: 1.55 }}>
                            {c.checks.join(" · ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Internal note — never shown to her */}
                  <textarea
                    placeholder="Internal note (never shown to her)"
                    value={noteMap[item.id] ?? ""}
                    onChange={(e) => setNoteMap((m) => ({ ...m, [item.id]: e.target.value }))}
                    style={{ ...input, marginTop: 12, minHeight: 44 }}
                  />

                  {/* Actions */}
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {/* On a first approve this submits for the final check, so
                        it no longer publishes instantly. On a flagged item it IS
                        the confirming second click and publishes immediately —
                        the check does not re-run. */}
                    <button
                      disabled={busyId === item.id}
                      onClick={() => decide(item.id, "approve")}
                      style={item.status === "AI_FLAGGED" ? btnConfirm : btnPrimary}
                    >
                      <Check size={14} strokeWidth={2.5} />
                      {busyId === item.id && item.status !== "AI_FLAGGED"
                        ? "Checking…"
                        : item.status === "AI_FLAGGED"
                          ? "Publish anyway — I've read the flag"
                          : "Approve & check"}
                    </button>

                    {/* Decline — requires a category, which fixes the copy she gets */}
                    <div style={row}>
                      <select
                        value={categoryMap[item.id] ?? ""}
                        onChange={(e) => setCategoryMap((m) => ({ ...m, [item.id]: e.target.value as SafetyCategoryCode }))}
                        style={{ ...input, flex: 1 }}
                      >
                        <option value="">Reason she&apos;ll be sent…</option>
                        {SAFETY_CATEGORIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.isSafety ? `Safety — ${c.label}` : c.label}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={busyId === item.id || !categoryMap[item.id]}
                        onClick={() => decide(item.id, "decline")}
                        style={btnSecondary(!!categoryMap[item.id])}
                      >
                        Decline
                      </button>
                    </div>

                    {/* Send back — posts only */}
                    {isPost(item) && (
                      <div style={row}>
                        <input
                          placeholder={`What one change would let it through? (min ${SEND_BACK_NOTE_MIN_LENGTH} chars)`}
                          value={sendBackMap[item.id] ?? ""}
                          onChange={(e) => setSendBackMap((m) => ({ ...m, [item.id]: e.target.value }))}
                          style={{ ...input, flex: 1 }}
                        />
                        <button
                          disabled={busyId === item.id || (sendBackMap[item.id] ?? "").trim().length < SEND_BACK_NOTE_MIN_LENGTH}
                          onClick={() => decide(item.id, "send_back")}
                          style={btnSecondary((sendBackMap[item.id] ?? "").trim().length >= SEND_BACK_NOTE_MIN_LENGTH)}
                        >
                          <Undo2 size={13} strokeWidth={2.5} /> Send back
                        </button>
                      </div>
                    )}

                    {/* Crisis — not a rejection */}
                    <button
                      disabled={busyId === item.id}
                      onClick={() => {
                        if (confirm("Hold this for support?\n\nShe'll be sent the crisis support message — 988, ConnexOntario, Postpartum Support International, 911 — and no verdict on her writing.\n\nThis is not a rejection.")) {
                          decide(item.id, "hold_for_support");
                        }
                      }}
                      style={btnCrisis}
                    >
                      <HeartHandshake size={14} strokeWidth={2.5} /> She seems to be in crisis — hold &amp; send support
                    </button>
                  </div>
                </>
              )}

              {/* Decided items: show what she was actually sent */}
              {status !== "PENDING" && item.rejectionReasonForAuthor && (
                <details style={{ marginTop: 12 }}>
                  <summary style={{ fontSize: 11.5, color: "var(--mid)", cursor: "pointer" }}>What she was sent</summary>
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 11.5, color: "var(--mid)", marginTop: 8, fontFamily: "inherit", lineHeight: 1.6 }}>
                    {item.rejectionReasonForAuthor}
                  </pre>
                </details>
              )}
              {/* Published without the gate running — fail-open, made visible. */}
              {item.aiVerdict === "UNAVAILABLE" && (
                <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "6px 9px", lineHeight: 1.5 }}>
                  ⚠ Safety check did not run{item.aiNote ? ` — ${item.aiNote}` : ""}
                </div>
              )}
              {/* Published over a flag by a human. */}
              {item.aiConfirmedAt && (
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--light)" }}>
                  Published over a safety flag on {new Date(item.aiConfirmedAt).toLocaleDateString()}
                </div>
              )}
              {status !== "PENDING" && item.reviewNote && (
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--light)" }}>
                  Internal: {item.reviewNote}
                </div>
              )}
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

function quotesFor(item: Item, field: AiFlag["field"]): string[] {
  if (item.status !== "AI_FLAGGED" || !item.aiFlags) return [];
  return item.aiFlags.filter((f) => f.field === field).map((f) => f.quote);
}

function Field({ label, value, quotes = [] }: { label: string; value: string; quotes?: string[] }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--light)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
        {highlight(value, quotes)}
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: "white", border: "1px solid var(--border)", borderRadius: 16, padding: 16 };
const row:  React.CSSProperties = { display: "flex", gap: 8, alignItems: "stretch" };
const chip: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: "#1a7a5e", background: "#e8f5f1", padding: "3px 8px", borderRadius: 20, textTransform: "capitalize" };
const input: React.CSSProperties = { padding: "9px 11px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 12.5, fontFamily: "inherit", width: "100%", background: "white", color: "var(--ink)" };
const btnIcon: React.CSSProperties = { background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center" };
const btnPrimary: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 12, border: "none", background: "#1a7a5e", color: "white", fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer" };
const btnConfirm: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 12, border: "1.5px solid #b91c1c", background: "#fef2f2", color: "#991b1b", fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer" };
const btnCrisis: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 12, border: "1.5px solid #be185d", background: "#fdf2f8", color: "#9d174d", fontSize: 12.5, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer" };
const btnSecondary = (enabled: boolean): React.CSSProperties => ({ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "9px 16px", borderRadius: 10, border: "1.5px solid var(--border)", background: "white", color: enabled ? "var(--ink)" : "var(--light)", fontSize: 12.5, fontWeight: 700, fontFamily: "Nunito, sans-serif", cursor: enabled ? "pointer" : "not-allowed", whiteSpace: "nowrap" });
const tab = (active: boolean): React.CSSProperties => ({ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 12, border: `1.5px solid ${active ? "#1a7a5e" : "var(--border)"}`, background: active ? "#e8f5f1" : "white", color: active ? "#1a7a5e" : "var(--mid)", fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer" });
const pill = (active: boolean): React.CSSProperties => ({ padding: "6px 12px", borderRadius: 20, border: `1px solid ${active ? "#1a7a5e" : "var(--border)"}`, background: active ? "#1a7a5e" : "white", color: active ? "white" : "var(--mid)", fontSize: 11.5, fontWeight: 700, fontFamily: "Nunito, sans-serif", cursor: "pointer" });
const badge: React.CSSProperties = { background: "#be185d", color: "white", fontSize: 10.5, fontWeight: 800, padding: "1px 7px", borderRadius: 20 };
const toastStyle: React.CSSProperties = { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#0d3d2e", color: "white", padding: "12px 18px", borderRadius: 12, fontSize: 12.5, fontWeight: 600, maxWidth: 460, cursor: "pointer", zIndex: 100, lineHeight: 1.5 };
