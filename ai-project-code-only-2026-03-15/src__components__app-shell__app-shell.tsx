import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({
  orgId,
  children,
}: {
  orgId: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground">
      <div className="flex w-full">
        <Sidebar orgId={orgId} />

        <div className="flex min-h-dvh flex-1 flex-col">
          <Topbar orgId={orgId} />
          <main className="flex-1 px-3 pb-8 pt-3 sm:px-4 md:px-6 md:pb-10 md:pt-4 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
