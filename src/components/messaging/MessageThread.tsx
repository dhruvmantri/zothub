import { useRef, useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    <>
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
                    "flex items-end gap-2 group",
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

                  {/* Delete button for sent messages - appears on left */}
                  {isSent && onDeleteMessage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => setMessageToDelete(message.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!messageToDelete} onOpenChange={() => setMessageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
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
                  Deleting...
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
