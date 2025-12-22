import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: LucideIcon;
}

export function StatsCard({ title, value, change, trend, icon: Icon }: StatsCardProps) {
  return (
    <div className="p-5 rounded-xl bg-card border border-border shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
        <span className={cn(
          "text-xs font-medium px-2 py-0.5 rounded-full",
          trend === "up" && "bg-success/10 text-success",
          trend === "down" && "bg-destructive/10 text-destructive",
          trend === "neutral" && "bg-muted text-muted-foreground"
        )}>
          {change}
        </span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{title}</p>
    </div>
  );
}
