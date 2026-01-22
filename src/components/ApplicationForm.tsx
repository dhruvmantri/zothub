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
import { Loader2, Send, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { applicationSchema, validateInput, formatValidationErrors, sanitizeText } from "@/lib/validation";
import { sendApplicationConfirmation } from "@/lib/emailService";
import type { FormQuestion, OpportunityForForm } from "@/types";

interface ApplicationFormProps {
  opportunity: OpportunityForForm;
  questions: FormQuestion[];
  onClose: () => void;
  onSuccess: () => void;
}

export function ApplicationForm({
  opportunity,
  questions,
  onClose,
  onSuccess,
}: ApplicationFormProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [resumeUrl, setResumeUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [studentEmail, setStudentEmail] = useState("");
  const [studentName, setStudentName] = useState("");

  // Fetch student profile for email prefill and resume URL
  useEffect(() => {
    const fetchStudentProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("student_profiles")
        .select("email, full_name, resume_url")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data) {
        setStudentEmail(data.email);
        setStudentName(data.full_name || "");
        if (data.resume_url && !resumeUrl) {
          setResumeUrl(data.resume_url);
        }
      }
    };
    fetchStudentProfile();
  }, [user]);

  const updateAnswer = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    // Clear error when user starts typing
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
      toast.error("Please log in to submit an application");
      return;
    }

    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      // Get student profile first
      const { data: profile, error: profileError } = await supabase
        .from("student_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        toast.error("Please complete your student profile first");
        return;
      }

      // Format answers for storage with sanitization
      const formattedAnswers = questions.map((q) => ({
        question_id: q.id,
        question: sanitizeText(q.question),
        answer: typeof answers[q.id] === "string" 
          ? sanitizeText(answers[q.id] as string)
          : (answers[q.id] as string[] || []).map(a => sanitizeText(a)),
      }));

      // Validate the complete submission with Zod
      const validationResult = validateInput(applicationSchema, {
        opportunity_id: opportunity.id,
        answers: formattedAnswers,
        resume_url: resumeUrl.trim() || null,
      });

      if (!validationResult.success) {
        const errorResult = validationResult as { success: false; errors: Record<string, string> };
        toast.error(formatValidationErrors(errorResult.errors));
        return;
      }

      const { error } = await supabase.from("applications").insert({
        opportunity_id: validationResult.data.opportunity_id,
        student_id: profile.id,
        answers: validationResult.data.answers,
        resume_url: validationResult.data.resume_url,
        status: "pending",
      });

      if (error) {
        console.error("Error submitting application:", error);
        if (error.code === "23505") {
          toast.error("You have already applied to this opportunity");
        } else {
          toast.error("Failed to submit application");
        }
        return;
      }

      // Send confirmation email (non-blocking)
      if (studentEmail) {
        sendApplicationConfirmation(
          studentEmail,
          studentName || "Student",
          opportunity.title,
          opportunity.club_profiles?.club_name || "the club"
        ).catch(console.error);
      }

      toast.success("Application submitted successfully!");
      onSuccess();
    } catch (err) {
      console.error("Error:", err);
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = (question: FormQuestion, index: number) => {
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
            <FileText className="w-5 h-5 text-accent" />
            Apply to {opportunity.title}
          </DialogTitle>
          <DialogDescription>
            Submit your application to {opportunity.club_profiles?.club_name}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-6 py-6 space-y-6">
            {/* Resume URL (optional) */}
            <div className="space-y-2">
              <Label htmlFor="resumeUrl">Resume URL (optional)</Label>
              <Input
                id="resumeUrl"
                type="url"
                placeholder="https://drive.google.com/your-resume"
                value={resumeUrl}
                onChange={(e) => setResumeUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Share a link to your resume (Google Drive, Dropbox, etc.)
              </p>
            </div>

            {/* Application Questions */}
            {questions.length > 0 ? (
              <div className="space-y-6">
                <div className="border-t border-border pt-4">
                  <h3 className="font-medium text-foreground mb-4">Application Questions</h3>
                  <div className="space-y-6">
                    {questions.map((q, index) => renderQuestion(q, index))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p>No additional questions required for this application.</p>
                <p className="text-sm mt-1">Just click submit to apply!</p>
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
                <Send className="w-4 h-4 mr-2" />
                Submit Application
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
