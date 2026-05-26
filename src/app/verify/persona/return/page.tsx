"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&family=Nunito:wght@400;600;700;800&display=swap');
  .pr-page {
    font-family: 'Nunito', sans-serif;
    background: #faf8f3;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    color: #2a2a2a;
  }
  .pr-card {
    background: white;
    border-radius: 24px;
    border: 1px solid #ede8df;
    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    padding: 40px 32px;
    max-width: 420px;
    width: 100%;
    text-align: center;
  }
  .pr-icon { margin-bottom: 20px; }
  .pr-title {
    font-family: 'Lora', serif;
    font-size: 22px;
    font-weight: 700;
    color: #1a4a3a;
    margin-bottom: 12px;
    line-height: 1.3;
  }
  .pr-body {
    font-size: 14px;
    color: #6b7280;
    line-height: 1.65;
    margin-bottom: 28px;
  }
  .pr-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #e8f5ee;
    border: 1px solid #b6d9c7;
    border-radius: 20px;
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 800;
    color: #1a4a3a;
    margin-bottom: 28px;
  }
  .pr-link {
    display: block;
    background: #1a4a3a;
    color: white;
    border-radius: 14px;
    padding: 13px;
    font-size: 15px;
    font-weight: 800;
    text-decoration: none;
    transition: opacity 0.15s;
  }
  .pr-link:hover { opacity: 0.88; }
  .pr-link-ghost {
    display: block;
    margin-top: 12px;
    color: #6b7280;
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
  }
  .pr-link-ghost:hover { color: #1a4a3a; }
`;

function ReturnContent() {
  const params  = useSearchParams();
  const router  = useRouter();
  const status  = params.get("status"); // Persona appends ?status=completed|canceled|failed

  const isCanceled = status === "canceled";
  const isFailed   = status === "failed";
  const isNegative = isCanceled || isFailed;

  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    if (isNegative) return;
    const interval = setInterval(() => setCountdown((n) => n - 1), 1000);
    const timeout  = setTimeout(() => router.push("/profile"), 4000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [isNegative, router]);

  if (isNegative) {
    return (
      <div className="pr-card">
        <div className="pr-icon">
          <AlertCircle size={52} color="#e88c4b" strokeWidth={1.5} />
        </div>
        <div className="pr-title">
          {isCanceled ? "Verification canceled" : "Something went wrong"}
        </div>
        <div className="pr-body">
          {isCanceled
            ? "You closed the verification before it was complete. You can start again whenever you're ready."
            : "We ran into a problem completing your verification. Please try again — it usually only takes a minute."}
        </div>
        <Link href="/profile" className="pr-link">Try again</Link>
        <Link href="/" className="pr-link-ghost">Go home</Link>
      </div>
    );
  }

  return (
    <div className="pr-card">
      <div className="pr-icon">
        <CheckCircle size={52} color="#1a4a3a" strokeWidth={1.5} />
      </div>
      <div className="pr-pill">
        <Clock size={11} />
        Usually within a few minutes
      </div>
      <div className="pr-title">Thanks — we've received your verification</div>
      <div className="pr-body">
        We're reviewing your submission. You'll see your updated status on your profile — most verifications complete within a few minutes.
      </div>
      <Link href="/profile" className="pr-link">Back to my profile</Link>
      <div style={{ marginTop: 12, fontSize: 12, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>
        Redirecting in {countdown}s…
      </div>
    </div>
  );
}

export default function PersonaReturnPage() {
  return (
    <>
      <style>{styles}</style>
      <div className="pr-page">
        <Suspense
          fallback={
            <div className="pr-card">
              <div className="pr-icon">
                <Clock size={48} color="#1a4a3a" strokeWidth={1.5} />
              </div>
              <div className="pr-title">Checking your verification…</div>
            </div>
          }
        >
          <ReturnContent />
        </Suspense>
      </div>
    </>
  );
}
