import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileLookup, ProfileInfo } from "./useProfileLookup";

export type { ProfileInfo };

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  /** club_profiles.id / student_profiles.id — lets the thread header link a
   *  club participant to their public page. */
  participantProfileId?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isClub: boolean;
  /** A person who sits on a club's team — labelled MEMBER so a student never
   *  mistakes them for the official club account (Positioning §8). */
  isMember?: boolean;
  /** Opened via a "message a member" link but no messages exchanged yet, so it
   *  is not persisted until the first send. */
  isDraft?: boolean;
}

export function useMessages() {
  const { user, role } = useAuth();
  const { fetchProfileInfo, fetchProfileInfoBatch } = useProfileLookup();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Get all messages where user is sender or receiver
      const { data: allMessages, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      // Group messages by conversation partner
      const conversationMap = new Map<string, {
        messages: Message[];
        unreadCount: number;
      }>();

      for (const msg of allMessages || []) {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        
        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, { messages: [], unreadCount: 0 });
        }
        
        conversationMap.get(partnerId)!.messages.push(msg);
        
        // Count unread messages from this partner
        if (msg.receiver_id === user.id && !msg.is_read) {
          conversationMap.get(partnerId)!.unreadCount++;
        }
      }

      // Batch fetch all profiles at once (fix N+1 query)
      const partnerIds = Array.from(conversationMap.keys());
      const profiles = await fetchProfileInfoBatch(partnerIds);
      
      // Build conversation list using cached profiles
      const conversationList: Conversation[] = [];

      for (const [partnerId, data] of conversationMap) {
        const profile = profiles.get(partnerId);
        const lastMsg = data.messages[0];

        conversationList.push({
          participantId: partnerId,
          participantName: profile?.name || "Unknown User",
          participantAvatar: profile?.avatar,
          participantProfileId: profile?.id,
          lastMessage: lastMsg.content,
          lastMessageTime: lastMsg.created_at,
          unreadCount: data.unreadCount,
          isClub: profile?.isClub || false,
        });
      }

      // Which of the non-club partners are actually club team members? One
      // batch read (club_team_members is already public — it drives the members
      // list on the club page). Degrades quietly: no rows → no MEMBER chips.
      const nonClubIds = conversationList.filter((c) => !c.isClub).map((c) => c.participantId);
      if (nonClubIds.length > 0) {
        const { data: members } = await supabase
          .from("club_team_members")
          .select("user_id")
          .in("user_id", nonClubIds);
        const memberSet = new Set((members || []).map((m) => m.user_id));
        conversationList.forEach((c) => {
          if (memberSet.has(c.participantId)) c.isMember = true;
        });
      }

      // Sort by last message time
      conversationList.sort((a, b) =>
        new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      );

      setConversations(conversationList);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, fetchProfileInfo, fetchProfileInfoBatch]);

  // Fetch messages for a specific conversation
  const fetchMessagesForConversation = useCallback(async (partnerId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      setMessages(data || []);

      // Mark messages as read
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("sender_id", partnerId)
        .eq("receiver_id", user.id)
        .eq("is_read", false);

      // Update unread count in conversations
      setConversations(prev => 
        prev.map(conv => 
          conv.participantId === partnerId 
            ? { ...conv, unreadCount: 0 }
            : conv
        )
      );
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }, [user]);

  // Send a message
  const sendMessage = useCallback(async (receiverId: string, content: string) => {
    if (!user || !content.trim()) return false;

    setIsSending(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          content: content.trim(),
        })
        .select()
        .single();

      if (error) {
        console.error("Error sending message:", error);
        return false;
      }

      // Add to local messages
      setMessages(prev => [...prev, data]);

      // Update conversation list
      const profile = await fetchProfileInfo(receiverId);
      setConversations(prev => {
        const existing = prev.find(c => c.participantId === receiverId);
        const updated: Conversation = {
          participantId: receiverId,
          participantName: profile?.name || existing?.participantName || "Unknown",
          participantAvatar: profile?.avatar || existing?.participantAvatar,
          participantProfileId: profile?.id ?? existing?.participantProfileId,
          lastMessage: content,
          lastMessageTime: data.created_at,
          unreadCount: 0,
          isClub: profile?.isClub || existing?.isClub || false,
          isMember: existing?.isMember,
          // No longer a draft — it now has a real message behind it.
          isDraft: false,
        };

        const filtered = prev.filter(c => c.participantId !== receiverId);
        return [updated, ...filtered];
      });

      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      return false;
    } finally {
      setIsSending(false);
    }
  }, [user, fetchProfileInfo]);

  // Delete a message
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId)
        .eq("sender_id", user.id);

      if (error) {
        console.error("Error deleting message:", error);
        return false;
      }

      // Remove from local messages
      setMessages(prev => prev.filter(m => m.id !== messageId));

      // Update conversation list if this was the last message
      if (selectedConversation) {
        const remainingMessages = messages.filter(m => m.id !== messageId);
        if (remainingMessages.length > 0) {
          const lastMsg = remainingMessages[remainingMessages.length - 1];
          setConversations(prev =>
            prev.map(c =>
              c.participantId === selectedConversation
                ? { ...c, lastMessage: lastMsg.content, lastMessageTime: lastMsg.created_at }
                : c
            )
          );
        } else {
          // No messages left in this conversation
          setConversations(prev =>
            prev.filter(c => c.participantId !== selectedConversation)
          );
          setSelectedConversation(null);
        }
      }

      return true;
    } catch (error) {
      console.error("Error deleting message:", error);
      return false;
    }
  }, [user, selectedConversation, messages]);

  // Get total unread count
  const getTotalUnreadCount = useCallback(() => {
    return conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
  }, [conversations]);

  // Select a conversation
  const selectConversation = useCallback((partnerId: string) => {
    setSelectedConversation(partnerId);
    fetchMessagesForConversation(partnerId);
  }, [fetchMessagesForConversation]);

  // Open a thread with a specific user — the ?to=<user_id> entry point behind
  // the "Message a member" button on the club page. If we've never spoken, a
  // draft conversation is added so the header + composer render immediately;
  // it persists on first send (see sendMessage).
  const startConversation = useCallback(async (partnerId: string) => {
    if (!user || !partnerId || partnerId === user.id) return;

    if (conversations.some((c) => c.participantId === partnerId)) {
      selectConversation(partnerId);
      return;
    }

    const profile = await fetchProfileInfo(partnerId);
    let isMember = false;
    if (profile && !profile.isClub) {
      const { data: member } = await supabase
        .from("club_team_members")
        .select("user_id")
        .eq("user_id", partnerId)
        .maybeSingle();
      isMember = !!member;
    }

    setConversations((prev) => {
      if (prev.some((c) => c.participantId === partnerId)) return prev;
      const draft: Conversation = {
        participantId: partnerId,
        participantName: profile?.name || "Unknown User",
        participantAvatar: profile?.avatar,
        participantProfileId: profile?.id,
        lastMessage: "",
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0,
        isClub: profile?.isClub || false,
        isMember,
        isDraft: true,
      };
      return [draft, ...prev];
    });
    selectConversation(partnerId);
  }, [user, conversations, fetchProfileInfo, selectConversation]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user, fetchConversations]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // If this is the active conversation, add the message
          if (selectedConversation === newMessage.sender_id) {
            setMessages(prev => [...prev, newMessage]);
            
            // Mark as read immediately
            await supabase
              .from("messages")
              .update({ is_read: true })
              .eq("id", newMessage.id);
          } else {
            // Update unread count
            setConversations(prev => {
              const existing = prev.find(c => c.participantId === newMessage.sender_id);
              if (existing) {
                return prev.map(c => 
                  c.participantId === newMessage.sender_id
                    ? { 
                        ...c, 
                        lastMessage: newMessage.content,
                        lastMessageTime: newMessage.created_at,
                        unreadCount: c.unreadCount + 1 
                      }
                    : c
                ).sort((a, b) => 
                  new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
                );
              }
              // New conversation - fetch profile info
              fetchProfileInfo(newMessage.sender_id).then(profile => {
                setConversations(current => [{
                  participantId: newMessage.sender_id,
                  participantName: profile?.name || "Unknown",
                  participantAvatar: profile?.avatar,
                  participantProfileId: profile?.id,
                  lastMessage: newMessage.content,
                  lastMessageTime: newMessage.created_at,
                  unreadCount: 1,
                  isClub: profile?.isClub || false,
                }, ...current]);
              });
              return prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedConversation, fetchProfileInfo]);

  return {
    conversations,
    messages,
    selectedConversation,
    isLoading,
    isSending,
    selectConversation,
    startConversation,
    sendMessage,
    deleteMessage,
    getTotalUnreadCount,
    fetchConversations,
    user,
    role,
  };
}
