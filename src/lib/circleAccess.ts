import { prisma } from "@/lib/prisma";

// Can this user read this circle — its posts, its live stream, the comments on
// its posts? The single read check for every circle GET handler.
//
// Allowed:
//   - an ADMIN, any circle
//   - a mother — role RECIPIENT, onboarding complete — who is
//       * a member of the circle (a CircleMember row), or
//       * graduated from it (graduatedCircleIds), or
//       * visiting a stage circle (Circle.stageKey set). /circles/all offers
//         every stage circle with a "Visit" button, so a mother may read any
//         of them. Country and other non-stage circles need membership.
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
export async function canReadCircle(userId: string, circleId: string): Promise<boolean> {
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
  if (!user || !circle) return false;

  if (user.role === "ADMIN") return true;
  if (user.role !== "RECIPIENT" || !user.onboardingComplete) return false;

  if (circle.stageKey) return true;                              // visiting a stage circle
  if (user.graduatedCircleIds.includes(circleId)) return true;

  const member = await prisma.circleMember.findUnique({
    where:  { userId_circleId: { userId, circleId } },
    select: { userId: true },
  });
  return member !== null;
}
