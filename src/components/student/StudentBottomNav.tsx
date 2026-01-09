import { Link, useLocation } from "react-router-dom";
import { Rss, Briefcase, Calendar, Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/student/feed", label: "Feed", icon: Rss },
  { href: "/opportunities", label: "Opps", icon: Briefcase },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/clubs", label: "Clubs", icon: Building2 },
  { href: "/student/profile", label: "Profile", icon: User },
];

export function StudentBottomNav() {
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === "/student/feed") {
      return location.pathname === "/student/feed";
    }
    if (href === "/student/profile") {
      return location.pathname === "/student/profile";
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
