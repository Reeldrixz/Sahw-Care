/**
 * Tiny external store that lets sensitive UI (the bundle apply modal, the
 * register fund panel, the Stripe redirect) hide the floating beta feedback
 * pill while they're on screen. Ref-counted so overlapping suppressors nest
 * safely. Consumed via useSyncExternalStore — getServerSnapshot returns false,
 * so the pill's server and initial-client render agree (no hydration risk).
 */
let count = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Call when a sensitive surface opens; run the returned fn when it closes. */
export function suppressFeedback(): () => void {
  count += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    count = Math.max(0, count - 1);
    emit();
  };
}

export function subscribeFeedbackSuppress(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getFeedbackSuppressed(): boolean {
  return count > 0;
}

export function getFeedbackSuppressedServer(): boolean {
  return false;
}
