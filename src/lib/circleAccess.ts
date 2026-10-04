import { prisma } from "@/lib/prisma";

// Who may read, and who may write, in a circle. The single access rule for
// every circle route.
//
// A mother — role RECIPIENT, onboarding complete — may use a circle when she
//   * is a member of it (a CircleMember row), or
//   * has graduated from it (graduatedCircleIds), or
//   * is visiting a stage circle (Circle.stageKey set). /circles/all offers
//     every stage circle with a "Visit" button. Non-stage circles (country
//     circles) need membership.
// An ADMIN may read any circle, but does not take part: writing (commenting,
// liking, reacting, reporting) is for mothers only.
// Everyone else is refused, and callers answer 404 so a refusal does not
// confirm the circle exists.
//
// Role, not journeyType, decides "mother": journeyType is a display preference
// a mother can switch to "giver" on /profile/journey without stopping being a
// mother, and a donor who has not finished onboarding has none at all.
//
// Reading never creates a membership. Visiting used to insert a READ_COMMENT
// CircleMember row on first view, which then made the visitor look like a
// member; it no longer does.
//
// Posting a NEW post is narrower than writing and is checked in the posts
// route: only in her current circle (currentCircleId).

type Access = "admin" | "mother" | null;

async function circleAccess(userId: string, circleId: string): Promise<Access> {
  const [user, circle] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: userId },
      select: { role: true, onboardingComplete: true, graduatedCircleIds: true },
    }),
    prisma.circle.findUnique({
      where:  { id: circleId },
      select: { id: true, stageKey: true },
    }),
  ]);
  if (!user || !circle) return null;

  if (user.role === "ADMIN") return "admin";
  if (user.role !== "RECIPIENT" || !user.onboardingComplete) return null;

  if (circle.stageKey) return "mother";                              // visiting a stage circle
  if (user.graduatedCircleIds.includes(circleId)) return "mother";

  const member = await prisma.circleMember.findUnique({
    where:  { userId_circleId: { userId, circleId } },
    select: { userId: true },
  });
  return member ? "mother" : null;
}

// Posts, the live stream, comments.
export async function canReadCircle(userId: string, circleId: string): Promise<boolean> {
  return (await circleAccess(userId, circleId)) !== null;
}

// Commenting, liking, reacting, reporting. Same rule, mothers only.
export async function canWriteInCircle(userId: string, circleId: string): Promise<boolean> {
  return (await circleAccess(userId, circleId)) === "mother";
}
