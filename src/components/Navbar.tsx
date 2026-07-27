import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, LogOut, Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ThemeToggleButton } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const navLinks = [
  { href: "/opportunities", label: "Discover", match: (p: string) => p.startsWith("/opportunities") || p.startsWith("/events") },
  { href: "/clubs", label: "Clubs", match: (p: string) => p.startsWith("/clubs") },
];

/**
 * Public (logged-out) bar. Same "you are here" accent bar as the signed-in nav,
 * fewer destinations — a visitor only has Discover and Clubs.
 *
 * Logged-out visitors have no account menu, so the theme control appears here
 * as an icon button; signed in, the full Light/Dark/System choice lives in the
 * account menu instead.
 */
export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const { user, role, signOut } = useAuth();

  const dashboardLink = role === "club" ? "/club/dashboard" : "/student/dashboard";

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-line bg-surface/90 backdrop-blur-[10px]">
      <div className="container mx-auto px-4">
        <div className="flex min-h-[60px] items-stretch gap-6">
          <div className="flex items-center">
            <Logo />
          </div>

          <div className="hidden items-stretch gap-6 md:flex">
            {navLinks.map((link) => {
              const active = link.match(pathname);
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center whitespace-nowrap px-1.5 text-sm transition-colors duration-fast ease-zh",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    active
                      ? "font-semibold text-ink shadow-[inset_0_-2px_0_hsl(var(--accent))]"
                      : "font-medium text-ink-2 hover:text-ink",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex-1" />

          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggleButton />
            {user ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={dashboardLink} className="gap-2">
                    <LayoutDashboard className="size-4" />
                    Dashboard
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={signOut} className="gap-2">
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">Log in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/signup">Get started</Link>
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggleButton />
            <button
              type="button"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              className="inline-flex size-11 items-center justify-center rounded-pill text-ink-2 transition-colors duration-fast ease-zh hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="animate-fade-in border-t border-line py-4 md:hidden">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors",
                    link.match(pathname)
                      ? "bg-surface-3 text-ink"
                      : "text-ink-2 hover:bg-surface-3 hover:text-ink",
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
                {user ? (
                  <>
                    <Button variant="outline" size="sm" asChild className="w-full justify-start">
                      <Link to={dashboardLink} onClick={() => setMobileMenuOpen(false)}>
                        <LayoutDashboard className="mr-2 size-4" />
                        Dashboard
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        signOut();
                        setMobileMenuOpen(false);
                      }}
                    >
                      <LogOut className="mr-2 size-4" />
                      Sign out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" asChild className="w-full">
                      <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
                    </Button>
                    <Button size="sm" asChild className="w-full">
                      <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>Get started</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
