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
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const clerkEnabled = /^pk_(test|live)_/.test(clerkPublishableKey ?? "");
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
