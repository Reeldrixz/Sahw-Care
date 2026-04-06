import crypto from "crypto";

export function generateOtp(): string {
  // 6-digit numeric OTP
  return crypto.randomInt(100000, 999999).toString();
}

export function getOtpExpiry(minutes = 10): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

export function isOtpExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Send OTP via SMS.
 * In development: logs to console and returns the OTP so the UI can surface it.
 * In production: integrate Termii / Africa's Talking / Twilio here.
 */
export async function sendOtpSms(phone: string, otp: string): Promise<string | null> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[OTP-SMS] ${phone} → ${otp}`);
    return otp; // returned so dev UI can show it
  }

  // Production: call your SMS provider
  // const res = await termii.sendSms({ to: phone, sms: `Your Kradel code: ${otp}` });
  throw new Error("SMS provider not configured. Set NODE_ENV=development or integrate a provider.");
}

/**
 * Send OTP via email.
 * In development: logs to console and returns the OTP.
 * In production: integrate Resend / Nodemailer here.
 */
export async function sendOtpEmail(email: string, otp: string): Promise<string | null> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[OTP-EMAIL] ${email} → ${otp}`);
    return otp;
  }

  // Production: call your email provider
  // await resend.emails.send({ to: email, subject: "Your Kradel verification code", text: `Code: ${otp}` });
  throw new Error("Email provider not configured. Set NODE_ENV=development or integrate a provider.");
}
