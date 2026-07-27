import { formatDistanceToNow } from "date-fns";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Notification } from "@/hooks/useNotifications";

type InvitationStatus = "pending" | "active" | "declined" | null;

interface TeamInvitationCardProps {
  notification: Notification;
  status: InvitationStatus;
  isProcessing: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function TeamInvitationCard({
  notification,
  status,
  isProcessing,
  onAccept,
  onDecline,
}: TeamInvitationCardProps) {
  const isPending = status === "pending" || status === null;
  const isAccepted = status === "active";
  const isDeclined = status === "declined";

  return (
    <div className="flex-1 min-w-0">
      <p
        className={cn(
          "text-sm",
          !notification.is_read ? "font-medium text-ink" : "text-ink-2"
        )}
      >
        {notification.title}
      </p>
      {notification.message && (
        <p className="text-sm text-ink-2 mt-0.5">
          {notification.message}
        </p>
      )}
      <p className="font-data text-xs text-ink-3 mt-1">
        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
      </p>

      {/* Show Accept/Decline buttons only for pending invitations */}
      {isPending && notification.related_id && (
        <div className="flex items-center gap-2 mt-3">
          <Button
            size="sm"
            onClick={onAccept}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4 mr-1" />
                Accept
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDecline}
            disabled={isProcessing}
          >
            <X className="w-4 h-4 mr-1" />
            Decline
          </Button>
        </div>
      )}

      {/* Show status badges for responded invitations */}
      {isAccepted && (
        <div className="mt-2">
          <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-500">
            <Check className="w-3 h-3 mr-1" />
            Accepted
          </Badge>
        </div>
      )}
      {isDeclined && (
        <div className="mt-2">
          <Badge variant="secondary">
            <X className="w-3 h-3 mr-1" />
            Declined
          </Badge>
        </div>
      )}
    </div>
  );
}
