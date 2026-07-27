import { ReactNode } from "react";
import { Navbar } from "./Navbar";

interface PublicLayoutProps {
  children: ReactNode;
  showNavbar?: boolean;
}

export function PublicLayout({ children, showNavbar = true }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-2">
      {showNavbar && <Navbar />}
      <main className={showNavbar ? "pt-[60px]" : ""}>{children}</main>
    </div>
  );
}
