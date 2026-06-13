import { getCurrentUser } from "@/lib/auth";
import DiscoverHome from "@/components/DiscoverHome";
import LandingPage from "@/components/LandingPage";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  // Logged-out visitors get the public landing page; authenticated users
  // continue straight into the app (Discover).
  const user = await getCurrentUser();
  if (!user) return <LandingPage />;
  return <DiscoverHome />;
}
