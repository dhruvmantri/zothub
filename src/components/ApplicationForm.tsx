import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Send, FileText } from "lucide-react";
import { applicationSchema, validateInput, formatValidationErrors, sanitizeText } from "@/lib/validation";
import { sendApplicationConfirmation, sendNewApplicationNotification } from "@/lib/emailService";
import { DynamicQuestionForm, useDynamicQuestionForm } from "@/components/forms/DynamicQuestionForm";
import { FileUpload } from "@/components/ui/file-upload";
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
  const [resumeFromProfile, setResumeFromProfile] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [studentEmail, setStudentEmail] = useState("");
  const [studentName, setStudentName] = useState("");
  
  const { validateAnswers } = useDynamicQuestionForm(questions);

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
          setResumeFromProfile(true);
        }
      }
    };
    fetchStudentProfile();
  }, [user]);

  const handleAnswerChange = useCallback((questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    // Clear error when user starts typing
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
      toast.error("Please log in to submit an application");
      return;
    }

    const validation = validateAnswers(answers);
    if (!validation.isValid) {
      setErrors(validation.errors);
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

      const { data: inserted, error } = await supabase
        .from("applications")
        .insert({
          opportunity_id: validationResult.data.opportunity_id,
          student_id: profile.id,
          answers: validationResult.data.answers,
          resume_url: validationResult.data.resume_url,
          status: "pending",
        })
        .select("id")
        .single();

      if (error) {
        console.error("Error submitting application:", error);
        if (error.code === "23505") {
          toast.error("You have already applied to this opportunity");
        } else {
          toast.error("Failed to submit application");
        }
        return;
      }

      // Send confirmation email to the student (non-blocking). Only the
      // authoritative application id is sent; the edge function verifies the caller
      // owns it and derives the recipient + content server-side (preference-gated).
      if (inserted?.id) {
        sendApplicationConfirmation(inserted.id).catch(console.error);
      }

      // Notify the owning club of the new application (non-blocking). Only the
      // authoritative application id is sent; the edge function verifies
      // ownership, resolves the club recipient, and de-duplicates. Runs only
      // after a confirmed insert, so a blocked duplicate never emails.
      if (inserted?.id) {
        sendNewApplicationNotification(inserted.id).catch(console.error);
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
            {/* Resume (optional) — defaults to the resume on the student's
                profile, shown as an attached file; can be replaced per-application */}
            <div className="space-y-2">
              <Label>Resume (optional)</Label>
              <FileUpload
                bucket="student-resumes"
                folder={user?.id || ""}
                accept=".pdf,.doc,.docx"
                maxSizeMB={10}
                currentUrl={resumeUrl}
                onUploadComplete={(url) => {
                  setResumeUrl(url);
                  setResumeFromProfile(false);
                }}
                onRemove={() => {
                  setResumeUrl("");
                  setResumeFromProfile(false);
                }}
                variant="file"
                placeholder="Upload your resume (PDF, DOC, DOCX)"
              />
              <p className="text-xs text-muted-foreground">
                {resumeUrl && resumeFromProfile
                  ? "Using the resume from your profile. Upload a different file to replace it for this application."
                  : "Attach a resume for this application (optional)."}
              </p>
            </div>

            {/* Application Questions */}
            {questions.length > 0 ? (
              <div className="border-t border-border pt-4">
                <h3 className="font-medium text-foreground mb-4">Application Questions</h3>
                <DynamicQuestionForm
                  questions={questions}
                  answers={answers}
                  errors={errors}
                  onAnswerChange={handleAnswerChange}
                />
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
