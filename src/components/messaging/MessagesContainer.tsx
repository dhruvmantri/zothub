import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { EntityAvatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/badge";
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
    startConversation,
    sendMessage,
    deleteMessage,
    user,
  } = useMessages();

  // The ?to=<user_id> entry point (e.g. the "Message a member" button on the
  // club page). Open/create that thread once, then strip the param so a
  // refresh or back-navigation doesn't reopen it.
  const [searchParams, setSearchParams] = useSearchParams();
  const handledTo = useRef<string | null>(null);
  useEffect(() => {
    const to = searchParams.get("to");
    if (to && handledTo.current !== to) {
      handledTo.current = to;
      startConversation(to);
      const next = new URLSearchParams(searchParams);
      next.delete("to");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, startConversation, setSearchParams]);

  const currentConversation = conversations.find(
    (c) => c.participantId === selectedConversation,
  );

  const handleSend = async (content: string) => {
    if (!selectedConversation) return false;
    return sendMessage(selectedConversation, content);
  };

  const handleBack = () => {
    selectConversation("");
  };

  const roleLabel = (isClub: boolean, isMember?: boolean) =>
    isClub ? "Club" : isMember ? "Club member" : "Student";

  return (
    <div className={cn("flex h-full overflow-hidden rounded-lg border border-line bg-surface", className)}>
      {/* Conversation list — hidden on mobile once a thread is open */}
      <div
        className={cn(
          "flex w-full flex-col border-r border-line md:w-80 lg:w-96",
          selectedConversation && "hidden md:flex",
        )}
      >
        <div className="border-b border-line p-4">
          <h2 className="font-semibold text-ink">Messages</h2>
        </div>
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversation}
          onSelect={selectConversation}
          isLoading={isLoading}
        />
      </div>

      {/* Message thread */}
      <div className={cn("flex flex-1 flex-col", !selectedConversation && "hidden md:flex")}>
        {currentConversation && (
          <div className="flex items-center gap-3 border-b border-line bg-surface p-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Back to conversations"
              onClick={handleBack}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            <EntityAvatar
              kind={currentConversation.isClub ? "org" : "person"}
              name={currentConversation.participantName}
              src={currentConversation.participantAvatar}
              size="md"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {/* The header name links to a club's public page (maintainer
                    request). Students/members have no public page, so plain. */}
                {currentConversation.isClub && currentConversation.participantProfileId ? (
                  <Link
                    to={`/clubs/${currentConversation.participantProfileId}`}
                    className="truncate font-medium text-ink transition-colors hover:text-accent-text"
                  >
                    {currentConversation.participantName}
                  </Link>
                ) : (
                  <span className="truncate font-medium text-ink">
                    {currentConversation.participantName}
                  </span>
                )}
                {currentConversation.isMember && (
                  <Tag variant="neutral" className="shrink-0">
                    Member
                  </Tag>
                )}
              </div>
              <p className="text-xs text-ink-2">
                {roleLabel(currentConversation.isClub, currentConversation.isMember)}
              </p>
            </div>
          </div>
        )}

        <MessageThread
          messages={messages}
          currentUserId={user?.id || ""}
          conversation={currentConversation || null}
          onDeleteMessage={deleteMessage}
        />

        <MessageComposer onSend={handleSend} isSending={isSending} disabled={!selectedConversation} />
      </div>
    </div>
  );
}
