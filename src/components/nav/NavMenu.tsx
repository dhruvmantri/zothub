import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NavItem } from "@/components/nav/navConfig";
import { cn } from "@/lib/utils";

/**
 * True only on a device that can actually hover — a mouse or trackpad.
 *
 * Hover-to-open is a trap on touch: `pointerenter` fires on the tap that is
 * ALSO a click, so the menu opens and immediately closes again. Gating on the
 * media query means a phone gets plain tap-to-open and a laptop gets the menu
 * without a click, which is what was asked for.
 */
function useCanHover() {
  const [canHover, setCanHover] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setCanHover(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setCanHover(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return canHover;
}

/**
 * A nav item that opens a menu instead of navigating.
 *
 * Opens on hover on a pointer device, and on click or keyboard everywhere —
 * Radix keeps Enter, Space, arrow keys, Escape and focus return working, which
 * a hover-only menu would break for anyone not using a mouse.
 */
export function NavMenu({
  item,
  /** Desktop text bar vs mobile tab bar — the trigger looks different in each. */
  variant,
  className,
  children,
}: {
  item: NavItem;
  variant: "top" | "tab";
  className?: string;
  children?: React.ReactNode;
}) {
  const { pathname } = useLocation();
  const canHover = useCanHover();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  // A small grace period, so moving the pointer diagonally from the trigger to
  // the menu does not close it on the way.
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);

  const hoverProps = canHover
    ? {
        onPointerEnter: () => {
          cancelClose();
          setOpen(true);
        },
        onPointerLeave: scheduleClose,
      }
    : {};

  const active = item.match(pathname);
  const Icon = item.icon;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-haspopup="menu"
          aria-current={active ? "page" : undefined}
          className={className}
          {...hoverProps}
        >
          {children ?? (
            <>
              {item.label}
              <ChevronDown
                aria-hidden
                className={cn(
                  "ml-1 size-3.5 transition-transform duration-fast ease-zh",
                  open && "rotate-180",
                )}
              />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={variant === "top" ? "start" : "center"}
        side={variant === "top" ? "bottom" : "top"}
        sideOffset={variant === "top" ? 10 : 12}
        className="min-w-[200px]"
        {...hoverProps}
      >
        {(item.children ?? []).map((child) => {
          const childActive = child.match(pathname);
          const ChildIcon = child.icon;
          return (
            <DropdownMenuItem key={child.to} asChild>
              <Link
                to={child.to!}
                aria-current={childActive ? "page" : undefined}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5",
                  childActive && "font-semibold text-ink",
                )}
              >
                <ChildIcon aria-hidden className="size-4 text-ink-3" />
                {child.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
