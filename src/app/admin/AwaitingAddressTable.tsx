"use client";

import { useState } from "react";
import VerificationBadge from "@/components/VerificationBadge";
import type { VerificationBadge as VerificationBadgeKind } from "@/lib/verificationBadge";
import { groupByMother } from "@/lib/awaitingAddress";

// The Awaiting address tab: one row per mother, since one address
// confirmation covers every funded item of hers waiting for one, across all
// her registers (lib/addressConfirm). Expand a row to see the items.

export interface AwaitingAddressEntry {
  id: string; name: string; updatedAt: string;
  register: { id: string; title: string; creatorId: string; city: string | null; creator: { id: string; name: string; verificationBadge: VerificationBadgeKind } };
}

// The address-timeout cron refunds an item 14 days after it starts waiting.
const TIMEOUT_DAYS = 14;
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
const urgencyColor = (daysLeft: number) => daysLeft <= 3 ? "#c0392b" : daysLeft <= 7 ? "#d97706" : "#1a7a5e";

export function AwaitingAddressTable({ items, onNudge }: {
  items: AwaitingAddressEntry[]; onNudge: (itemId: string) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setOpen((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>Mother</th>
          <th>Items waiting</th>
          <th>Longest wait</th>
          <th>Days left</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {groupByMother(items).map((g) => {
          const mother = g[0].register.creator;
          const oldest = g[0];
          const waited = daysSince(oldest.updatedAt);
          const left = TIMEOUT_DAYS - waited;
          const registers = new Set(g.map((i) => i.register.id)).size;
          const isOpen = open.has(mother.id);
          return [
            <tr key={mother.id}>
              <td style={{ fontSize: 12 }}>
                {mother.name.split(" ")[0]} <VerificationBadge badge={mother.verificationBadge} />
                <div style={{ fontSize: 11, color: "var(--mid)" }}>{oldest.register.city}</div>
              </td>
              <td style={{ fontSize: 12 }}>
                <button onClick={() => toggle(mother.id)} aria-expanded={isOpen}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, fontSize: 12, color: "#1a7a5e", fontFamily: "Nunito, sans-serif" }}>
                  {isOpen ? "▾" : "▸"} {g.length} item{g.length === 1 ? "" : "s"}
                </button>
                {registers > 1 && <div style={{ fontSize: 11, color: "var(--mid)" }}>across {registers} registers</div>}
              </td>
              <td style={{ fontSize: 12, color: urgencyColor(left), fontWeight: 700 }}>{waited}d</td>
              <td style={{ fontSize: 12, color: urgencyColor(left), fontWeight: 700 }}>{Math.max(0, left)}d</td>
              <td>
                <button
                  onClick={() => onNudge(oldest.id)}
                  style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, border: "none", background: "#d97706", color: "white", cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                  Nudge mother
                </button>
              </td>
            </tr>,
            ...(isOpen ? g.map((i) => {
              const iw = daysSince(i.updatedAt);
              return (
                <tr key={i.id} style={{ background: "var(--bg)" }}>
                  <td style={{ fontSize: 12, paddingLeft: 24 }} colSpan={2}>
                    <span style={{ fontWeight: 700 }}>{i.name}</span>
                    <div style={{ fontSize: 11, color: "var(--mid)" }}>{i.register.title}</div>
                  </td>
                  <td style={{ fontSize: 12, color: urgencyColor(TIMEOUT_DAYS - iw) }}>{iw}d</td>
                  <td style={{ fontSize: 12, color: urgencyColor(TIMEOUT_DAYS - iw) }}>{Math.max(0, TIMEOUT_DAYS - iw)}d</td>
                  <td />
                </tr>
              );
            }) : []),
          ];
        })}
      </tbody>
    </table>
  );
}
