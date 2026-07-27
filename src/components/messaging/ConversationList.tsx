import { EntityAvatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare } from "lucide-react";
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
  isLoading,
}: ConversationListProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-ink-3">Loading conversations…</div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <MessageSquare className="w-12 h-12 text-ink-3 mb-4" />
        <h3 className="font-medium text-ink mb-1">No conversations yet</h3>
        <p className="text-sm text-ink-2">
          Start a conversation by messaging a club or student.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="divide-y divide-line">
        {conversations.map((conversation) => {
          const active = selectedId === conversation.participantId;
          return (
            <button
              key={conversation.participantId}
              onClick={() => onSelect(conversation.participantId)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "relative w-full p-4 flex items-start gap-3 text-left transition-colors",
                // Active row: surface-2 fill + an accent bar down the left edge
                // (inset shadow, so nothing shifts). Matches the nav's "you are
                // here" language.
                active
                  ? "bg-surface-2 shadow-[inset_2px_0_0_hsl(var(--accent))]"
                  : "hover:bg-surface-2",
              )}
            >
              <EntityAvatar
                kind={conversation.isClub ? "org" : "person"}
                name={conversation.participantName}
                src={conversation.participantAvatar}
                size="md"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium text-ink truncate">
                      {conversation.participantName}
                    </span>
                    {conversation.isMember && (
                      <Tag variant="neutral" className="shrink-0">
                        Member
                      </Tag>
                    )}
                  </div>
                  {conversation.lastMessage && (
                    <span className="font-data text-xs text-ink-3 shrink-0">
                      {formatDistanceToNow(new Date(conversation.lastMessageTime), {
                        addSuffix: false,
                      })}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-ink-2 truncate">
                    {conversation.lastMessage || (
                      <span className="text-ink-3 italic">New conversation</span>
                    )}
                  </p>
                  {conversation.unreadCount > 0 && (
                    <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-pill bg-accent px-1.5 font-mono text-[10.5px] font-bold leading-none text-accent-ink [font-variant-numeric:tabular-nums]">
                      {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                    </span>
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
