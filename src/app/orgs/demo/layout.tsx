import * as React from "react";
import { AppShell } from "@/components/app-shell/app-shell";

export default function DemoOrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell orgId="demo">{children}</AppShell>;
}
