import { getResend } from "@/lib/resend";

const FROM    = process.env.RESEND_FROM_EMAIL   ?? "noreply@kradel.care";
const NOTIFY  = process.env.ADMIN_NOTIFY_EMAIL  ?? "";

// Escape user-supplied values before interpolating them into email HTML (text
// or attribute context). Prevents markup/attribute injection into emails.
function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  const { error } = await getResend().emails.send({
    from:    FROM,
    to:      opts.email,
    subject: "Reset your Kradel password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a7a5e;margin-bottom:8px">Reset your password</h2>
        <p style="color:#555;line-height:1.6">Hi ${esc(opts.firstName)},</p>
        <p style="color:#555;line-height:1.6">
          We received a request to reset your Kradel password.
          Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.
        </p>
        <div style="text-align:center;margin:32px 0">
          <a href="${opts.resetUrl}"
             style="background:#1a7a5e;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
            Reset Password
          </a>
        </div>
        <p style="color:#555;font-size:13px;line-height:1.6">
          If you didn't request this, you can safely ignore this email. Your password won't change.
        </p>
        <p style="color:#999;font-size:12px;margin-top:24px">Kradel Care</p>
      </div>
    `,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

// ── Welcome email ────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(opts: { name: string; email: string }) {
  const firstName = opts.name.split(" ")[0];
  const { error } = await getResend().emails.send({
    from:    FROM,
    to:      opts.email,
    subject: "Welcome to Kradel",
    html: `
      <div style="background:#faf8f3;padding:40px 16px;font-family:sans-serif">
        <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:40px 32px">
          <p style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;color:#1a1a1a;margin:0 0 24px">
            Welcome, ${esc(firstName)}.
          </p>
          <p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 16px">
            Kradel is a care community where mothers receive support from people who want to help:
            essentials, registers, and connections that make the early days a little easier.
          </p>
          <p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 32px">
            Your account is ready. Take a look around whenever you are.
          </p>
          <div style="border-top:1px solid #ede8df;padding-top:24px">
            <p style="color:#999;font-size:13px;margin:0">Kradel Care</p>
          </div>
        </div>
      </div>
    `,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

// ── Circle reply notification ────────────────────────────────────────────────

export async function sendCircleReplyEmail(opts: {
  firstName:   string;
  email:       string | null;
  replierName: string;
  snippet:     string;
}) {
  if (!opts.email) return;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sahw-care.vercel.app";
  const safeSnippet = opts.snippet.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const { error } = await getResend().emails.send({
    from:    FROM,
    to:      opts.email,
    subject: `${esc(opts.replierName)} replied to your comment on Kradel`,
    html: `
      <div style="background:#faf8f3;padding:40px 16px;font-family:sans-serif">
        <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:36px 32px">
          <p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#1a1a1a;margin:0 0 16px">
            ${esc(opts.replierName)} replied to your comment
          </p>
          <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 16px">Hi ${esc(opts.firstName)},</p>
          <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 16px">
            Someone in your circle replied to a comment you left:
          </p>
          <div style="background:#f5f5f0;border-left:3px solid #1a7a5e;border-radius:8px;padding:14px 16px;color:#333;font-size:14px;line-height:1.6;margin:0 0 24px;white-space:pre-wrap">${safeSnippet}</div>
          <div style="text-align:center;margin:0 0 8px">
            <a href="${appUrl}/circles"
               style="background:#1a7a5e;color:#fff;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
              View the conversation
            </a>
          </div>
          <p style="color:#999;font-size:12px;margin-top:24px">Kradel Care</p>
        </div>
      </div>
    `,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

// ── Bundle notifications ─────────────────────────────────────────────────────

export async function sendBundleRequestReceived(opts: {
  firstName: string;
  email: string | null;
  templateName: string;
}) {
  if (!opts.email) return;
  const { error } = await getResend().emails.send({
    from:    FROM,
    to:      opts.email,
    subject: "Your Kradel bundle request was received",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a7a5e;margin-bottom:8px">We received your request</h2>
        <p style="color:#555;line-height:1.6">Hi ${esc(opts.firstName)},</p>
        <p style="color:#555;line-height:1.6">
          Your request for the <strong>${esc(opts.templateName)}</strong> bundle has been received.
          Our team will review it and get back to you within 1 to 2 business days.
        </p>
        <p style="color:#555;line-height:1.6">
          You can track the status of your bundle in the app under <strong>Full Care Bundles</strong>.
        </p>
        <p style="color:#999;font-size:12px;margin-top:24px">Kradel Care</p>
      </div>
    `,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

export async function sendAdminNewBundleRequest(opts: {
  firstName: string;
  city: string;
  templateName: string;
  instanceId: string;
}) {
  if (!NOTIFY) return;
  const { error } = await getResend().emails.send({
    from:    FROM,
    to:      NOTIFY,
    subject: `New bundle request from ${esc(opts.firstName)} in ${esc(opts.city)}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-bottom:16px">New Bundle Request</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#6b7280;width:140px">Name</td><td style="font-weight:600">${esc(opts.firstName)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">City</td><td>${esc(opts.city)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Bundle</td><td style="font-weight:600">${esc(opts.templateName)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Instance ID</td><td style="font-size:12px;color:#9ca3af">${opts.instanceId}</td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px;margin-top:16px">Review in the admin panel → Bundles → Fulfillment Queue</p>
      </div>
    `,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

export async function sendBundleApproved(opts: {
  firstName: string;
  email: string | null;
  templateName: string;
}) {
  if (!opts.email) return;
  const { error } = await getResend().emails.send({
    from:    FROM,
    to:      opts.email,
    subject: "Your Kradel bundle has been approved",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a7a5e;margin-bottom:8px">Your bundle has been approved</h2>
        <p style="color:#555;line-height:1.6">Hi ${esc(opts.firstName)},</p>
        <p style="color:#555;line-height:1.6">
          Your <strong>${esc(opts.templateName)}</strong> bundle has been approved
          and is being prepared for you. We'll send you another message as soon as it's on its way.
        </p>
        <p style="color:#999;font-size:12px;margin-top:24px">Kradel Care</p>
      </div>
    `,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

export async function sendBundleShipped(opts: {
  firstName: string;
  email: string | null;
  templateName: string;
  trackingNumber: string | null;
}) {
  if (!opts.email) return;
  const { error } = await getResend().emails.send({
    from:    FROM,
    to:      opts.email,
    subject: "Your Kradel bundle is on its way",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a7a5e;margin-bottom:8px">Your bundle is on its way</h2>
        <p style="color:#555;line-height:1.6">Hi ${esc(opts.firstName)},</p>
        <p style="color:#555;line-height:1.6">
          Your <strong>${esc(opts.templateName)}</strong> has been shipped and is heading to you.
          ${opts.trackingNumber ? `Your tracking number is <strong>${esc(opts.trackingNumber)}</strong>.` : ""}
        </p>
        <p style="color:#555;line-height:1.6">
          Once it arrives, please open the Kradel app and confirm receipt so we can keep
          supporting more moms like you.
        </p>
        <p style="color:#999;font-size:12px;margin-top:24px">Kradel Care</p>
      </div>
    `,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

// ── Bug report admin notification ────────────────────────────────────────────

export async function sendBugReportNotification(opts: {
  reportId:    string;
  description: string;
  pageUrl:     string | null;
  userAgent:   string | null;
  screenshotUrl: string | null;
  submittedBy: string;
  submittedAt: Date;
  baseUrl:     string;
}) {
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn("[BugReport] ADMIN_NOTIFY_EMAIL not set — skipping email notification for report", opts.reportId);
    return;
  }

  const ts = opts.submittedAt.toLocaleString("en-GB", {
    timeZone: "UTC", dateStyle: "medium", timeStyle: "short",
  }) + " UTC";

  const { error } = await getResend().emails.send({
    from:    FROM,
    to:      adminEmail,
    subject: `[Kradel Bug] New report from ${esc(opts.submittedBy)}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 16px;color:#1a1a1a">New Bug Report</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr><td style="padding:8px 0;color:#6b7280;width:120px;vertical-align:top">User</td><td style="padding:8px 0;font-weight:600">${esc(opts.submittedBy)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;vertical-align:top">Page</td><td style="padding:8px 0">${opts.pageUrl ? `<a href="${esc(opts.pageUrl)}" style="color:#1a7a5e">${esc(opts.pageUrl)}</a>` : "N/A"}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;vertical-align:top">Time</td><td style="padding:8px 0">${ts}</td></tr>
        </table>
        <div style="margin-bottom:20px">
          <div style="font-weight:700;color:#1a1a1a;margin-bottom:8px">Description</div>
          <div style="background:#f5f5f5;border-radius:8px;padding:14px;font-size:14px;line-height:1.6;white-space:pre-wrap;color:#333">${opts.description.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr><td style="padding:8px 0;color:#6b7280;width:120px;vertical-align:top">Browser</td><td style="padding:8px 0;font-size:12px;color:#555">${esc(opts.userAgent ?? "N/A")}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;vertical-align:top">Screenshot</td><td style="padding:8px 0">${opts.screenshotUrl ? `<a href="${opts.screenshotUrl}" style="color:#1a7a5e">View screenshot</a>` : "none"}</td></tr>
        </table>
        <div style="text-align:center;margin-top:24px">
          <a href="${opts.baseUrl}/admin/bug-reports" style="background:#1a7a5e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
            View in Admin Queue
          </a>
        </div>
        <p style="color:#999;font-size:12px;margin-top:24px">Kradel Care</p>
      </div>
    `,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

// ── Signup notification ──────────────────────────────────────────────────────

export async function sendNewSignupNotification(opts: {
  firstName:   string;
  journeyType: string;
  signedUpAt:  Date;
  totalUsers:  number;
}) {
  if (!NOTIFY) return;

  const { firstName, journeyType, signedUpAt, totalUsers } = opts;
  const label = JOURNEY_LABEL[journeyType] ?? journeyType;
  const ts    = signedUpAt.toLocaleString("en-GB", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  }) + " UTC";

  const { error } = await getResend().emails.send({
    from:    FROM,
    to:      NOTIFY,
    subject: "New Kradel signup",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 16px">New signup on Kradel</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:8px 0;color:#6b7280;width:140px">First name</td>
            <td style="padding:8px 0;font-weight:600">${esc(firstName)}</td>
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
  if (error) throw new Error(`Resend error: ${error.message}`);
}
