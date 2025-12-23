import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Building2, User, MessageSquare } from "lucide-react";
import type { Conversation } from "@/hooks/useMessages";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (participantId: string) => void;
  isLoading: boolean;
}

export function ConversationList({ 
  conversations, 
  selectedId, 
  onSelect, 
  isLoading 
}: ConversationListProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading conversations...</div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h3 className="font-medium text-foreground mb-1">No conversations yet</h3>
        <p className="text-sm text-muted-foreground">
          Start a conversation by messaging a club or student.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="divide-y divide-border">
        {conversations.map((conversation) => {
          const initials = conversation.participantName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase();

          return (
            <button
              key={conversation.participantId}
              onClick={() => onSelect(conversation.participantId)}
              className={cn(
                "w-full p-4 flex items-start gap-3 text-left transition-colors hover:bg-secondary/50",
                selectedId === conversation.participantId && "bg-secondary"
              )}
            >
              <Avatar className="h-10 w-10 flex-shrink-0">
                <AvatarImage src={conversation.participantAvatar} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {conversation.isClub ? (
                      <Building2 className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="font-medium text-foreground truncate">
                      {conversation.participantName}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatDistanceToNow(new Date(conversation.lastMessageTime), { 
                      addSuffix: false 
                    })}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground truncate">
                    {conversation.lastMessage}
                  </p>
                  {conversation.unreadCount > 0 && (
                    <Badge variant="accent" className="px-1.5 py-0 text-[10px] flex-shrink-0">
                      {conversation.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
