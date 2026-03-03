import {
  LayoutDashboard,
  Users,
  Briefcase,
  Sparkles,
  Settings,
} from "lucide-react";

export function navItems(orgId: string) {
  return [
    { label: "Dashboard", href: `/orgs/${orgId}`, icon: LayoutDashboard },
    { label: "Candidates", href: `/orgs/${orgId}/candidates`, icon: Users },
    { label: "Jobs", href: `/orgs/${orgId}/jobs`, icon: Briefcase },
    { label: "Intelligence", href: `/orgs/${orgId}/intelligence`, icon: Sparkles },
    { label: "Settings", href: `/orgs/${orgId}/settings`, icon: Settings },
  ];
}
