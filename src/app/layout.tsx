import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import DesktopNav from "@/components/DesktopNav";

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
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
