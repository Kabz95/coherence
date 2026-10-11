import type { Metadata } from "next";

import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coherence | Clinician Neuroimaging Support",
  description:
    "Supplementary, non-diagnostic neuroimaging and neurophysiology summaries for clinician review.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}