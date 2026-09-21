import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-2 p-4 text-center">
      <Logo />
      <p className="mt-10 font-data text-[64px] font-semibold leading-none tracking-[-0.03em] text-ink">
        404
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-ink">Page not found</h1>
      <p className="mt-2 max-w-sm text-ink-2">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Button asChild variant="accent" className="mt-8">
        <Link to="/">Back to home</Link>
      </Button>

      {/* UX28. This page has no header and no footer, so "Back to home" was
          the only way off it — a stale or mistyped link dropped you somewhere
          with one exit, which is exactly what club outreach produces. These
          are the same three destinations the nav and the footer carry, so a
          visitor lands where they were probably trying to go. */}
      <nav
        aria-label="Go to"
        className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm"
      >
        {[
          { to: "/opportunities", label: "Opportunities" },
          { to: "/events", label: "Events" },
          { to: "/clubs", label: "Clubs" },
        ].map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className="text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default NotFound;
