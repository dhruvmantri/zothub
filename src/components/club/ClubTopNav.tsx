import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Zap,
  LayoutDashboard,
  Briefcase,
  Calendar,
  Building2,
  Rss,
  MessageSquare,
  Bell,
  User,
  TrendingUp,
  Users,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ClubTopNavProps {
  unreadMessageCount: number;
  notificationCount: number;
  applicationCount: number;
}

const navLinks = [
  { href: "/club/feed", label: "Feed", icon: Rss },
  { href: "/opportunities", label: "Opportunities", icon: Briefcase },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/clubs", label: "Clubs", icon: Building2 },
  { href: "/club/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function ClubTopNav({ unreadMessageCount, notificationCount, applicationCount }: ClubTopNavProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === "/club/dashboard") {
      return location.pathname === "/club/dashboard" || 
             location.pathname.startsWith("/club/dashboard/");
    }
    return location.pathname === href;
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() || "C";

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur-sm fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground hidden sm:inline">
              Zot<span className="text-primary">Hub</span>
            </span>
          </Link>

          {/* Center Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} to={link.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2 h-8",
                    isActive(link.href) && "bg-secondary text-foreground"
                  )}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                  {link.href === "/club/dashboard" && applicationCount > 0 && (
                    <Badge variant="destructive" className="ml-1 px-1 py-0 text-[10px] h-4">
                      {applicationCount > 9 ? "9+" : applicationCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            ))}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-1">
            {/* Messages */}
            <Link to="/club/messages">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "relative h-9 w-9",
                  location.pathname === "/club/messages" && "bg-secondary"
                )}
              >
                <MessageSquare className="w-4 h-4" />
                {unreadMessageCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
                  >
                    {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                  </Badge>
                )}
              </Button>
            </Link>

            {/* Notifications */}
            <Link to="/notifications">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "relative h-9 w-9",
                  location.pathname === "/notifications" && "bg-secondary"
                )}
              >
                <Bell className="w-4 h-4" />
                {notificationCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
                  >
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </Badge>
                )}
              </Button>
            </Link>

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/club/dashboard/team" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Team
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/club/dashboard/analytics" className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Analytics
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/club/profile" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Edit Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
