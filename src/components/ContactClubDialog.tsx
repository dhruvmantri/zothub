import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageComposer } from "@/components/messaging/MessageComposer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContactClubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubName: string;
  clubUserId: string;
}

export function ContactClubDialog({
  open,
  onOpenChange,
  clubName,
  clubUserId,
}: ContactClubDialogProps) {
  const { user } = useAuth();
  const [isSending, setIsSending] = useState(false);

  const handleSend = async (content: string): Promise<boolean> => {
    if (!user) {
      toast.error("Please log in to send messages");
      return false;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: clubUserId,
        content,
      });

      if (error) throw error;

      toast.success("Message sent successfully!");
      onOpenChange(false);
      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
      return false;
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact {clubName}</DialogTitle>
          <DialogDescription>
            Send a message to this club. They'll be able to respond via the messaging system.
          </DialogDescription>
        </DialogHeader>
        <MessageComposer onSend={handleSend} isSending={isSending} />
      </DialogContent>
    </Dialog>
  );
}
