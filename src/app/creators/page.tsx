import { Suspense } from "react";
import type { Metadata } from "next";
import CreatorsClient from "@/components/CreatorsClient";

export const metadata: Metadata = {
  title: "Impact Creator Program · Kradel",
  description:
    "Impact Creators help more people discover Kradel. Share the mission honestly, with dignity and no pressure, so more mothers can find the support they need.",
};

export default function CreatorsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#faf6ee" }} />}>
      <CreatorsClient />
    </Suspense>
  );
}
