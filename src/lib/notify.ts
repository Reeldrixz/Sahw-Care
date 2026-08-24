import { prisma } from "@/lib/prisma";
import { getResend } from "@/lib/resend";
import type { NotifType } from "@prisma/client";

// Reliable notification sending.
//
// The problem this replaces: `prisma.notification.create({...}).catch(() => {})`
// — un-awaited, so a serverless freeze after the response can drop the write,
// and the empty catch means the drop leaves no trace anywhere. For formula that
// meant a mother could silently never learn her product needed confirming, her
// request was declined, or her formula had shipped.
//
// Three rules, in order:
//   1. AWAIT — the send must finish before the handler returns, or it may never
//      happen at all.
//   2. LOG WITH CONTEXT — a drop must be searchable, never silent.
//   3. NEVER THROW — every caller sends only AFTER its state change has already
//      committed. Throwing here would fail a request whose work actually
//      succeeded, and the retry would hit an ALREADY_* guard and confuse the
//      admin. Callers get a result object and decide what to surface instead.

export interface NotifyEmail {
  to: string | null | undefined; // null/undefined => no email attempted
  subject: string;
  html: string;
}

export interface NotifyResult {
  inApp: boolean;
  email: boolean;
  /** False means she received nothing at all — worth telling the admin. */
  reached: boolean;
}

export async function notifyUser(opts: {
  userId: string;
  type: NotifType;
  message: string;
  link?: string;
  title?: string;
  email?: NotifyEmail | null;
  /** Short tag for log search, e.g. "formula:approve-link". */
  context: string;
}): Promise<NotifyResult> {
  let inApp = false;
  try {
    await prisma.notification.create({
      data: {
        userId:  opts.userId,
        type:    opts.type,
        message: opts.message,
        ...(opts.title && { title: opts.title }),
        ...(opts.link  && { link:  opts.link  }),
      },
    });
    inApp = true;
  } catch (err) {
    console.error(`[notify:${opts.context}] in-app failed for user ${opts.userId}`, err);
  }

  let email = false;
  if (opts.email?.to) {
    try {
      await getResend().emails.send({
        from:    process.env.RESEND_FROM_EMAIL ?? "noreply@kradel.care",
        to:      opts.email.to,
        subject: opts.email.subject,
        html:    opts.email.html,
      });
      email = true;
    } catch (err) {
      console.error(`[notify:${opts.context}] email failed for user ${opts.userId}`, err);
    }
  }

  if (!inApp && !email) {
    console.error(`[notify:${opts.context}] UNREACHED — user ${opts.userId} received nothing`);
  }
  return { inApp, email, reached: inApp || email };
}

// Fan out to every admin. Admins can always see true state in /admin, so a
// dropped admin ping is recoverable — it is logged but never surfaced in a
// response.
export async function notifyAdmins(opts: {
  title: string;
  message: string;
  link?: string;
  context: string;
}): Promise<{ sent: number }> {
  try {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    if (admins.length === 0) {
      console.warn(`[notify:${opts.context}] no admins found to notify`);
      return { sent: 0 };
    }
    const res = await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId:  a.id,
        type:    "ADMIN_MESSAGE" as NotifType,
        title:   opts.title,
        message: opts.message,
        link:    opts.link ?? "/admin",
      })),
    });
    return { sent: res.count };
  } catch (err) {
    console.error(`[notify:${opts.context}] admin fan-out failed`, err);
    return { sent: 0 };
  }
}
