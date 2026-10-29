import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PublicRegisterClient from "@/components/PublicRegisterClient";
import { fetchSharePageRegister } from "@/lib/publicRegisterShapes";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://sahw-care.vercel.app";

// Never indexed. A share link is for the people it is shared with; a search
// engine listing her first name, city, due date and verification badge is not
// something she agreed to by sharing it. Link previews (Open Graph) still work.
const NOINDEX: Metadata["robots"] = { index: false, follow: false };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const register = await fetchSharePageRegister(id);
  if (!register) return { title: "Register not found · Kradel", robots: NOINDEX };

  const title = `${register.displayName} · Kradel`;
  const description = `Help provide real essentials for ${register.firstName}'s baby. Every item is a genuine need, delivered directly to her.`;
  const url = `${APP_URL}/r/${register.id}`;

  return {
    title,
    description,
    robots: NOINDEX,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Kradel",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PublicRegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const register = await fetchSharePageRegister(id);
  if (!register) notFound();

  // Only the fields the page renders go into it (and so into the page's HTML):
  // the display name, not the raw title; a stage line, not the due date; no
  // item notes.
  return <PublicRegisterClient register={register} appUrl={APP_URL} />;
}
