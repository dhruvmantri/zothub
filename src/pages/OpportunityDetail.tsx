import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ApplicationForm } from "@/components/ApplicationForm";
import {
  ArrowLeft,
  Clock,
  Users,
  Building2,
  Calendar,
  FileText,
  CheckCircle2,
  Globe,
  Bookmark,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ApplicationQuestion {
  id: string;
  type: "short_text" | "long_text" | "single_choice" | "multiple_choice";
  question: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

interface Opportunity {
  id: string;
  title: string;
  type: string;
  description: string | null;
  requirements: string | null;
  deadline: string | null;
  application_questions: ApplicationQuestion[] | null;
  created_at: string;
  club_id: string;
  club_profiles: {
    id: string;
    club_name: string;
    logo_url: string | null;
    description: string | null;
    website_url: string | null;
  };
  applications: { id: string }[];
}

const typeColors = {
  leadership: "accent",
  project: "success",
  internship: "default",
  volunteer: "muted",
} as const;

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasApplied, setHasApplied] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  useEffect(() => {
    if (id) {
      fetchOpportunity();
      if (user) {
        checkExistingApplication();
        checkBookmark();
      }
    }
  }, [id, user]);

  const fetchOpportunity = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("opportunities")
        .select(`
          id,
          title,
          type,
          description,
          requirements,
          deadline,
          application_questions,
          created_at,
          club_id,
          club_profiles (
            id,
            club_name,
            logo_url,
            description,
            website_url
          ),
          applications (
            id
          )
        `)
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Error fetching opportunity:", error);
        toast.error("Failed to load opportunity");
        return;
      }

      if (!data) {
        toast.error("Opportunity not found");
        navigate("/opportunities");
        return;
      }

      // Parse application_questions from JSON
      let parsedQuestions: ApplicationQuestion[] | null = null;
      if (data.application_questions && Array.isArray(data.application_questions)) {
        parsedQuestions = (data.application_questions as unknown[]).map((q: unknown) => {
          const question = q as Record<string, unknown>;
          return {
            id: String(question.id || ""),
            type: (question.type as ApplicationQuestion["type"]) || "short_text",
            question: String(question.question || ""),
            required: Boolean(question.required),
            options: Array.isArray(question.options) ? question.options as string[] : undefined,
            placeholder: question.placeholder ? String(question.placeholder) : undefined,
          };
        });
      }

      const parsedData: Opportunity = {
        id: data.id,
        title: data.title,
        type: data.type,
        description: data.description,
        requirements: data.requirements,
        deadline: data.deadline,
        application_questions: parsedQuestions,
        created_at: data.created_at,
        club_id: data.club_id,
        club_profiles: data.club_profiles as Opportunity["club_profiles"],
        applications: data.applications as { id: string }[],
      };

      setOpportunity(parsedData);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const checkExistingApplication = async () => {
    if (!user || !id) return;

    try {
      // Get student profile first
      const { data: profile } = await supabase
        .from("student_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) return;

      const { data, error } = await supabase
        .from("applications")
        .select("id")
        .eq("opportunity_id", id)
        .eq("student_id", profile.id)
        .maybeSingle();

      if (!error && data) {
        setHasApplied(true);
      }
    } catch (err) {
      console.error("Error checking application:", err);
    }
  };

  const checkBookmark = async () => {
    if (!user || !id) return;

    try {
      const { data, error } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", user.id)
        .eq("opportunity_id", id)
        .maybeSingle();

      if (!error && data) {
        setIsBookmarked(true);
      }
    } catch (err) {
      console.error("Error checking bookmark:", err);
    }
  };

  const toggleBookmark = async () => {
    if (!user) {
      toast.error("Please log in to bookmark opportunities");
      return;
    }

    try {
      if (isBookmarked) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", user.id)
          .eq("opportunity_id", id);

        if (error) throw error;
        setIsBookmarked(false);
        toast.success("Bookmark removed");
      } else {
        const { error } = await supabase.from("bookmarks").insert({
          user_id: user.id,
          opportunity_id: id,
        });

        if (error) throw error;
        setIsBookmarked(true);
        toast.success("Opportunity bookmarked");
      }
    } catch (err) {
      console.error("Error toggling bookmark:", err);
      toast.error("Failed to update bookmark");
    }
  };

  const handleApplicationSuccess = () => {
    setHasApplied(true);
    setShowApplicationForm(false);
  };

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return "Rolling applications";
    try {
      return format(new Date(deadline), "MMMM d, yyyy 'at' h:mm a");
    } catch {
      return "Rolling applications";
    }
  };

  const isDeadlinePassed = (deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  const getTypeVariant = (type: string) => {
    const validTypes = Object.keys(typeColors);
    return validTypes.includes(type.toLowerCase())
      ? typeColors[type.toLowerCase() as keyof typeof typeColors]
      : "muted";
  };

  if (isLoading) {
    return (
      <RoleBasedLayout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="space-y-6">
            <Skeleton className="h-12 w-3/4" />
            <div className="flex gap-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-60 w-full" />
          </div>
        </div>
      </RoleBasedLayout>
    );
  }

  if (!opportunity) {
    return (
      <RoleBasedLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h2 className="font-display text-2xl font-bold text-foreground mb-4">
            Opportunity not found
          </h2>
          <Button asChild>
            <Link to="/opportunities">Browse Opportunities</Link>
          </Button>
        </div>
      </RoleBasedLayout>
    );
  }

  return (
    <RoleBasedLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-secondary/30 border-b border-border/50">
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            <Button variant="ghost" size="sm" asChild className="mb-6">
              <Link to="/opportunities">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Opportunities
              </Link>
            </Button>

            <div className="flex items-start gap-4 mb-6">
              <div className="w-16 h-16 rounded-xl bg-card flex items-center justify-center overflow-hidden border border-border">
                {opportunity.club_profiles?.logo_url ? (
                  <img
                    src={opportunity.club_profiles.logo_url}
                    alt={opportunity.club_profiles.club_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-display text-2xl font-bold text-muted-foreground">
                    {opportunity.club_profiles?.club_name.charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <Link
                  to={`/clubs/${opportunity.club_profiles?.id}`}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {opportunity.club_profiles?.club_name}
                </Link>
                <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mt-1">
                  {opportunity.title}
                </h1>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <Badge variant={getTypeVariant(opportunity.type)} className="capitalize">
                    {opportunity.type}
                  </Badge>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{opportunity.applications?.length || 0} applicants</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>Posted {format(new Date(opportunity.created_at), "MMM d, yyyy")}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              {role === "student" && !hasApplied && !isDeadlinePassed(opportunity.deadline) && (
                <Button onClick={() => setShowApplicationForm(true)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Apply Now
                </Button>
              )}
              {hasApplied && (
                <Button variant="secondary" disabled>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Already Applied
                </Button>
              )}
              {isDeadlinePassed(opportunity.deadline) && !hasApplied && (
                <Button variant="secondary" disabled>
                  <Clock className="w-4 h-4 mr-2" />
                  Deadline Passed
                </Button>
              )}
              <Button
                variant="outline"
                onClick={toggleBookmark}
                className={cn(isBookmarked && "text-accent")}
              >
                <Bookmark className={cn("w-4 h-4 mr-2", isBookmarked && "fill-current")} />
                {isBookmarked ? "Bookmarked" : "Bookmark"}
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Deadline Alert */}
              {opportunity.deadline && (
                <Card className={cn(
                  "border-l-4",
                  isDeadlinePassed(opportunity.deadline) 
                    ? "border-l-destructive bg-destructive/5" 
                    : "border-l-accent bg-accent/5"
                )}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <Clock className={cn(
                        "w-5 h-5",
                        isDeadlinePassed(opportunity.deadline) ? "text-destructive" : "text-accent"
                      )} />
                      <div>
                        <p className="font-medium text-foreground">
                          {isDeadlinePassed(opportunity.deadline) ? "Applications Closed" : "Application Deadline"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDeadline(opportunity.deadline)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Description */}
              <Card>
                <CardHeader>
                  <CardTitle>About This Opportunity</CardTitle>
                </CardHeader>
                <CardContent>
                  {opportunity.description ? (
                    <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                      {opportunity.description}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">No description provided</p>
                  )}
                </CardContent>
              </Card>

              {/* Requirements */}
              {opportunity.requirements && (
                <Card>
                  <CardHeader>
                    <CardTitle>Requirements & Qualifications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                      {opportunity.requirements}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Application Questions Preview */}
              {opportunity.application_questions && opportunity.application_questions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Application Questions</CardTitle>
                    <CardDescription>
                      You'll be asked to answer {opportunity.application_questions.length} question(s) when applying
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {opportunity.application_questions.map((q, index) => (
                        <li key={q.id} className="flex items-start gap-2 text-sm">
                          <span className="text-muted-foreground">{index + 1}.</span>
                          <span className="text-foreground">
                            {q.question}
                            {q.required && <span className="text-destructive ml-1">*</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Club Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">About the Club</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
                      {opportunity.club_profiles?.logo_url ? (
                        <img
                          src={opportunity.club_profiles.logo_url}
                          alt={opportunity.club_profiles.club_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {opportunity.club_profiles?.club_name}
                      </p>
                    </div>
                  </div>
                  {opportunity.club_profiles?.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {opportunity.club_profiles.description}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <Link to={`/clubs/${opportunity.club_profiles?.id}`}>
                        View Club
                      </Link>
                    </Button>
                    {opportunity.club_profiles?.website_url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={opportunity.club_profiles.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Globe className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Apply CTA */}
              {role === "student" && !hasApplied && !isDeadlinePassed(opportunity.deadline) && (
                <Card className="bg-primary text-primary-foreground">
                  <CardContent className="py-6 text-center">
                    <h3 className="font-display font-semibold mb-2">Ready to Apply?</h3>
                    <p className="text-sm opacity-90 mb-4">
                      Submit your application and take the next step
                    </p>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => setShowApplicationForm(true)}
                    >
                      Start Application
                    </Button>
                  </CardContent>
                </Card>
              )}

              {!user && (
                <Card>
                  <CardContent className="py-6 text-center">
                    <h3 className="font-display font-semibold mb-2">Want to Apply?</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Log in or create an account to submit your application
                    </p>
                    <Button asChild className="w-full">
                      <Link to="/login">Log In to Apply</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Application Form Modal */}
      {showApplicationForm && opportunity && (
        <ApplicationForm
          opportunity={opportunity}
          questions={opportunity.application_questions || []}
          onClose={() => setShowApplicationForm(false)}
          onSuccess={handleApplicationSuccess}
        />
      )}
    </RoleBasedLayout>
  );
}
