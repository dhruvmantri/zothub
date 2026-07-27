import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { Building2, User } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Shape carries meaning: **people are circles, clubs/orgs are rounded-squares.**
 * On a two-sided marketplace you should know what you are looking at before you
 * read it. (This supersedes the older "rounded-square for everything" note.)
 *
 * The square radius is a *percentage*, so it scales with the avatar and a logo
 * never ends up reading as a nested card.
 *
 * Fallback chain: photo → initials on a name-derived colour → a neutral glyph.
 * The colour is decorative, not semantic — it is hashed from the name purely so
 * the same person keeps the same colour between renders.
 */
type AvatarKind = "person" | "org";

const AvatarContext = React.createContext<AvatarKind>("person");

const kindShape = (kind: AvatarKind) => (kind === "org" ? "rounded-[26%]" : "rounded-full");

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & { kind?: AvatarKind }
>(({ className, kind = "person", ...props }, ref) => (
  <AvatarContext.Provider value={kind}>
    <AvatarPrimitive.Root
      ref={ref}
      className={cn("relative flex size-10 shrink-0 overflow-hidden", kindShape(kind), className)}
      {...props}
    />
  </AvatarContext.Provider>
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn("aspect-square size-full object-cover", className)} {...props} />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => {
  const kind = React.useContext(AvatarContext);
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex size-full items-center justify-center bg-surface-3 font-bold leading-none text-ink-3",
        kindShape(kind),
        className,
      )}
      {...props}
    />
  );
});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

/* ------------------------------------------------------------------------- */

/**
 * Twelve decorative fills, every one verified >=4.5:1 against white text
 * (worst 5.18). Keep that true if the set is ever edited.
 */
const AVATAR_COLORS = [
  "#5B3FB0", "#1C6699", "#0C6E77", "#C2410C",
  "#1D6FA3", "#7A3E9D", "#10794D", "#9C4A0C",
  "#B23227", "#C0392E", "#7A4BE0", "#475569",
] as const;

/** Stable across renders and sessions — same name, same colour. */
export function avatarColor(seed: string | null | undefined): string {
  const s = (seed || "").trim();
  if (!s) return "#475569";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initials(name: string | null | undefined): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZES = {
  xs: { box: "size-6", text: "text-[9.5px]" },
  sm: { box: "size-8", text: "text-[12.5px]" },
  md: { box: "size-10", text: "text-[15px]" },
  lg: { box: "size-12", text: "text-[17.5px]" },
  xl: { box: "size-16", text: "text-[23px]" },
  xxl: { box: "size-[88px]", text: "text-[31px]" },
} as const;

export interface EntityAvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string | null | undefined;
  src?: string | null;
  kind?: AvatarKind;
  size?: keyof typeof SIZES;
  /** ZotSpot-seeded club with no owner yet — dashed and muted. */
  unclaimed?: boolean;
}

/**
 * The full fallback chain in one component. Screens should reach for this
 * rather than composing Avatar/AvatarImage/AvatarFallback by hand.
 */
export const EntityAvatar = React.forwardRef<HTMLSpanElement, EntityAvatarProps>(
  ({ name, src, kind = "person", size = "md", unclaimed = false, className, ...props }, ref) => {
    const s = SIZES[size];
    const label = name || (kind === "org" ? "Club" : "Person");
    const text = initials(name);
    const Glyph = kind === "org" ? Building2 : User;

    return (
      <Avatar
        ref={ref as never}
        kind={kind}
        className={cn(s.box, className)}
        {...(props as Record<string, unknown>)}
      >
        {src ? <AvatarImage src={src} alt={label} /> : null}
        <AvatarFallback
          className={cn(
            s.text,
            unclaimed
              ? "border-[1.5px] border-dashed border-line-3 bg-surface-2 text-ink-3"
              : text
                ? "text-white"
                : "",
          )}
          style={!unclaimed && text ? { backgroundColor: avatarColor(name) } : undefined}
          delayMs={src ? 400 : 0}
        >
          {text ? text : <Glyph className="size-[56%]" strokeWidth={1.7} aria-hidden />}
        </AvatarFallback>
      </Avatar>
    );
  },
);
EntityAvatar.displayName = "EntityAvatar";

export interface AvatarClusterProps extends React.HTMLAttributes<HTMLDivElement> {
  people: { name: string | null; src?: string | null }[];
  max?: number;
  size?: keyof typeof SIZES;
}

/** Overlapping "who applied / who's going" cluster with a +N overflow chip. */
export function AvatarCluster({ people, max = 4, size = "sm", className, ...props }: AvatarClusterProps) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className={cn("inline-flex items-center", className)} {...props}>
      {shown.map((p, i) => (
        <EntityAvatar
          key={`${p.name}-${i}`}
          name={p.name}
          src={p.src}
          size={size}
          className={cn("ring-2 ring-surface", i > 0 && "-ml-2.5")}
        />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            SIZES[size].box,
            "-ml-2.5 inline-flex items-center justify-center rounded-full bg-surface-3 font-mono text-[11.5px] font-semibold text-ink-2 ring-2 ring-surface",
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

export { Avatar, AvatarImage, AvatarFallback };
