import { useState, useCallback } from "react";
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
import { DynamicQuestionForm, useDynamicQuestionForm } from "@/components/forms/DynamicQuestionForm";
import type { RSVPAnswer } from "@/hooks/useEventRSVP";
import type { FormQuestion, EventForForm } from "@/types";

/**
 * Collects the club's RSVP questions. It no longer writes.
 *
 * The upsert used to live here AND in useEventRSVP, with
 * `requires_approval ? "pending" : "confirmed"` spelled out in three places.
 * A write whose cache invalidation lives in another file is exactly how a
 * stale attendee count survives a migration (contract M11), so this now
 * validates, formats and hands the answers up; useEventRSVP owns the single
 * mutation, the status decision and the confirmation email.
 */
interface RSVPFormProps {
  event: EventForForm;
  questions: FormQuestion[];
  /** Receives the formatted answers. The caller owns the write. */
  onSubmit: (answers: RSVPAnswer[]) => void;
  isSubmitting: boolean;
  onClose: () => void;
}

export function RSVPForm({
  event,
  questions,
  onSubmit,
  isSubmitting,
  onClose,
}: RSVPFormProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { validateAnswers } = useDynamicQuestionForm(questions);

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

  const handleSubmit = () => {
    if (questions.length > 0) {
      const validation = validateAnswers(answers);
      if (!validation.isValid) {
        setErrors(validation.errors);
        toast.error("Please fill in all required fields");
        return;
      }
    }

    onSubmit(
      questions.map((q) => ({
        question_id: q.id,
        question: q.question,
        answer: answers[q.id] || (q.type === "multiple_choice" ? [] : ""),
      })),
    );
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
