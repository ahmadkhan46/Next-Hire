import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { ClerkProvider } from "@clerk/nextjs";
import { PublicNavigation } from "@/components/public-navigation";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "CareerOS",
  description: "AI-powered career & talent intelligence platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ClerkProvider>
          <PublicNavigation />
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
