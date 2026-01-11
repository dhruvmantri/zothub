import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  LayoutGrid, 
  Briefcase, 
  Calendar, 
  Users, 
  UserCog, 
  TrendingUp 
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const tabs = [
  { href: "/club/dashboard", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/club/dashboard/opportunities", label: "Opportunities", icon: Briefcase },
  { href: "/club/dashboard/events", label: "Events", icon: Calendar },
  { href: "/club/dashboard/applications", label: "Applications", icon: Users },
  { href: "/club/dashboard/team", label: "Team", icon: UserCog },
  { href: "/club/dashboard/analytics", label: "Analytics", icon: TrendingUp },
];

interface DashboardTabsProps {
  applicationCount?: number;
}

export function DashboardTabs({ applicationCount = 0 }: DashboardTabsProps) {
  const location = useLocation();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === href;
    }
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };

  return (
    <div className="border-b border-border bg-card/50">
      <ScrollArea className="w-full">
        <div className="flex items-center gap-1 px-4 py-2">
          {tabs.map((tab) => {
            const active = isActive(tab.href, tab.exact);
            return (
              <Link
                key={tab.href}
                to={tab.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                  active 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.href === "/club/dashboard/applications" && applicationCount > 0 && (
                  <span className={cn(
                    "ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full",
                    active 
                      ? "bg-primary-foreground/20 text-primary-foreground" 
                      : "bg-destructive text-destructive-foreground"
                  )}>
                    {applicationCount > 9 ? "9+" : applicationCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
    </div>
  );
}
