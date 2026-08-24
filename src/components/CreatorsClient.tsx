"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import CreatorCodeOfConduct from "@/components/CreatorCodeOfConduct";
import CreatorDashboard from "@/components/CreatorDashboard";

// Palette (matches the public landing / partners pages)
const CREAM = "#faf6ee";
const INK = "#1f2a24";
const GREEN = "#1a7a5e";
const GREEN_SOFT = "#e8f5f1";
const MUTED = "#5a6b62";
const CARD_BORDER = "#ece4d3";
const SERIF = "Lora, Georgia, serif";
const SANS = "Nunito, sans-serif";

const card: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 18,
  padding: "26px 24px",
};

export default function CreatorsClient() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");
  const wantsCreator = searchParams.get("intent") === "creator";

  const [activatedCode, setActivatedCode] = useState<string | null>(null);
  const [showConduct, setShowConduct] = useState(false);
  const [copied, setCopied] = useState<"link" | "message" | null>(null);

  const isCreator = !!user?.isCreator || !!activatedCode;
  const myCode = activatedCode ?? user?.creatorReferralCode ?? null;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://sahw-care.vercel.app";
  const myLink = myCode ? `${origin}/creators?ref=${myCode}` : null;

  // Count a link visit for the creator behind ?ref= (public, rate-limited).
  useEffect(() => {
    if (!ref) return;
    fetch("/api/creators/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref }),
    }).catch(() => {});
  }, [ref]);

  // A logged-in, non-creator arriving with intent=creator (e.g. straight after
  // signing up through the program) drops right into the Code of Conduct.
  useEffect(() => {
    if (wantsCreator && user && !user.isCreator) setShowConduct(true);
  }, [wantsCreator, user]);

  const shareMessage = useMemo(() => {
    const link = myLink ?? `${origin}/creators`;
    return `Kradel helps mothers get the baby and maternity essentials they need, with dignity and privacy. If it speaks to you, take a look at what this community is building and consider supporting or sharing it: ${link}`;
  }, [myLink, origin]);

  const copy = async (text: string, which: "link" | "message") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard may be blocked; the text is visible to copy manually */
    }
  };

  // Signup entry: carry intent=creator (and any inbound creator ref) through auth.
  const becomeHref = `/auth?mode=signup&intent=creator${ref ? `&creatorRef=${encodeURIComponent(ref)}` : ""}`;
  const joinHref = `/auth?mode=signup${ref ? `&creatorRef=${encodeURIComponent(ref)}` : ""}`;

  // Viewer arrived through someone's shared link (and it isn't their own).
  const invited = !!ref && user?.creatorReferralCode !== ref;

  return (
    <div style={{ background: CREAM, minHeight: "100vh", padding: "0 16px 72px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <header style={{ textAlign: "center", padding: "48px 0 28px" }}>
          <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: GREEN }}>Kradəl</div>
          <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: MUTED, marginTop: 14 }}>
            Impact Creator Program
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 700, color: INK, lineHeight: 1.2, margin: "10px 0 0" }}>
            Use your voice to grow a kinder mission.
          </h1>
          <p style={{ fontFamily: SANS, fontSize: 16, color: MUTED, lineHeight: 1.65, margin: "14px auto 0", maxWidth: 560 }}>
            Impact Creators help more people discover Kradel. This is about awareness, not pressure. You share the mission honestly, and more mothers get to find the support they need.
          </p>
        </header>

        {/* Invited-visitor banner */}
        {invited && (
          <div style={{ ...card, background: GREEN_SOFT, borderColor: "#cfe9e0", marginBottom: 22 }}>
            <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: INK, marginBottom: 6 }}>
              Someone shared Kradel with you.
            </div>
            <p style={{ fontFamily: SANS, fontSize: 15, color: INK, lineHeight: 1.6, margin: "0 0 14px" }}>
              Kradel connects mothers with free baby and maternity essentials, privately and with dignity. You&rsquo;re welcome to join the mission, whether you want to support it or you need support yourself.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link href={joinHref} style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: "#fff", background: GREEN, borderRadius: 999, padding: "11px 22px", textDecoration: "none" }}>
                Join Kradel
              </Link>
              <Link href="/" style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: GREEN, background: "#fff", border: `1px solid ${GREEN}`, borderRadius: 999, padding: "11px 22px", textDecoration: "none" }}>
                Looking for support? Find help
              </Link>
            </div>
          </div>
        )}

        {/* What this is */}
        <section style={{ ...card, marginBottom: 18 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, margin: "0 0 10px" }}>What an Impact Creator does</h2>
          <p style={{ fontFamily: SANS, fontSize: 15, color: INK, lineHeight: 1.7, margin: 0 }}>
            You talk about the mission and let people know this platform exists. You encourage others to support it or to share it further. That&rsquo;s it. There are no quotas, no leaderboards, and no gamification. The goal is simply that more people know Kradel is here.
          </p>
        </section>

        {/* How it works */}
        <section style={{ ...card, marginBottom: 18 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, margin: "0 0 16px" }}>How it works</h2>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              ["Accept the Code of Conduct", "A short set of dignity rules that protect the mothers and babies this mission serves."],
              ["Get your creator link", "You receive a personal link to Kradel that you can share anywhere."],
              ["Share the mission", "People who discover Kradel through you become part of the same community."],
            ].map(([t, d], i) => (
              <li key={t} style={{ display: "flex", gap: 14 }}>
                <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 999, background: GREEN_SOFT, color: GREEN, fontFamily: SANS, fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <div>
                  <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 800, color: INK }}>{t}</div>
                  <div style={{ fontFamily: SANS, fontSize: 14, color: MUTED, lineHeight: 1.6, marginTop: 2 }}>{d}</div>
                </div>
              </li>
            ))}
          </ol>
          <div style={{ background: GREEN_SOFT, borderRadius: 12, padding: "13px 15px", marginTop: 18 }}>
            <p style={{ fontFamily: SANS, fontSize: 14, color: INK, lineHeight: 1.6, margin: 0 }}>
              Kradel is early. Your reach helps us grow, and creators who join now are the first to help shape how this works.
            </p>
          </div>
        </section>

        {/* Message template */}
        <section style={{ ...card, marginBottom: 18 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, margin: "0 0 6px" }}>A message you can share</h2>
          <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, lineHeight: 1.6, margin: "0 0 14px" }}>
            Honest and warm, with no pressure. Use it as-is or make it your own.
          </p>
          <div style={{ background: CREAM, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: "15px 16px", fontFamily: SANS, fontSize: 15, color: INK, lineHeight: 1.65 }}>
            {shareMessage}
          </div>
          <button
            onClick={() => copy(shareMessage, "message")}
            style={{ marginTop: 12, fontFamily: SANS, fontSize: 14, fontWeight: 700, color: GREEN, background: "#fff", border: `1px solid ${GREEN}`, borderRadius: 999, padding: "9px 18px", cursor: "pointer" }}
          >
            {copied === "message" ? "Copied" : "Copy message"}
          </button>
        </section>

        {/* Dignity note (public-facing summary of the guardrails) */}
        <section style={{ ...card, marginBottom: 18, borderColor: "#f0e6cf", background: "#fffdf6" }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: INK, margin: "0 0 10px" }}>Our one rule: protect dignity</h2>
          <p style={{ fontFamily: SANS, fontSize: 15, color: INK, lineHeight: 1.7, margin: 0 }}>
            Never share photos or stories of individual mothers or babies, and never use guilt or shock to get attention. We invite people to a mission. We do not put anyone&rsquo;s hardship on display. Every creator agrees to a short Code of Conduct before starting.
          </p>
        </section>

        {/* Become a creator / creator home */}
        <section id="become" style={{ ...card, borderColor: "#cfe9e0", background: GREEN_SOFT }}>
          {isCreator && myLink ? (
            <>
              <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, margin: "0 0 6px" }}>You&rsquo;re an Impact Creator</h2>
              <p style={{ fontFamily: SANS, fontSize: 15, color: INK, lineHeight: 1.6, margin: "0 0 14px" }}>
                Thank you for carrying this mission. Here is your personal link to share.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <code style={{ fontFamily: "monospace", fontSize: 14, color: INK, background: "#fff", border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: "10px 12px", flex: "1 1 240px", overflowX: "auto", whiteSpace: "nowrap" }}>
                  {myLink}
                </code>
                <button
                  onClick={() => copy(myLink, "link")}
                  style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: "#fff", background: GREEN, border: "none", borderRadius: 999, padding: "10px 20px", cursor: "pointer" }}
                >
                  {copied === "link" ? "Copied" : "Copy link"}
                </button>
              </div>

              <div style={{ borderTop: `1px solid #cfe9e0`, margin: "22px 0 0", paddingTop: 22 }}>
                <CreatorDashboard />
              </div>
            </>
          ) : showConduct && user ? (
            <CreatorCodeOfConduct onActivated={(code) => { setActivatedCode(code); setShowConduct(false); }} />
          ) : (
            <>
              <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, margin: "0 0 8px" }}>Become an Impact Creator</h2>
              <p style={{ fontFamily: SANS, fontSize: 15, color: INK, lineHeight: 1.6, margin: "0 0 16px" }}>
                Agree to a short Code of Conduct, get your link, and start sharing the mission.
              </p>
              {user ? (
                <button
                  onClick={() => setShowConduct(true)}
                  style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: "#fff", background: GREEN, border: "none", borderRadius: 999, padding: "12px 26px", cursor: "pointer" }}
                >
                  Become a Creator
                </button>
              ) : (
                <Link href={becomeHref} style={{ display: "inline-block", fontFamily: SANS, fontSize: 15, fontWeight: 700, color: "#fff", background: GREEN, borderRadius: 999, padding: "12px 26px", textDecoration: "none" }}>
                  Become a Creator
                </Link>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
