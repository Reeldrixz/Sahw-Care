import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import DesktopNav from "@/components/DesktopNav";
import OnboardingGate from "@/components/OnboardingGate";
import SiteFooter from "@/components/SiteFooter";
import BetaFeedbackPill from "@/components/BetaFeedbackPill";

export const metadata: Metadata = {
  title: "Kradəl \u2014 Free baby & maternal items near you",
  description:
    "Discover free baby formula, diapers, maternity items and more from mothers in your community.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <DesktopNav />
          <OnboardingGate>
            {children}
          </OnboardingGate>
          <SiteFooter />
          <BetaFeedbackPill />
        </AuthProvider>
      </body>
    </html>
  );
}
