import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM    = process.env.EMAIL_FROM          ?? "Kradəl <onboarding@resend.dev>";
const NOTIFY  = process.env.ADMIN_NOTIFY_EMAIL  ?? "";

const JOURNEY_LABEL: Record<string, string> = {
  pregnant:   "Pregnant",
  postpartum: "Mother",
  donor:      "Donor",
};

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
