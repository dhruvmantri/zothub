import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * The shell shared by the two "your account is not usable yet" screens (A5).
 *
 * Deliberately the same shape as the waitlist page, because these are the same
 * family of state from the visitor's point of view: signed in, nothing to do
 * here yet, told why. Foundation rule 4 — consistent beats clever — and rule 1:
 * neither screen names a problem without offering the way out, which is why
 * `actions` is required rather than optional.
 */
export function AccountStateCard({
  icon: Icon,
  title,
  description,
  children,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-accent-wash">
            <Icon className="size-8 text-accent-text" aria-hidden />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {children}
          <div className="flex flex-col gap-2">{actions}</div>
        </CardContent>
      </Card>
    </div>
  );
}
