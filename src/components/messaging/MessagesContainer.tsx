import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, User, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationList } from "./ConversationList";
import { MessageThread } from "./MessageThread";
import { MessageComposer } from "./MessageComposer";
import { useMessages } from "@/hooks/useMessages";
import { cn } from "@/lib/utils";

interface MessagesContainerProps {
  className?: string;
}

export function MessagesContainer({ className }: MessagesContainerProps) {
  const {
    conversations,
    messages,
    selectedConversation,
    isLoading,
    isSending,
    selectConversation,
    sendMessage,
    user,
  } = useMessages();

  const currentConversation = conversations.find(
    (c) => c.participantId === selectedConversation
  );

  const handleSend = async (content: string) => {
    if (!selectedConversation) return false;
    return sendMessage(selectedConversation, content);
  };

  const handleBack = () => {
    selectConversation("");
  };

  return (
    <div className={cn("flex h-full bg-background rounded-lg border border-border overflow-hidden", className)}>
      {/* Conversation List - Hidden on mobile when conversation selected */}
      <div
        className={cn(
          "w-full md:w-80 lg:w-96 border-r border-border flex flex-col",
          selectedConversation && "hidden md:flex"
        )}
      >
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Messages</h2>
        </div>
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversation}
          onSelect={selectConversation}
          isLoading={isLoading}
        />
      </div>

      {/* Message Thread */}
      <div
        className={cn(
          "flex-1 flex flex-col",
          !selectedConversation && "hidden md:flex"
        )}
      >
        {/* Thread Header */}
        {currentConversation && (
          <div className="p-4 border-b border-border flex items-center gap-3 bg-card">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={handleBack}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            <Avatar className="h-10 w-10">
              <AvatarImage src={currentConversation.participantAvatar} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {currentConversation.participantName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {currentConversation.isClub ? (
                  <Building2 className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                ) : (
                  <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                )}
                <span className="font-medium text-foreground truncate">
                  {currentConversation.participantName}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {currentConversation.isClub ? "Club" : "Student"}
              </p>
            </div>
          </div>
        )}

        {/* Messages */}
        <MessageThread
          messages={messages}
          currentUserId={user?.id || ""}
          conversation={currentConversation || null}
        />

        {/* Composer */}
        <MessageComposer
          onSend={handleSend}
          isSending={isSending}
          disabled={!selectedConversation}
        />
      </div>
    </div>
  );
}
