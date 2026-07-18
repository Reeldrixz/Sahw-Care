"use client";

import { useEffect, useRef, useState } from "react";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
  }
}

export default function GoogleSignInButton({
  onSuccess,
  onError,
  referralCode,
}: {
  onSuccess: () => void;
  onError?: (msg: string) => void;
  referralCode?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // Load the Google Identity Services script once.
  useEffect(() => {
    if (!CLIENT_ID) return;
    if (window.google?.accounts?.id) { setReady(true); return; }
    const existing = document.getElementById("gsi-script");
    if (existing) {
      existing.addEventListener("load", () => setReady(true));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.id = "gsi-script";
    s.onload = () => setReady(true);
    document.body.appendChild(s);
  }, []);

  // Initialize + render the button once the script is ready.
  useEffect(() => {
    if (!ready || !CLIENT_ID || !ref.current || !window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: async (resp: { credential?: string }) => {
        if (!resp.credential) { onError?.("Google sign-in was cancelled"); return; }
        try {
          const r = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: resp.credential, ...(referralCode ? { referralCode } : {}) }),
          });
          if (r.ok) {
            onSuccess();
          } else {
            const d = await r.json().catch(() => ({}));
            onError?.(d.error ?? "Google sign-in failed");
          }
        } catch {
          onError?.("Google sign-in failed");
        }
      },
    });

    window.google.accounts.id.renderButton(ref.current, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      width: 300,
      logo_alignment: "center",
    });
  }, [ready, onSuccess, onError, referralCode]);

  // When unconfigured, render nothing so the auth page stays clean.
  if (!CLIENT_ID) return null;

  return <div ref={ref} style={{ display: "flex", justifyContent: "center", minHeight: 44 }} />;
}
