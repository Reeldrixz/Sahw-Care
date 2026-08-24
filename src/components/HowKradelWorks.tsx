"use client";

import React from "react";
import { Gift, Search, ShoppingBag, Truck, ChevronRight } from "lucide-react";

const STEPS = [
  {
    icon: Gift,
    title: "1. Mother creates\na register",
    desc: "She adds the real items she and her baby need.",
  },
  {
    icon: Search,
    title: "2. You choose\nwhat to provide",
    desc: "Browse registers and choose an item to support.",
  },
  {
    icon: ShoppingBag,
    title: "3. We purchase\nwith care",
    desc: "Kradel buys the item using your contribution.",
  },
  {
    icon: Truck,
    title: "4. We deliver\nwith dignity",
    desc: "Items are delivered directly to the mother.",
  },
];

export default function HowKradelWorks() {
  return (
    <div style={{ padding: "24px 0" }}>
      <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, marginBottom: 20, color: "var(--ink)" }}>
        How Kradel works
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <React.Fragment key={i}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8, flexShrink: 0 }}>
                  <Icon size={24} color="#1a7a5e" strokeWidth={1.75} />
                </div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 4, textAlign: "center", lineHeight: 1.3, whiteSpace: "pre-line" }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 10, color: "#555555", fontFamily: "Nunito, sans-serif", textAlign: "center", lineHeight: 1.4 }}>
                  {step.desc}
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ paddingTop: 18, flexShrink: 0 }}>
                  <ChevronRight size={16} color="var(--mid)" strokeWidth={1.75} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
