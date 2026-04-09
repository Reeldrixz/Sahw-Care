import twilio from "twilio";
import { Resend } from "resend";
import crypto from "crypto";

// ── Twilio Verify (SMS / phone) ──────────────────────────────────────────────

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) throw new Error("Twilio credentials not configured");
  return twilio(accountSid, authToken);
}

function getServiceSid(): string {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid) throw new Error("TWILIO_VERIFY_SERVICE_SID not configured");
  return sid;
}

/** Send an OTP to a phone number via Twilio Verify SMS. `to` must be E.164 format. */
export async function sendPhoneVerification(to: string): Promise<void> {
  const client = getTwilioClient();
  await client.verify.v2.services(getServiceSid()).verifications.create({ to, channel: "sms" });
}

/** Check a Twilio Verify phone OTP. Returns true if approved. */
export async function checkPhoneVerification(to: string, code: string): Promise<boolean> {
  const client = getTwilioClient();
  const check = await client.verify.v2
    .services(getServiceSid())
    .verificationChecks.create({ to, code });
  return check.status === "approved";
}

// ── Resend (email OTP) ───────────────────────────────────────────────────────

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not configured");
  return new Resend(key);
}

/** Generate a 6-digit numeric OTP. */
export function generateEmailOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/** OTP expiry date (default 10 minutes from now). */
export function getOtpExpiry(minutes = 10): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

export function isOtpExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/** Send a verification code to an email address via Resend. */
export async function sendEmailOtp(email: string, code: string): Promise<void> {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL ?? "Kradel <noreply@kradel.ng>";

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: `Your Kradel verification code: ${code}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#2d6a4f;margin-bottom:8px">Verify your email</h2>
        <p style="color:#555;margin-bottom:24px">
          Enter the code below in the Kradel app to verify your email address.
          It expires in 10 minutes.
        </p>
        <div style="background:#f0faf4;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#2d6a4f">${code}</span>
        </div>
        <p style="color:#999;font-size:12px">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}
