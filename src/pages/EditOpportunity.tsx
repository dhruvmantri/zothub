import { useState, useEffect } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ClubLayout } from "@/components/club/ClubLayout";
import { 
  ApplicationQuestionsBuilder, 
  ApplicationQuestion 
} from "@/components/dashboard/ApplicationQuestionsBuilder";
import { opportunitySchema, validateInput, formatValidationErrors, sanitizeText } from "@/lib/validation";
import {
  Briefcase,
  FileText,
  Calendar,
  HelpCircle,
  ArrowLeft,
  Save,
  Loader2,
  Eye,
} from "lucide-react";

const OPPORTUNITY_TYPES = [
  { value: "leadership", label: "Leadership Role" },
  { value: "project", label: "Project Team" },
  { value: "internship", label: "Internship" },
  { value: "volunteer", label: "Volunteer" },
  { value: "committee", label: "Committee" },
  { value: "other", label: "Other" },
];

export default function EditOpportunity() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [deadline, setDeadline] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [applicationQuestions, setApplicationQuestions] = useState<ApplicationQuestion[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) {
      fetchOpportunity();
    }
  }, [id]);

  const fetchOpportunity = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("opportunities")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching opportunity:", error);
      toast.error("Failed to load opportunity");
      navigate("/club/dashboard");
      return;
    }

    setTitle(data.title);
    setType(data.type);
    setDescription(data.description || "");
    setRequirements(data.requirements || "");
    setDeadline(data.deadline ? new Date(data.deadline).toISOString().slice(0, 16) : "");
    setIsActive(data.is_active ?? true);
    
    // Parse application questions
    const questions = (data.application_questions as unknown) as ApplicationQuestion[] | null;
    setApplicationQuestions(questions || []);
    
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent, asDraft = false) => {
    e.preventDefault();
    setFieldErrors({});

    if (!user || !id) {
      toast.error("You must be logged in");
      return;
    }

    // Prepare questions for validation with sanitization
    const questionsForValidation = applicationQuestions.map(q => ({
      id: q.id,
      type: q.type,
      question: sanitizeText(q.question),
      required: q.required,
      options: q.options ? q.options.map(opt => sanitizeText(opt)) : null,
      placeholder: q.placeholder || null,
    }));

    // Validate with Zod schema
    const validationResult = validateInput(opportunitySchema, {
      title: title.trim(),
      type: type as "leadership" | "project" | "internship" | "volunteer" | "committee" | "other",
      description: description.trim() || null,
      requirements: requirements.trim() || null,
      deadline: deadline || null,
      is_active: asDraft ? false : isActive,
      application_questions: questionsForValidation,
    });

    if (!validationResult.success) {
      const errorResult = validationResult as { success: false; errors: Record<string, string> };
      setFieldErrors(errorResult.errors);
      toast.error(formatValidationErrors(errorResult.errors));
      return;
    }

    setIsSubmitting(true);

    try {
      const validatedData = validationResult.data;

      const { error } = await supabase
        .from("opportunities")
        .update({
          title: validatedData.title,
          type: validatedData.type,
          description: validatedData.description,
          requirements: validatedData.requirements,
          deadline: validatedData.deadline ? new Date(validatedData.deadline).toISOString() : null,
          is_active: validatedData.is_active,
          application_questions: validatedData.application_questions,
        })
        .eq("id", id);

      if (error) {
        console.error("Error updating opportunity:", error);
        toast.error("Failed to update opportunity");
        return;
      }

      toast.success(asDraft ? "Opportunity saved as draft" : "Opportunity updated successfully!");
      navigate("/club/dashboard");
    } catch (err) {
      console.error("Error:", err);
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <ClubLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </ClubLayout>
    );
  }

  return (
    <ClubLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/club/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Edit Opportunity
          </h1>
          <p className="text-muted-foreground mt-1">
            Update the details of your opportunity
          </p>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-accent" />
                Basic Information
              </CardTitle>
              <CardDescription>Core details about the opportunity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Marketing Lead, Software Developer Intern"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select value={type} onValueChange={setType} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select opportunity type" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPPORTUNITY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the opportunity, responsibilities, and what makes it exciting..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                />
              </div>
            </CardContent>
          </Card>

          {/* Requirements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent" />
                Requirements
              </CardTitle>
              <CardDescription>What qualifications are you looking for?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="requirements">Requirements & Qualifications</Label>
                <Textarea
                  id="requirements"
                  placeholder="List the skills, experience, or qualifications needed..."
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Tip: Use bullet points or line breaks for better readability
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Deadline & Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent" />
                Deadline & Status
              </CardTitle>
              <CardDescription>When does this opportunity close?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deadline">Application Deadline</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for rolling applications
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label htmlFor="isActive" className="text-base">Published</Label>
                  <p className="text-sm text-muted-foreground">
                    Turn off to unpublish this opportunity
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </CardContent>
          </Card>

          {/* Application Questions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-accent" />
                Application Questions
              </CardTitle>
              <CardDescription>
                Custom questions applicants will answer when applying
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ApplicationQuestionsBuilder
                questions={applicationQuestions}
                onChange={setApplicationQuestions}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" asChild>
              <Link to="/club/dashboard">Cancel</Link>
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={(e) => handleSubmit(e, true)}
              disabled={isSubmitting}
            >
              <Eye className="w-4 h-4 mr-2" />
              Save as Draft
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </ClubLayout>
  );
}
