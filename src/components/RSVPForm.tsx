import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, CalendarCheck } from "lucide-react";
import { sendRSVPConfirmation } from "@/lib/emailService";
import { format } from "date-fns";
import { DynamicQuestionForm, useDynamicQuestionForm } from "@/components/forms/DynamicQuestionForm";
import type { FormQuestion, EventForForm } from "@/types";

interface RSVPFormProps {
  event: EventForForm;
  questions: FormQuestion[];
  studentProfileId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RSVPForm({
  event,
  questions,
  studentProfileId,
  onClose,
  onSuccess,
}: RSVPFormProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [studentEmail, setStudentEmail] = useState("");
  const [studentName, setStudentName] = useState("");

  const { validateAnswers } = useDynamicQuestionForm(questions);

  // Fetch student profile info for email
  useEffect(() => {
    const fetchStudentInfo = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("student_profiles")
        .select("email, full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setStudentEmail(data.email);
        setStudentName(data.full_name || "");
      }
    };
    fetchStudentInfo();
  }, [user]);

  const handleAnswerChange = useCallback((questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  }, [errors]);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please log in to RSVP");
      return;
    }

    if (questions.length > 0) {
      const validation = validateAnswers(answers);
      if (!validation.isValid) {
        setErrors(validation.errors);
        toast.error("Please fill in all required fields");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Format answers for storage
      const formattedAnswers = questions.map((q) => ({
        question_id: q.id,
        question: q.question,
        answer: answers[q.id] || (q.type === "multiple_choice" ? [] : ""),
      }));

      const status = event.requires_approval ? "pending" : "confirmed";

      const { error } = await supabase.from("rsvps").insert({
        event_id: event.id,
        student_id: studentProfileId,
        answers: formattedAnswers,
        status,
      });

      if (error) {
        console.error("Error submitting RSVP:", error);
        if (error.code === "23505") {
          toast.error("You have already RSVP'd to this event");
        } else {
          toast.error("Failed to submit RSVP");
        }
        return;
      }

      if (event.requires_approval) {
        toast.success("RSVP submitted! Awaiting approval from the organizer.");
      } else {
        toast.success("RSVP confirmed! See you there!");
      }

      // Send confirmation email (non-blocking)
      if (studentEmail) {
        sendRSVPConfirmation(
          studentEmail,
          studentName || "Student",
          event.title,
          event.club_profiles?.club_name || "the club",
          event.event_date ? format(new Date(event.event_date), "MMMM d, yyyy 'at' h:mm a") : "TBD",
          event.location || "TBD",
          event.requires_approval || false
        ).catch(console.error);
      }

      onSuccess();
    } catch (err) {
      console.error("Error:", err);
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-accent" />
            RSVP to {event.title}
          </DialogTitle>
          <DialogDescription>
            {event.requires_approval 
              ? `Your RSVP will be reviewed by ${event.club_profiles?.club_name}`
              : `Confirm your attendance for this event by ${event.club_profiles?.club_name}`
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-6 py-6 space-y-6">
            {questions.length > 0 ? (
              <DynamicQuestionForm
                questions={questions}
                answers={answers}
                errors={errors}
                onAnswerChange={handleAnswerChange}
              />
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p>No additional information required.</p>
                <p className="text-sm mt-1">Just click confirm to RSVP!</p>
              </div>
            )}

            {event.requires_approval && (
              <div className="bg-muted/50 border border-border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Note:</strong> This event requires approval. 
                  Your RSVP will be pending until approved by the organizer.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CalendarCheck className="w-4 h-4 mr-2" />
                {event.requires_approval ? "Submit RSVP" : "Confirm RSVP"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
