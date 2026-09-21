import { ChevronDown, Search, SlidersHorizontal, Square, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { FilterChip } from "@/components/discover/FilterChip";
import { ViewToggle, type DiscoverView } from "@/components/discover/ViewToggle";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * The one toolbar for every discovery list (UX11/UX13).
 *
 * It exists because the *parts* were shared and the *composition* was not:
 * Clubs, Opportunities and Events each assembled their own search box, chip
 * row, sort control and view toggle, and drifted — different order, different
 * spacing, Events with no sort at all and Clubs with no view toggle. Anything
 * added to one page from here on is added to all three by construction.
 *
 * Shape follows the maintainer's decision of 2026-09-21 (mockup option C):
 * the filters that are about the VIEWER — Saved, the clubs they follow — stay
 * visible as chips, because they are the reason a student comes back. The
 * taxonomy filters (role type, club category, date window), which only matter
 * once someone is actively hunting, live behind one "Filter" menu. That keeps
 * the whole bar on one line on a laptop and stops the chip row from running
 * off the right edge of a phone with half the options hidden in the overflow.
 */

/** A viewer-scoped toggle that stays visible: Saved, Following. */
export interface ToolbarScope {
  value: string;
  label: string;
  icon?: LucideIcon;
  active: boolean;
  onToggle: () => void;
}

/**
 * One section of the Filter menu.
 *
 * `mode` is not cosmetic. "multi" gives checkboxes and means OR within the
 * group — a student hunting for something to do wants Leadership *or*
 * Creative. "single" gives radios and is for options that overlap, where
 * ticking two is meaningless: "This week" is inside "This month", so an
 * intersection is always one of them and a union is always the wider one.
 */
export interface ToolbarFilterGroup {
  id: string;
  label: string;
  mode: "multi" | "single";
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: readonly string[];
  onChange: (next: string[]) => void;
}

export interface ToolbarSort {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  /** Screen-reader name — "Sort roles", not "Sort". */
  label: string;
}

export function DiscoverToolbar({
  searchId,
  searchLabel,
  searchPlaceholder,
  searchQuery,
  onSearchChange,
  scopes,
  filterGroups,
  sort,
  view,
  onViewChange,
}: {
  searchId: string;
  /** Visually hidden, so it must say what is searched, not just "Search". */
  searchLabel: string;
  searchPlaceholder: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  scopes?: ToolbarScope[];
  filterGroups?: ToolbarFilterGroup[];
  sort?: ToolbarSort;
  /** Omit both to render no view toggle. */
  view?: DiscoverView;
  onViewChange?: (view: DiscoverView) => void;
}) {
  const groups = (filterGroups ?? []).filter((g) => g.options.length > 0);
  const activeFilterCount = groups.reduce((n, g) => n + g.selected.length, 0);

  return (
    <div className="sticky top-[60px] z-40 border-b border-line bg-surface">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <label htmlFor={searchId} className="sr-only">
              {searchLabel}
            </label>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
            />
            <Input
              id={searchId}
              type="search"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 pr-11"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-pill text-ink-3 hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Wraps rather than scrolls on a phone. A horizontally scrolling
              control row hides whatever sits past the right edge, and a sort
              nobody can see is a sort nobody uses — which is how the old chip
              row buried four of the six role types. */}
          <div className="flex flex-wrap items-center gap-2">
            {(scopes ?? []).map((scope) => {
              const Icon = scope.icon;
              return (
                <FilterChip key={scope.value} active={scope.active} onClick={scope.onToggle}>
                  {Icon && <Icon className="size-3.5" aria-hidden />}
                  {scope.label}
                </FilterChip>
              );
            })}

            {groups.length > 0 && (
              <FilterMenu groups={groups} activeCount={activeFilterCount} />
            )}

            {sort && (
              <Select value={sort.value} onValueChange={sort.onChange}>
                <SelectTrigger
                  className="h-11 w-auto min-w-[150px] shrink-0 md:w-[186px]"
                  aria-label={sort.label}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sort.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {view && onViewChange && (
              <ViewToggle view={view} onChange={onViewChange} className="hidden sm:inline-flex" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterMenu({
  groups,
  activeCount,
}: {
  groups: ToolbarFilterGroup[];
  activeCount: number;
}) {
  const clearAll = () => groups.forEach((g) => g.selected.length > 0 && g.onChange([]));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            activeCount > 0
              ? `Filter — ${activeCount} ${activeCount === 1 ? "filter" : "filters"} on`
              : "Filter"
          }
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border px-3.5 text-[13px] font-medium",
            "transition-colors duration-fast ease-zh",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            activeCount > 0
              ? "border-accent-line bg-accent-wash font-semibold text-accent-text"
              : "border-line-2 bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink",
          )}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filter
          {activeCount > 0 && (
            // Same badge as the nav's unread count — accent fill with
            // accent-ink on top, which is the pair that passes AA in both
            // themes. A tinted-on-tinted badge does not.
            <span
              aria-hidden
              className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-accent px-1.5 font-mono text-[10.5px] font-bold leading-none text-accent-ink [font-variant-numeric:tabular-nums]"
            >
              {activeCount}
            </span>
          )}
          <ChevronDown className="size-3.5 text-ink-3" aria-hidden />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="max-h-[70vh] min-w-[220px] overflow-y-auto">
        {groups.map((group, index) => (
          <div key={group.id}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
            {group.mode === "single" ? (
              <DropdownMenuRadioGroup
                value={group.selected[0] ?? ""}
                onValueChange={(v) => group.onChange(v ? [v] : [])}
              >
                {group.options.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            ) : (
              group.options.map((option) => {
                const checked = group.selected.includes(option.value);
                return (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={checked}
                    // Without this the menu closes on every tick, so choosing
                    // two types means opening the menu twice — which defeats
                    // the entire point of making these multi-select.
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={() =>
                      group.onChange(
                        checked
                          ? group.selected.filter((v) => v !== option.value)
                          : [...group.selected, option.value],
                      )
                    }
                  >
                    {/* shadcn reserves the indicator slot but draws NOTHING
                        when unchecked, which left every unticked option
                        looking like a plain menu link — "Leadership Role"
                        reads as somewhere to go, not something to tick. An
                        explicit empty box is the only cue that these are
                        toggles and that more than one can be on. The checked
                        tick is drawn by the primitive into the same slot, so
                        this renders only in the unchecked state. */}
                    {!checked && (
                      <Square
                        aria-hidden
                        className="absolute left-2 size-3.5 text-ink-3"
                        strokeWidth={1.75}
                      />
                    )}
                    {option.label}
                  </DropdownMenuCheckboxItem>
                );
              })
            )}
          </div>
        ))}

        {activeCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={clearAll} className="cursor-pointer text-ink-2">
              Clear filters
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
