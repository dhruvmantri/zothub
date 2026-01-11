import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageLoaderProps {
  /** Custom class name for the container */
  className?: string;
  /** Size of the spinner: "sm" (16px), "md" (32px), "lg" (48px) */
  size?: "sm" | "md" | "lg";
  /** Text to display below the spinner */
  text?: string;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-8 h-8",
  lg: "w-12 h-12",
};

/**
 * Centered page loading spinner.
 * Use for full-page or section loading states.
 */
export function PageLoader({ className, size = "md", text }: PageLoaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12",
        className
      )}
    >
      <Loader2
        className={cn("animate-spin text-primary", sizeClasses[size])}
      />
      {text && (
        <p className="mt-3 text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  );
}
