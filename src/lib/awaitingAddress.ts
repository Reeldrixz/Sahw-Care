// The admin Awaiting address tab groups items by mother: one address
// confirmation covers every funded item of hers waiting for one, across all
// her registers (lib/addressConfirm).

export type AwaitingItem = { updatedAt: string; register: { creator: { id: string } } };

// One group per mother. Items oldest-waiting first within a group, and the
// group whose oldest item has waited longest first: the soonest to time out
// (14 days, the address-timeout cron) comes to the top.
export function groupByMother<T extends AwaitingItem>(items: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const i of items) {
    const k = i.register.creator.id;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  return [...groups.values()]
    .map((g) => [...g].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)))
    .sort((a, b) => a[0].updatedAt.localeCompare(b[0].updatedAt));
}
