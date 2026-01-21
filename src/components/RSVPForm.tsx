import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, CalendarCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendRSVPConfirmation } from "@/lib/emailService";
import { format } from "date-fns";

interface RSVPQuestion {
  id: string;
  type: "short_text" | "long_text" | "single_choice" | "multiple_choice";
  question: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

interface Event {
  id: string;
  title: string;
  event_date?: string;
  location?: string | null;
  requires_approval?: boolean;
  club_profiles: {
    club_name: string;
  };
}

interface RSVPFormProps {
  event: Event;
  questions: RSVPQuestion[];
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

  const updateAnswer = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const toggleMultipleChoice = (questionId: string, option: string) => {
    const currentValue = (answers[questionId] as string[]) || [];
    const newValue = currentValue.includes(option)
      ? currentValue.filter((v) => v !== option)
      : [...currentValue, option];
    updateAnswer(questionId, newValue);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    questions.forEach((q) => {
      if (q.required) {
        const answer = answers[q.id];
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          newErrors[q.id] = "This field is required";
        } else if (typeof answer === "string" && answer.trim() === "") {
          newErrors[q.id] = "This field is required";
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please log in to RSVP");
      return;
    }

    if (questions.length > 0 && !validateForm()) {
      toast.error("Please fill in all required fields");
      return;
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

  const renderQuestion = (question: RSVPQuestion, index: number) => {
    const hasError = !!errors[question.id];

    return (
      <div key={question.id} className="space-y-3">
        <Label
          htmlFor={`question-${question.id}`}
          className={cn("text-base", hasError && "text-destructive")}
        >
          {index + 1}. {question.question}
          {question.required && <span className="text-destructive ml-1">*</span>}
        </Label>

        {question.type === "short_text" && (
          <Input
            id={`question-${question.id}`}
            placeholder={question.placeholder || "Your answer..."}
            value={(answers[question.id] as string) || ""}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className={cn(hasError && "border-destructive")}
          />
        )}

        {question.type === "long_text" && (
          <Textarea
            id={`question-${question.id}`}
            placeholder={question.placeholder || "Your answer..."}
            value={(answers[question.id] as string) || ""}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            rows={4}
            className={cn(hasError && "border-destructive")}
          />
        )}

        {question.type === "single_choice" && question.options && (
          <RadioGroup
            value={(answers[question.id] as string) || ""}
            onValueChange={(value) => updateAnswer(question.id, value)}
            className="space-y-2"
          >
            {question.options.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                <Label
                  htmlFor={`${question.id}-${option}`}
                  className="font-normal cursor-pointer"
                >
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {question.type === "multiple_choice" && question.options && (
          <div className="space-y-2">
            {question.options.map((option) => {
              const currentValue = (answers[question.id] as string[]) || [];
              const isChecked = currentValue.includes(option);

              return (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${question.id}-${option}`}
                    checked={isChecked}
                    onCheckedChange={() => toggleMultipleChoice(question.id, option)}
                  />
                  <Label
                    htmlFor={`${question.id}-${option}`}
                    className="font-normal cursor-pointer"
                  >
                    {option}
                  </Label>
                </div>
              );
            })}
          </div>
        )}

        {hasError && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors[question.id]}
          </p>
        )}
      </div>
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
              <div className="space-y-6">
                {questions.map((q, index) => renderQuestion(q, index))}
              </div>
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
