import { useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { MessageSquare } from "lucide-react";
import type { Message, Conversation } from "@/hooks/useMessages";

interface MessageThreadProps {
  messages: Message[];
  currentUserId: string;
  conversation: Conversation | null;
}

function formatMessageDate(dateString: string) {
  const date = new Date(dateString);
  if (isToday(date)) {
    return format(date, "h:mm a");
  }
  if (isYesterday(date)) {
    return `Yesterday, ${format(date, "h:mm a")}`;
  }
  return format(date, "MMM d, h:mm a");
}

export function MessageThread({ messages, currentUserId, conversation }: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-secondary/20">
        <MessageSquare className="w-16 h-16 text-muted-foreground/20 mb-4" />
        <h3 className="font-medium text-foreground mb-1">Select a conversation</h3>
        <p className="text-sm text-muted-foreground">
          Choose a conversation from the list to start messaging.
        </p>
      </div>
    );
  }

  const initials = conversation.participantName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="p-4 space-y-4 min-h-full flex flex-col justify-end">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <Avatar className="h-16 w-16 mb-4">
              <AvatarImage src={conversation.participantAvatar} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <h3 className="font-medium text-foreground mb-1">
              {conversation.participantName}
            </h3>
            <p className="text-sm text-muted-foreground">
              Start the conversation by sending a message.
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isSent = message.sender_id === currentUserId;
            const showAvatar = !isSent && (
              index === 0 || messages[index - 1].sender_id !== message.sender_id
            );

            return (
              <div
                key={message.id}
                className={cn(
                  "flex items-end gap-2",
                  isSent ? "justify-end" : "justify-start"
                )}
              >
                {!isSent && (
                  <div className="w-8 flex-shrink-0">
                    {showAvatar && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={conversation.participantAvatar} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[70%] rounded-2xl px-4 py-2.5",
                    isSent
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-secondary text-foreground rounded-bl-sm"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                  <p
                    className={cn(
                      "text-[10px] mt-1",
                      isSent ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}
                  >
                    {formatMessageDate(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
}
