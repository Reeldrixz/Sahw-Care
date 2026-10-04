// Placement for a small popover anchored to a button, in viewport (fixed)
// coordinates. Used by the circle post report popover.

export const POPOVER_MAX_WIDTH = 300;
export const POPOVER_GAP       = 6;   // between the "..." button and the popover
export const VIEWPORT_MARGIN   = 8;   // kept clear at the screen edges and above the nav

export type PopoverPos = { top: number; left: number; width: number; maxHeight?: number };

// Where the popover goes, in viewport coordinates, given the "..." button's
// rect and the popover's measured height. Opens upward when it fits above the
// button, otherwise downward; if neither side fits whole, uses the larger side
// and scrolls inside. The bottom limit is the top of the bottom nav when it is
// showing (it is hidden on desktop), so the nav can never cover it.
export function computePopoverPos(btn: DOMRect, height: number): PopoverPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(POPOVER_MAX_WIDTH, vw - 2 * VIEWPORT_MARGIN);

  const nav = document.querySelector<HTMLElement>(".bnav");
  const navTop = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().top : vh;
  const bottomLimit = Math.min(vh, navTop) - VIEWPORT_MARGIN;
  const topLimit = VIEWPORT_MARGIN;

  const spaceAbove = btn.top - POPOVER_GAP - topLimit;
  const spaceBelow = bottomLimit - (btn.bottom + POPOVER_GAP);
  const up = height <= spaceAbove || (height > spaceBelow && spaceAbove >= spaceBelow);
  const room = up ? spaceAbove : spaceBelow;
  const shown = Math.min(height, room);

  // Right edge lined up with the button, kept on screen.
  const left = Math.min(Math.max(btn.right - width, VIEWPORT_MARGIN), vw - width - VIEWPORT_MARGIN);
  const top = up ? btn.top - POPOVER_GAP - shown : btn.bottom + POPOVER_GAP;

  return { top, left, width, maxHeight: height > room ? room : undefined };
}
