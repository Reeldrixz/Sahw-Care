import type { Metadata } from "next";

// This page's URL carries the host link. Without this, clicking a tracking
// link would send that secret to Amazon as the referrer. The links also carry
// rel="noopener noreferrer"; this covers anything else on the page.
export const metadata: Metadata = {
  title:    "Orders",
  referrer: "no-referrer",
  robots:   { index: false, follow: false },
};

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
