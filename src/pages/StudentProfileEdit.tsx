import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Github, Globe, Linkedin, Loader2, Plus, X } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { ChangePasswordCard } from "@/components/settings/ChangePasswordCard";
import { supabase } from "@/integrations/supabase/client";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUpload } from "@/components/ui/file-upload";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  studentProfileSchema,
  validateInput,
  formatValidationErrors,
  sanitizeText,
} from "@/lib/validation";
import { YEAR_OPTIONS, SKILL_SUGGESTIONS, INTEREST_SUGGESTIONS } from "@/lib/constants";

/**
 * Profile, write side. The read side is /student/profile.
 *
 * Every field, suggestion and the resume upload are exactly the ones that were
 * here before — the save path (sanitize → zod → upsert on user_id) is
 * untouched. What changed is presentation plus two real accessibility fixes:
 * the suggestion chips and the remove-item controls were `<div>`s with click
 * handlers, so neither was reachable by keyboard or announced as a control.
 */
export default function StudentProfileEdit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [major, setMajor] = useState("");
  const [year, setYear] = useState("");
  const [graduationDate, setGraduationDate] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [resumeUrl, setResumeUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");

  // Input states for adding items
  const [skillInput, setSkillInput] = useState("");
  const [interestInput, setInterestInput] = useState("");

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("student_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        toast.error("Failed to load profile");
        return;
      }

      if (data) {
        setFullName(data.full_name || "");
        setMajor(data.major || "");
        setYear(data.year || "");
        setGraduationDate(data.graduation_date || "");
        setSkills(data.skills || []);
        setInterests(data.interests || []);
        setResumeUrl(data.resume_url || "");
        setLinkedinUrl(data.linkedin_url || "");
        setGithubUrl(data.github_url || "");
        setPortfolioUrl(data.portfolio_url || "");
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Sanitize skills and interests
    const sanitizedSkills = skills.map((s) => sanitizeText(s)).filter((s) => s.length > 0);
    const sanitizedInterests = interests.map((i) => sanitizeText(i)).filter((i) => i.length > 0);

    // Validate with Zod schema
    const validationResult = validateInput(studentProfileSchema, {
      full_name: fullName.trim() || null,
      major: major.trim() || null,
      year: year || null,
      graduation_date: graduationDate || null,
      skills: sanitizedSkills.length > 0 ? sanitizedSkills : null,
      interests: sanitizedInterests.length > 0 ? sanitizedInterests : null,
      resume_url: resumeUrl.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      github_url: githubUrl.trim() || null,
      portfolio_url: portfolioUrl.trim() || null,
    });

    if (!validationResult.success) {
      const errorResult = validationResult as { success: false; errors: Record<string, string> };
      toast.error(formatValidationErrors(errorResult.errors));
      return;
    }

    setIsSaving(true);
    try {
      const validatedData = validationResult.data;

      // Upsert (not update): a plain update affects 0 rows and silently
      // "succeeds" if the profile row is missing (e.g. removed during orphan
      // cleanup). Upserting on user_id creates it when absent. user_id/email
      // are required (NOT NULL) on insert.
      const { error } = await supabase.from("student_profiles").upsert(
        {
          user_id: user.id,
          email: user.email ?? "",
          full_name: validatedData.full_name,
          major: validatedData.major,
          year: validatedData.year,
          graduation_date: validatedData.graduation_date,
          skills: validatedData.skills,
          interests: validatedData.interests,
          resume_url: validatedData.resume_url,
          linkedin_url: validatedData.linkedin_url,
          github_url: validatedData.github_url,
          portfolio_url: validatedData.portfolio_url,
        },
        { onConflict: "user_id" },
      );

      if (error) {
        console.error("Error saving student profile:", error);
        toast.error(`Failed to save profile: ${error.message}`);
        return;
      }

      toast.success("Profile saved");
      // Back to the profile you just edited, so you can see what clubs see.
      navigate("/student/profile");
    } catch (err) {
      console.error("Error:", err);
      toast.error("An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
    }
    setSkillInput("");
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const addInterest = (interest: string) => {
    const trimmed = interest.trim();
    if (trimmed && !interests.includes(trimmed)) {
      setInterests([...interests, trimmed]);
    }
    setInterestInput("");
  };

  const removeInterest = (interestToRemove: string) => {
    setInterests(interests.filter((i) => i !== interestToRemove));
  };

  return (
    <StudentLayout>
      <div className="min-h-screen">
        <div className="border-b border-line bg-surface">
          <div className="container mx-auto max-w-3xl px-4 py-6">
            <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
              <Link to="/student/profile">
                <ArrowLeft className="size-4" aria-hidden />
                Back to profile
              </Link>
            </Button>
            <h1 className="text-[clamp(26px,3.4vw,34px)] font-medium tracking-[-0.03em] text-ink">
              Edit profile
            </h1>
            <p className="mt-2 text-ink-2">
              Clubs read this when you apply. It carries over to every application.
            </p>
          </div>
        </div>

        <div className="container mx-auto max-w-3xl px-4 py-8">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-52 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <Panel title="Basics" hint="Your name and where you are at UCI.">
                <div className="space-y-4">
                  <Field htmlFor="fullName" label="Full name">
                    <Input
                      id="fullName"
                      placeholder="Anteater Sample"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field htmlFor="major" label="Major">
                      <Input
                        id="major"
                        placeholder="Computer Science"
                        value={major}
                        onChange={(e) => setMajor(e.target.value)}
                      />
                    </Field>

                    <Field htmlFor="year" label="Year">
                      <Select value={year} onValueChange={setYear}>
                        <SelectTrigger id="year">
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent>
                          {YEAR_OPTIONS.map((y) => (
                            <SelectItem key={y} value={y}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field htmlFor="graduationDate" label="Expected graduation">
                    <Input
                      id="graduationDate"
                      type="date"
                      value={graduationDate}
                      onChange={(e) => setGraduationDate(e.target.value)}
                      className="sm:max-w-[240px]"
                    />
                  </Field>
                </div>
              </Panel>

              <Panel title="Skills" hint="The first thing a club scans for.">
                <TokenField
                  id="skill"
                  label="Add a skill"
                  placeholder="React, public speaking, Adobe Illustrator…"
                  value={skillInput}
                  onValueChange={setSkillInput}
                  onAdd={addSkill}
                  items={skills}
                  onRemove={removeSkill}
                  suggestions={SKILL_SUGGESTIONS}
                  noun="skill"
                />
              </Panel>

              <Panel title="Interests" hint="What you'd actually show up for.">
                <TokenField
                  id="interest"
                  label="Add an interest"
                  placeholder="Robotics, sustainability, film…"
                  value={interestInput}
                  onValueChange={setInterestInput}
                  onAdd={addInterest}
                  items={interests}
                  onRemove={removeInterest}
                  suggestions={INTEREST_SUGGESTIONS}
                  noun="interest"
                />
              </Panel>

              <Panel title="Resume and links" hint="Optional, but the resume does the most work.">
                <div className="space-y-4">
                  <Field label="Resume">
                    <FileUpload
                      bucket="student-resumes"
                      folder={user?.id || ""}
                      accept=".pdf,.doc,.docx"
                      maxSizeMB={10}
                      currentUrl={resumeUrl}
                      onUploadComplete={(url) => setResumeUrl(url)}
                      onRemove={() => setResumeUrl("")}
                      variant="file"
                      placeholder="Upload your resume (PDF, DOC, DOCX)"
                    />
                  </Field>

                  <Field htmlFor="linkedinUrl" label="LinkedIn" Icon={Linkedin}>
                    <Input
                      id="linkedinUrl"
                      type="url"
                      inputMode="url"
                      placeholder="https://linkedin.com/in/yourprofile"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                    />
                  </Field>

                  <Field htmlFor="githubUrl" label="GitHub" Icon={Github}>
                    <Input
                      id="githubUrl"
                      type="url"
                      inputMode="url"
                      placeholder="https://github.com/yourusername"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                    />
                  </Field>

                  <Field htmlFor="portfolioUrl" label="Portfolio" Icon={Globe}>
                    <Input
                      id="portfolioUrl"
                      type="url"
                      inputMode="url"
                      placeholder="https://yourportfolio.com"
                      value={portfolioUrl}
                      onChange={(e) => setPortfolioUrl(e.target.value)}
                    />
                  </Field>
                </div>
              </Panel>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="accent" size="lg" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    "Save profile"
                  )}
                </Button>
                <Button variant="ghost" size="lg" asChild>
                  <Link to="/student/profile">Cancel</Link>
                </Button>
              </div>

              <div className="mt-10 border-t border-line pt-8">
                <ChangePasswordCard />
              </div>
            </div>
          )}
        </div>
      </div>
    </StudentLayout>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-e1">
      <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-ink">{title}</h2>
      {hint && <p className="mb-4 mt-1 text-sm text-ink-3">{hint}</p>}
      {!hint && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Field({
  htmlFor,
  label,
  Icon,
  children,
}: {
  htmlFor?: string;
  label: string;
  Icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="flex items-center gap-2">
        {Icon && <Icon className="size-4 text-ink-3" />}
        {label}
      </Label>
      {children}
    </div>
  );
}

/**
 * Add-and-remove list of free-text tokens (skills, interests).
 *
 * Both controls are real `<button>`s: the suggestions used to be styled divs,
 * so a keyboard user could not add a suggested skill at all, and the removes
 * announced nothing. Each remove says what it removes.
 */
function TokenField({
  id,
  label,
  placeholder,
  value,
  onValueChange,
  onAdd,
  items,
  onRemove,
  suggestions,
  noun,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onValueChange: (v: string) => void;
  onAdd: (v: string) => void;
  items: string[];
  onRemove: (v: string) => void;
  suggestions: readonly string[];
  noun: string;
}) {
  const unused = suggestions.filter((s) => !items.includes(s)).slice(0, 10);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`${id}-input`} className="sr-only">
          {label}
        </Label>
        <div className="flex gap-2">
          <Input
            id={`${id}-input`}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd(value);
              }
            }}
          />
          <Button type="button" variant="outline" onClick={() => onAdd(value)}>
            <Plus className="size-4" aria-hidden />
            Add
          </Button>
        </div>
      </div>

      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1 rounded-pill border border-line bg-surface-2 py-1 pl-3 pr-1 text-[13px] text-ink-2 [@media(pointer:coarse)]:py-0"
            >
              {item}
              {/* On touch this has to clear 44px outright — there is no
                  "small on desktop" exception for a finger (§4). */}
              <button
                type="button"
                onClick={() => onRemove(item)}
                aria-label={`Remove ${item}`}
                className="inline-flex size-6 items-center justify-center rounded-pill text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:size-11"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {unused.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] text-ink-3">Common ones:</p>
          <ul className="flex flex-wrap gap-1.5">
            {unused.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => onAdd(s)}
                  aria-label={`Add ${noun} ${s}`}
                  className="inline-flex min-h-9 items-center gap-1 rounded-pill border border-dashed border-line-2 px-3 text-[13px] text-ink-2 transition-colors hover:border-accent-line hover:bg-accent-wash hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:min-h-11"
                >
                  <Plus className="size-3.5" aria-hidden />
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
