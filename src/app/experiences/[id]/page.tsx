"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { COMMENT_MIN, COMMENT_MAX, COMMENT_PLACEHOLDER, COMMENT_SUBMITTED_NOTE } from "@/lib/experienceSafety";

// One experience, read in full.
//
// The byline is "a mother" and nothing on this page indicates whether she gave
// or received, how she came to Kradel, or anything else about her. That is
// enforced upstream: the API never selects author or authorId, so there is no
// identity in the payload to render even by accident.
//
// The one exception is "This is yours", shown only to the author herself from a
// server-computed boolean. It tells the reader something about herself and
// nothing about anyone else.

interface Experience {
  id: string; situation: string; whatITried: string; takeaway: string;
  topic: string; stageKey: string | null; stageLabel: string | null;
  helpedCount: number; publishedAt: string | null; isMine: boolean;
  hasMarkedHelpful: boolean;
}

export default function ExperienceDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [experience, setExperience] = useState<Experience | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const [comments,     setComments]     = useState<{ id: string; body: string }[]>([]);
  const [myPending,    setMyPending]    = useState<{ id: string; body: string }[]>([]);
  const [commentText,  setCommentText]  = useState("");
  const [posting,      setPosting]      = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentDone,  setCommentDone]  = useState(false);

  const loadComments = useCallback(async () => {
    const r = await fetch(`/api/experiences/${id}/comments`, { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      setComments(d.comments ?? []);
      setMyPending(d.myPending ?? []);
    }
  }, [id]);

  const postComment = async () => {
    setPosting(true);
    setCommentError(null);
    const r = await fetch(`/api/experiences/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentText.trim() }),
    });
    const d = await r.json().catch(() => ({}));
    setPosting(false);
    if (!r.ok) { setCommentError(d.error ?? "Something went wrong."); return; }
    setCommentText("");
    setCommentDone(true);
    loadComments();
  };

  // Optimistic on the way out, reconciled with the server's count on the way
  // back — the count is the ranking input, so the server's number wins.
  const toggleHelpful = async () => {
    if (!experience || marking) return;
    setMarking(true);
    const optimistic = !experience.hasMarkedHelpful;
    setExperience({
      ...experience,
      hasMarkedHelpful: optimistic,
      helpedCount: Math.max(0, experience.helpedCount + (optimistic ? 1 : -1)),
    });

    const r = await fetch(`/api/experiences/${experience.id}/helpful`, {
      method: "POST",
      cache: "no-store",
    });
    if (r.ok) {
      const d = await r.json();
      setExperience((prev) => prev && { ...prev, hasMarkedHelpful: d.marked, helpedCount: d.helpedCount });
    } else {
      // Roll back rather than leave her looking at a state the server rejected.
      setExperience((prev) => prev && {
        ...prev,
        hasMarkedHelpful: !optimistic,
        helpedCount: Math.max(0, prev.helpedCount + (optimistic ? -1 : 1)),
      });
    }
    setMarking(false);
  };

  useEffect(() => {
    if (!authLoading && !user) router.push("/");
  }, [user, authLoading, router]);

  const load = useCallback(async () => {
    const r = await fetch(`/api/experiences/${id}`, { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      setExperience(d.experience);
    } else if (r.status === 404) {
      setError("This experience isn't available.");
    } else {
      const d = await r.json().catch(() => ({}));
      setError(d.error ?? "Something went wrong.");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { if (user) { load(); loadComments(); } }, [user, load, loadComments]);

  if (authLoading || !user) return null;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 60 }}>
      <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 680, margin: "0 auto" }}>
          <button onClick={() => router.push("/experiences")} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <ArrowLeft size={16} strokeWidth={2} color="white" />
          </button>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white" }}>
            An experience
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: 16 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><div className="spinner" /></div>
        ) : error || !experience ? (
          <div style={{ ...card, textAlign: "center", padding: 32 }}>
            <p style={{ fontSize: 13.5, color: "var(--mid)", margin: 0, lineHeight: 1.7 }}>{error}</p>
            <button onClick={() => router.push("/experiences")} style={{ ...btnBack, marginTop: 16 }}>
              Back to Experiences
            </button>
          </div>
        ) : (
          <>
            <div style={card}>
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
                <span style={chip}>{experience.topic.replace(/_/g, " ").toLowerCase()}</span>
                {experience.stageLabel && <span style={chipMuted}>{experience.stageLabel}</span>}
                {experience.isMine && <span style={chipMine}>This is yours</span>}
              </div>

              <Section label="What was happening"  value={experience.situation} />
              <Section label="What she tried"      value={experience.whatITried} />
              <Section label="What she'd tell another mother" value={experience.takeaway} highlight />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12.5, color: "var(--light)", fontStyle: "italic" }}>a mother</span>
                {experience.helpedCount > 0 && (
                  <span style={{ fontSize: 12, color: "var(--mid)" }}>
                    {experience.helpedCount} found this helpful
                  </span>
                )}
              </div>
            </div>

            {/* "This helped" — detail only, never on a browse card. Marking
                something helpful from a 150-character preview is not a real
                signal, and this count is the ranking input for every browse
                query. Her own experience is excluded: helpedCount should mean
                "this helped someone else". */}
            {!experience.isMine && (
              <button
                onClick={toggleHelpful}
                disabled={marking}
                style={experience.hasMarkedHelpful ? btnHelpedOn : btnHelpedOff}
              >
                <Heart
                  size={15}
                  strokeWidth={2.5}
                  fill={experience.hasMarkedHelpful ? "#1a7a5e" : "none"}
                />
                {experience.hasMarkedHelpful ? "You found this helpful" : "This helped me"}
              </button>
            )}

            {/* Comments. Every one has passed the same two gates as a post:
                a human reviewer, then the AI final check. The byline is "a
                mother" here too — the API never selects author. */}
            <div style={{ marginTop: 26 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--light)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                {comments.length > 0
                  ? `${comments.length} ${comments.length === 1 ? "mother added" : "mothers added"} to this`
                  : "Add what this missed"}
              </div>

              {comments.map((c) => (
                <div key={c.id} style={{ ...card, marginBottom: 8, padding: 14 }}>
                  <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{c.body}</div>
                  <div style={{ fontSize: 11.5, color: "var(--light)", fontStyle: "italic", marginTop: 8 }}>a mother</div>
                </div>
              ))}

              {/* Hers, still in review. Shown only to her, so a comment she
                  wrote does not appear to have vanished. */}
              {myPending.map((c) => (
                <div key={c.id} style={{ ...card, marginBottom: 8, padding: 14, background: "#fffbeb", border: "1px solid #fde68a" }}>
                  <div style={{ fontSize: 13.5, color: "#78350f", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{c.body}</div>
                  <div style={{ fontSize: 11.5, color: "#92400e", marginTop: 8, fontWeight: 700 }}>
                    Waiting to be published — only you can see this
                  </div>
                </div>
              ))}

              {commentDone ? (
                <div style={{ ...card, padding: 14, fontSize: 12.5, color: "var(--mid)", lineHeight: 1.6 }}>
                  {COMMENT_SUBMITTED_NOTE}
                </div>
              ) : (
                <div style={{ ...card, padding: 14 }}>
                  <textarea
                    value={commentText}
                    maxLength={COMMENT_MAX}
                    placeholder={COMMENT_PLACEHOLDER}
                    onChange={(e) => setCommentText(e.target.value)}
                    style={{ width: "100%", minHeight: 78, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13.5, fontFamily: "inherit", lineHeight: 1.65, color: "var(--ink)", background: "white", resize: "vertical" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <span style={{ fontSize: 10.5, color: "var(--light)" }}>
                      {commentText.trim().length < COMMENT_MIN
                        ? `At least ${COMMENT_MIN} characters`
                        : `${commentText.trim().length}/${COMMENT_MAX}`}
                    </span>
                    <button
                      disabled={commentText.trim().length < COMMENT_MIN || posting}
                      onClick={postComment}
                      style={{
                        padding: "8px 16px", borderRadius: 10, border: "none",
                        background: commentText.trim().length >= COMMENT_MIN ? "#1a7a5e" : "var(--border)",
                        color: "white", fontSize: 12.5, fontWeight: 800, fontFamily: "Nunito, sans-serif",
                        cursor: commentText.trim().length >= COMMENT_MIN ? "pointer" : "not-allowed",
                      }}
                    >
                      {posting ? "Sending…" : "Add"}
                    </button>
                  </div>
                  {commentError && (
                    <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 8, lineHeight: 1.55 }}>{commentError}</div>
                  )}
                </div>
              )}
            </div>

            <p style={{ fontSize: 11.5, color: "var(--light)", lineHeight: 1.65, textAlign: "center", margin: "16px auto 0", maxWidth: 460 }}>
              Every experience here is read by our team before it&apos;s published. It&apos;s one
              mother&apos;s experience, not medical advice — if something worries you about your
              baby, please speak to a healthcare provider.
            </p>

            <button onClick={() => router.push("/experiences")} style={{ ...btnBack, marginTop: 18 }}>
              Back to Experiences
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--light)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5 }}>
        {label}
      </div>
      <div style={{
        fontSize: 14, color: "var(--ink)", lineHeight: 1.75, whiteSpace: "pre-wrap",
        ...(highlight ? { background: "#e8f5f1", borderRadius: 12, padding: "12px 14px" } : {}),
      }}>
        {value}
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: "white", border: "1px solid var(--border)", borderRadius: 16, padding: 18 };
const chip: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: "#1a7a5e", background: "#e8f5f1", padding: "3px 8px", borderRadius: 20, textTransform: "capitalize" };
const chipMuted: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: "var(--mid)", background: "var(--bg)", padding: "3px 8px", borderRadius: 20 };
const chipMine: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", padding: "3px 8px", borderRadius: 20 };
const btnBack: React.CSSProperties = { width: "100%", padding: "12px 0", borderRadius: 12, border: "1.5px solid var(--border)", background: "white", color: "var(--ink)", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", cursor: "pointer" };
const btnHelpedOff: React.CSSProperties = { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 0", marginTop: 14, borderRadius: 12, border: "1.5px solid var(--border)", background: "white", color: "var(--ink)", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", cursor: "pointer" };
const btnHelpedOn: React.CSSProperties = { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 0", marginTop: 14, borderRadius: 12, border: "1.5px solid #1a7a5e", background: "#e8f5f1", color: "#1a7a5e", fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer" };
