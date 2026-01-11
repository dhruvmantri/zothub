import { ReactNode } from "react";
import { Navbar } from "./Navbar";

interface PublicLayoutProps {
  children: ReactNode;
  showNavbar?: boolean;
}

export function PublicLayout({ children, showNavbar = true }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {showNavbar && <Navbar />}
      <main className={showNavbar ? "pt-16" : ""}>{children}</main>
    </div>
  );
}
