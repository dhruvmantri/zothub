import { Link } from "react-router-dom";
import { Bell, ChevronDown, LogOut, User, Building2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EntityAvatar } from "@/components/ui/avatar";
import { ThemeToggleGroup } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";

interface AccountMenuProps {
  role: "student" | "club";
  displayName: string;
  subtitle: string;
  avatarUrl?: string | null;
}

/**
 * The account avatar-menu is the profile home on desktop (mobile keeps profile
 * inside Activity, so the tab bar stays at four). Person = circle for students,
 * rounded-square for clubs — shape tells you which account you are in before
 * you read the name.
 */
export function AccountMenu({ role, displayName, subtitle, avatarUrl }: AccountMenuProps) {
  const { signOut } = useAuth();
  const isClub = role === "club";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg py-1 pl-1 pr-1.5 text-ink-2 transition-colors duration-fast ease-zh hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-surface-3"
        >
          <EntityAvatar
            name={displayName}
            src={avatarUrl}
            kind={isClub ? "org" : "person"}
            size="sm"
          />
          <ChevronDown className="size-3.5 shrink-0 text-ink-3 transition-transform duration-fast ease-zh" aria-hidden />
        </button>
      </DropdownMenuTrigger>

      {/* 272px, not the usual 240 — the three-up theme control needs the room,
          and it gives a long club name somewhere to go. */}
      <DropdownMenuContent align="end" className="w-[272px] p-1.5">
        <div className="border-b border-line px-3 pb-2.5 pt-2">
          <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
          <p className="truncate text-xs text-ink-3">{subtitle}</p>
        </div>

        <DropdownMenuItem asChild>
          <Link to={isClub ? "/club/profile" : "/student/profile"} className="flex items-center gap-3">
            {isClub ? <Building2 className="size-[15px] text-ink-3" /> : <User className="size-[15px] text-ink-3" />}
            {isClub ? "Club profile" : "Profile"}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link to="/notifications" className="flex items-center gap-3">
            <Bell className="size-[15px] text-ink-3" />
            Notifications
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1.5" />

        {/* Both themes are designed, so both are reachable from here. */}
        <div className="px-1.5 pb-1.5">
          <p className="px-1.5 pb-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">
            Theme
          </p>
          <ThemeToggleGroup />
        </div>

        <DropdownMenuSeparator className="my-1.5" />

        <DropdownMenuItem
          onClick={signOut}
          className="flex items-center gap-3 text-bad focus:text-bad"
        >
          <LogOut className="size-[15px]" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
