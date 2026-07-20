import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchPublicRegister } from "@/lib/registers";
import PublicRegisterClient from "@/components/PublicRegisterClient";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://sahw-care.vercel.app";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const register = await fetchPublicRegister(id);
  if (!register) return { title: "Register not found · Kradəl" };

  const title = `${register.firstName}'s Register · Kradəl`;
  const description = `Help provide real essentials for ${register.firstName}'s baby. Every item is a genuine need, delivered directly to her.`;
  const url = `${APP_URL}/r/${register.id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Kradəl",
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
  const register = await fetchPublicRegister(id);
  if (!register) notFound();

  return <PublicRegisterClient register={register} appUrl={APP_URL} />;
}
