import { useRef, useEffect, useState } from "react";
import { EntityAvatar } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { MessageSquare, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Message, Conversation } from "@/hooks/useMessages";

interface MessageThreadProps {
  messages: Message[];
  currentUserId: string;
  conversation: Conversation | null;
  onDeleteMessage?: (messageId: string) => Promise<boolean>;
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

export function MessageThread({ messages, currentUserId, conversation, onDeleteMessage }: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleDeleteMessage = async () => {
    if (!messageToDelete || !onDeleteMessage) return;

    setIsDeleting(true);
    const success = await onDeleteMessage(messageToDelete);
    setIsDeleting(false);

    if (success) {
      toast.success("Message deleted");
    } else {
      toast.error("Failed to delete message");
    }
    setMessageToDelete(null);
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-surface-2">
        <MessageSquare className="w-16 h-16 text-ink-3 mb-4" />
        <h3 className="font-medium text-ink mb-1">Select a conversation</h3>
        <p className="text-sm text-ink-2">
          Choose a conversation from the list to start messaging.
        </p>
      </div>
    );
  }

  const avatarKind = conversation.isClub ? "org" : "person";

  return (
    <>
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-4 min-h-full flex flex-col justify-end">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <EntityAvatar
                kind={avatarKind}
                name={conversation.participantName}
                src={conversation.participantAvatar}
                size="xl"
                className="mb-4"
              />
              <h3 className="font-medium text-ink mb-1">
                {conversation.participantName}
              </h3>
              <p className="text-sm text-ink-2">
                Start the conversation by sending a message.
              </p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isSent = message.sender_id === currentUserId;
              const showAvatar =
                !isSent && (index === 0 || messages[index - 1].sender_id !== message.sender_id);

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-end gap-2 group",
                    isSent ? "justify-end" : "justify-start",
                  )}
                >
                  {!isSent && (
                    <div className="w-8 flex-shrink-0">
                      {showAvatar && (
                        <EntityAvatar
                          kind={avatarKind}
                          name={conversation.participantName}
                          src={conversation.participantAvatar}
                          size="sm"
                        />
                      )}
                    </div>
                  )}

                  {/* Delete button for sent messages — appears on hover, left of the bubble */}
                  {isSent && onDeleteMessage && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-3 hover:bg-bad-wash hover:text-bad"
                      aria-label="Delete message"
                      onClick={() => setMessageToDelete(message.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}

                  {/* Accent-sent / grey-received — the one deliberate accent use
                      outside "demands action" (Component decisions 2026-07-25). */}
                  <div
                    className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2.5",
                      isSent
                        ? "bg-accent text-accent-ink rounded-br-sm"
                        : "bg-surface-3 text-ink rounded-bl-sm",
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                    <p
                      className={cn(
                        "font-data text-[10px] mt-1",
                        isSent ? "text-accent-ink/70" : "text-ink-3",
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!messageToDelete} onOpenChange={() => setMessageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMessage}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
