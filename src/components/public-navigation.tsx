"use client";

import { usePathname } from "next/navigation";
import { Navigation } from "@/components/navigation";

export function PublicNavigation() {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith("/sign-in") || pathname?.startsWith("/sign-up");
  
  if (isAuthPage) return null;
  return <Navigation />;
}
