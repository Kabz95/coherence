import type { Metadata } from "next";
import { Spectral } from "next/font/google";

import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

// Direction A display face: Spectral (serif) for headings, Georgia fallback.
const displayFont = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  fallback: ["Georgia", "serif"],
});

export const metadata: Metadata = {
  title: "Coherence | Clinician Neuroimaging Support",
  description:
    "Supplementary, non-diagnostic neuroimaging and neurophysiology summaries for clinician review.",
  openGraph: {
    title: "Coherence | Clinician Neuroimaging Support",
    description:
      "Supplementary, non-diagnostic neuroimaging and neurophysiology summaries for clinician review.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={displayFont.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}