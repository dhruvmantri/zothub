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
    </div>
  );
};

export default NotFound;
