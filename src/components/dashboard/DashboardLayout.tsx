import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Briefcase, 
  Calendar, 
  Users, 
  MessageSquare, 
  Settings,
  Bell,
  TrendingUp,
  ChevronLeft,
  Pencil
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const { user } = useAuth();
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [applicationCount, setApplicationCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [clubName, setClubName] = useState("My Club");

  // Fetch counts
  useEffect(() => {
    if (!user) return;

    const fetchCounts = async () => {
      // Unread messages
      const { count: msgCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("is_read", false);

      setUnreadMessageCount(msgCount || 0);

      // Unread notifications
      const { count: notifCount } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      setNotificationCount(notifCount || 0);

      // Pending applications for club's opportunities
      const { data: clubProfile } = await supabase
        .from("club_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (clubProfile) {
        // Fetch club name
        const { data: fullProfile } = await supabase
          .from("club_profiles")
          .select("club_name")
          .eq("user_id", user.id)
          .maybeSingle();

        if (fullProfile?.club_name) {
          setClubName(fullProfile.club_name);
        }

        const { count: appCount } = await supabase
          .from("applications")
          .select("*, opportunities!inner(club_id)", { count: "exact", head: true })
          .eq("opportunities.club_id", clubProfile.id)
          .eq("status", "pending");

        setApplicationCount(appCount || 0);
      }
    };

    fetchCounts();

    // Subscribe to real-time updates for messages and notifications
    const messagesChannel = supabase
      .channel("unread-messages-count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    const notificationsChannel = supabase
      .channel("unread-notifications-count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, [user]);

  const sidebarLinks = [
    { href: "/club/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/club/opportunities", label: "Opportunities", icon: Briefcase },
    { href: "/club/events", label: "Events", icon: Calendar },
    { href: "/club/applications", label: "Applications", icon: Users, badge: applicationCount > 0 ? applicationCount : undefined },
    { href: "/club/messages", label: "Messages", icon: MessageSquare, badge: unreadMessageCount > 0 ? unreadMessageCount : undefined },
    { href: "/club/analytics", label: "Analytics", icon: TrendingUp },
    { href: "/club/settings", label: "Settings", icon: Settings },
  ];

  // Get initials from email
  const initials = user?.email?.substring(0, 2).toUpperCase() || "CL";

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-border bg-card flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">Z</span>
            </div>
            <span className="font-display font-bold text-xl text-foreground">ZotHub</span>
          </Link>
        </div>

        {/* Club Info */}
        <Link 
          to="/club/profile" 
          className="block p-4 border-b border-border hover:bg-secondary/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <span className="font-semibold text-accent">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{clubName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <Pencil className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {sidebarLinks.map((link) => {
            const isActive = location.pathname === link.href || 
              (link.href !== "/club/dashboard" && location.pathname.startsWith(link.href));
            
            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <link.icon className="w-4 h-4" />
                <span className="flex-1">{link.label}</span>
                {link.badge && (
                  <Badge 
                    variant={isActive ? "secondary" : "accent"} 
                    className="px-1.5 py-0 text-[10px]"
                  >
                    {link.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-4 border-t border-border">
          <Link to="/">
            <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
              <ChevronLeft className="w-4 h-4" />
              Back to site
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
          <div className="lg:hidden">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">Z</span>
              </div>
            </Link>
          </div>
          
          <div className="flex-1" />
          
          <div className="flex items-center gap-3">
            <Link to="/notifications">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {notificationCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-accent-foreground text-[10px] font-medium rounded-full flex items-center justify-center">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link to="/club/profile">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:ring-2 hover:ring-primary transition-all cursor-pointer">
                <span className="text-sm font-medium text-muted-foreground">{initials.charAt(0)}</span>
              </div>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-6 lg:p-8 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
