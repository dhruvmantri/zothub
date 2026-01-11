import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Briefcase, Calendar, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/club/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/club/opportunities", label: "Opps", icon: Briefcase },
  { href: "/club/events", label: "Events", icon: Calendar },
  { href: "/club/applications", label: "Apps", icon: Users },
  { href: "/club/profile", label: "Profile", icon: User },
];

export function ClubBottomNav() {
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === "/club/dashboard") {
      return location.pathname === "/club/dashboard";
    }
    if (href === "/club/profile") {
      return location.pathname === "/club/profile";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navLinks.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <link.icon className={cn("w-5 h-5", active && "fill-primary/20")} />
              <span className="text-xs font-medium">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
