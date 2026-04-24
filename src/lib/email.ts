import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM    = process.env.EMAIL_FROM          ?? "Kradəl <onboarding@resend.dev>";
const NOTIFY  = process.env.ADMIN_NOTIFY_EMAIL  ?? "";

const JOURNEY_LABEL: Record<string, string> = {
  pregnant:   "Pregnant",
  postpartum: "Mother",
  donor:      "Donor",
};

// ── Password reset ───────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(opts: {
  firstName: string;
  email: string;
  resetUrl: string;
}) {
  return resend.emails.send({
    from:    FROM,
    to:      opts.email,
    subject: "Reset your Kradəl password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a7a5e;margin-bottom:8px">Reset your password</h2>
        <p style="color:#555;line-height:1.6">Hi ${opts.firstName},</p>
        <p style="color:#555;line-height:1.6">
          We received a request to reset your Kradəl password.
          Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.
        </p>
        <div style="text-align:center;margin:32px 0">
          <a href="${opts.resetUrl}"
             style="background:#1a7a5e;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
            Reset Password
          </a>
        </div>
        <p style="color:#555;font-size:13px;line-height:1.6">
          If you didn't request this, you can safely ignore this email — your password won't change.
        </p>
        <p style="color:#999;font-size:12px;margin-top:24px">Kradəl Care 🌱</p>
      </div>
    `,
  });
}

// ── Bundle notifications ─────────────────────────────────────────────────────

export async function sendBundleRequestReceived(opts: {
  firstName: string;
  email: string | null;
  templateName: string;
}) {
  if (!opts.email) return;
  await resend.emails.send({
    from:    FROM,
    to:      opts.email,
    subject: "Your Kradəl bundle request was received 💛",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a7a5e;margin-bottom:8px">We got your request! 💛</h2>
        <p style="color:#555;line-height:1.6">Hi ${opts.firstName},</p>
        <p style="color:#555;line-height:1.6">
          Your request for the <strong>${opts.templateName}</strong> bundle has been received.
          Our team will review it and get back to you within 1–2 business days.
        </p>
        <p style="color:#555;line-height:1.6">
          You can track the status of your bundle in the app under <strong>Full Care Bundles</strong>.
        </p>
        <p style="color:#999;font-size:12px;margin-top:24px">Kradəl Care — with you every step of the way 🌱</p>
      </div>
    `,
  });
}

export async function sendAdminNewBundleRequest(opts: {
  firstName: string;
  city: string;
  templateName: string;
  instanceId: string;
}) {
  if (!NOTIFY) return;
  await resend.emails.send({
    from:    FROM,
    to:      NOTIFY,
    subject: `New bundle request from ${opts.firstName} in ${opts.city}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-bottom:16px">New Bundle Request 📦</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#6b7280;width:140px">Name</td><td style="font-weight:600">${opts.firstName}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">City</td><td>${opts.city}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Bundle</td><td style="font-weight:600">${opts.templateName}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Instance ID</td><td style="font-size:12px;color:#9ca3af">${opts.instanceId}</td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px;margin-top:16px">Review in the admin panel → Bundles → Fulfillment Queue</p>
      </div>
    `,
  });
}

export async function sendBundleApproved(opts: {
  firstName: string;
  email: string | null;
  templateName: string;
}) {
  if (!opts.email) return;
  await resend.emails.send({
    from:    FROM,
    to:      opts.email,
    subject: "Your Kradəl bundle has been approved! 🎉",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a7a5e;margin-bottom:8px">Bundle approved! 🎉</h2>
        <p style="color:#555;line-height:1.6">Hi ${opts.firstName},</p>
        <p style="color:#555;line-height:1.6">
          Great news — your <strong>${opts.templateName}</strong> bundle has been approved
          and is being prepared for you. We'll send you another message as soon as it's on its way.
        </p>
        <p style="color:#999;font-size:12px;margin-top:24px">Kradəl Care 🌱</p>
      </div>
    `,
  });
}

export async function sendBundleShipped(opts: {
  firstName: string;
  email: string | null;
  templateName: string;
  trackingNumber: string | null;
}) {
  if (!opts.email) return;
  await resend.emails.send({
    from:    FROM,
    to:      opts.email,
    subject: "Your Kradəl bundle is on its way! 🚚",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a7a5e;margin-bottom:8px">Your bundle is on its way! 🚚</h2>
        <p style="color:#555;line-height:1.6">Hi ${opts.firstName},</p>
        <p style="color:#555;line-height:1.6">
          Your <strong>${opts.templateName}</strong> has been shipped and is heading to you.
          ${opts.trackingNumber ? `Your tracking number is <strong>${opts.trackingNumber}</strong>.` : ""}
        </p>
        <p style="color:#555;line-height:1.6">
          Once it arrives, please open the Kradəl app and confirm receipt so we can keep
          supporting more moms like you 💛
        </p>
        <p style="color:#999;font-size:12px;margin-top:24px">Kradəl Care 🌱</p>
      </div>
    `,
  });
}

// ── Signup notification ──────────────────────────────────────────────────────

export async function sendNewSignupNotification(opts: {
  firstName:   string;
  journeyType: string;
  signedUpAt:  Date;
  totalUsers:  number;
}) {
  if (!NOTIFY) return; // no-op if env var not set

  const { firstName, journeyType, signedUpAt, totalUsers } = opts;
  const label = JOURNEY_LABEL[journeyType] ?? journeyType;
  const ts    = signedUpAt.toLocaleString("en-GB", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  }) + " UTC";

  await resend.emails.send({
    from:    FROM,
    to:      NOTIFY,
    subject: "New Kradəl signup 🎉",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 16px">New signup on Kradəl 🎉</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:8px 0;color:#6b7280;width:140px">First name</td>
            <td style="padding:8px 0;font-weight:600">${firstName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280">Journey type</td>
            <td style="padding:8px 0;font-weight:600">${label}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280">Signed up</td>
            <td style="padding:8px 0">${ts}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280">Total users</td>
            <td style="padding:8px 0;font-weight:600">${totalUsers}</td>
          </tr>
        </table>
      </div>
    `,
  });
}
