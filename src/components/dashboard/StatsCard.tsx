import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: LucideIcon;
}

export function StatsCard({ title, value, change, trend, icon: Icon }: StatsCardProps) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5 shadow-e1">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex size-10 items-center justify-center rounded-md bg-surface-3">
          <Icon className="size-5 text-ink-2" />
        </div>
        {change && trend && (
          <span
            className={cn(
              "rounded-pill px-2 py-0.5 text-xs font-medium",
              trend === "up" && "bg-ok-wash text-ok",
              trend === "down" && "bg-bad-wash text-bad",
              trend === "neutral" && "bg-surface-3 text-ink-3",
            )}
          >
            {change}
          </span>
        )}
      </div>
      {/* A scanned/compared number → data voice (mono, tabular). */}
      <p className="font-data text-2xl font-semibold text-ink">{value}</p>
      <p className="text-sm text-ink-2">{title}</p>
    </div>
  );
}
