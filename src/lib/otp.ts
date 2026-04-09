import twilio from "twilio";

function getClient() {
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

/**
 * Send an OTP via Twilio Verify.
 * channel: "sms" for phone numbers, "email" for email addresses.
 * `to` must be E.164 format for SMS (e.g. +2348012345678), or an email address.
 */
export async function sendVerification(to: string, channel: "sms" | "email"): Promise<void> {
  const client = getClient();
  await client.verify.v2.services(getServiceSid()).verifications.create({ to, channel });
}

/**
 * Check a Twilio Verify OTP.
 * Returns true if the code is correct and the verification is approved.
 */
export async function checkVerification(to: string, code: string): Promise<boolean> {
  const client = getClient();
  const check = await client.verify.v2
    .services(getServiceSid())
    .verificationChecks.create({ to, code });
  return check.status === "approved";
}
