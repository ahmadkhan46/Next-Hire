import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { ClerkProvider } from "@clerk/nextjs";
import { PublicNavigation } from "@/components/public-navigation";
import { getClerkPublishableKey, isClerkClientEnabled } from "@/lib/clerk-config";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "NextHire",
  description: "AI-powered career & talent intelligence platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerkPublishableKey = getClerkPublishableKey();
  const clerkEnabled = isClerkClientEnabled();
  const appShell = <Providers>{children}</Providers>;

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        {clerkEnabled ? (
          <ClerkProvider publishableKey={clerkPublishableKey}>
            <PublicNavigation />
            {appShell}
          </ClerkProvider>
        ) : (
          appShell
        )}
      </body>
    </html>
  );
}
