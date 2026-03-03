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
  const appShell = (
    <>
      <PublicNavigation />
      <Providers>{children}</Providers>
    </>
  );

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        {clerkPublishableKey ? (
          <ClerkProvider publishableKey={clerkPublishableKey}>{appShell}</ClerkProvider>
        ) : (
          appShell
        )}
      </body>
    </html>
  );
}
