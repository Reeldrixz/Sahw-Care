// Due-date wording for anyone but the mother herself: rough only, never a day
// or a month. Pure (no server imports), so pages and server shapes share it.

const DAY = 86_400_000;

// The register page's line: "Due in 6 weeks", "Due this week", "Newborn · 3 weeks old".
export function stageLine(dueDate: Date, now = new Date()): string {
  const diffDays = Math.round((dueDate.getTime() - now.getTime()) / DAY);
  if (diffDays > 0) {
    const weeks = Math.round(diffDays / 7);
    return weeks <= 1 ? "Due this week" : `Due in ${weeks} weeks`;
  }
  return `Newborn · ${Math.abs(Math.round(diffDays / 7))} weeks old`;
}

// The browse and saved lists: "Newborn · 3w old", "Due soon" (within
// DUE_SOON_DAYS, the same window as the browse page's "Due soon" tab) or
// "Due in 9 weeks".
export const DUE_SOON_DAYS = 42;
export function browseDueLabel(dueDate: Date, now = new Date()): string {
  const diffDays = Math.round((dueDate.getTime() - now.getTime()) / DAY);
  if (diffDays < 0) return `Newborn · ${Math.abs(Math.round(diffDays / 7))}w old`;
  if (diffDays <= DUE_SOON_DAYS) return "Due soon";
  return `Due in ${Math.round(diffDays / 7)} weeks`;
}
export const isDueSoon = (dueDate: Date, now = new Date()) => Math.round((dueDate.getTime() - now.getTime()) / DAY) <= DUE_SOON_DAYS;
