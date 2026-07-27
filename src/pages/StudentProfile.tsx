import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  FileText,
  Github,
  Globe,
  Linkedin,
  Pencil,
  ExternalLink,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { StudentLayout } from "@/components/student/StudentLayout";
import { EmptyState } from "@/components/discover/EmptyState";
import { Button } from "@/components/ui/button";
import { EntityAvatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { openFileUrl } from "@/lib/storageUrls";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StudentProfile {
  full_name: string | null;
  email: string;
  major: string | null;
  year: string | null;
  graduation_date: string | null;
  skills: string[] | null;
  interests: string[] | null;
  resume_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  avatar_url: string | null;
}

/**
 * Profile, read side. The old /student/profile was the edit form and nothing
 * else, so a student could never simply *look* at what clubs see — the only way
 * to check your own profile was to open a form you might accidentally save.
 *
 * This is the view; /student/profile/edit is the form. Same row, same fields,
 * nothing dropped.
 */
export default function StudentProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) fetchProfile();
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
      setProfile((data as StudentProfile) || null);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    if (!profile?.resume_url) return;
    try {
      await openFileUrl(profile.resume_url);
    } catch (err) {
      console.error("Error opening resume:", err);
      toast.error("Could not open your resume");
    }
  };

  const name = profile?.full_name?.trim() || "";
  const skills = profile?.skills ?? [];
  const interests = profile?.interests ?? [];
  const links = [
    { url: profile?.linkedin_url, Icon: Linkedin, label: "LinkedIn" },
    { url: profile?.github_url, Icon: Github, label: "GitHub" },
    { url: profile?.portfolio_url, Icon: Globe, label: "Portfolio" },
  ].filter((l) => l.url);

  // What a club actually sees when this student applies. Naming the gaps is
  // more useful than a percentage ring that means nothing.
  const missing = [
    !name && "your name",
    !profile?.major && "your major",
    !profile?.year && "your year",
    skills.length === 0 && "skills",
    !profile?.resume_url && "a resume",
  ].filter(Boolean) as string[];

  return (
    <StudentLayout>
      <div className="min-h-screen">
        <div className="border-b border-line bg-surface">
          <div className="container mx-auto max-w-3xl px-4 py-9">
            {isLoading ? (
              <div className="flex items-center gap-4">
                <Skeleton className="size-16 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-7 w-52" />
                  <Skeleton className="h-4 w-36" />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <EntityAvatar
                  name={name || user?.email}
                  src={profile?.avatar_url}
                  kind="person"
                  size="xl"
                />
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-[clamp(26px,3.4vw,34px)] font-medium tracking-[-0.03em] text-ink">
                    {name || "Your profile"}
                  </h1>
                  <p className="mt-1 truncate text-ink-2">
                    {[profile?.major, profile?.year].filter(Boolean).join(" · ") ||
                      "No major or year set yet"}
                  </p>
                  {profile?.graduation_date && (
                    <p className="mt-0.5 text-sm text-ink-3">
                      Graduating{" "}
                      <span className="font-data">
                        {format(new Date(profile.graduation_date), "MMM yyyy")}
                      </span>
                    </p>
                  )}
                </div>
                <Button variant="accent" asChild>
                  <Link to="/student/profile/edit">
                    <Pencil className="size-4" aria-hidden />
                    Edit profile
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="container mx-auto max-w-3xl px-4 py-8">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
          ) : !profile ? (
            <EmptyState
              title="No profile yet —"
              signature="it takes two minutes."
              body="Clubs read your profile when you apply. Fill it in once and every application carries it."
              actions={
                <Button variant="accent" asChild>
                  <Link to="/student/profile/edit">Set up your profile</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {missing.length > 0 && (
                <div className="rounded-lg border border-line-2 bg-surface-2 p-4">
                  <p className="text-sm text-ink-2">
                    Clubs see this profile with every application. Still missing{" "}
                    <span className="font-medium text-ink">{listOut(missing)}</span>.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" asChild>
                    <Link to="/student/profile/edit">Fill it in</Link>
                  </Button>
                </div>
              )}

              <Panel title="Skills">
                {skills.length > 0 ? (
                  <ChipRow items={skills} />
                ) : (
                  <Blank>Nothing listed. Skills are the first thing a club scans for.</Blank>
                )}
              </Panel>

              <Panel title="Interests">
                {interests.length > 0 ? (
                  <ChipRow items={interests} />
                ) : (
                  <Blank>Nothing listed yet.</Blank>
                )}
              </Panel>

              <Panel title="Resume and links">
                <div className="flex flex-wrap gap-2">
                  {profile.resume_url ? (
                    <Button variant="outline" onClick={handleResume}>
                      <FileText className="size-4" aria-hidden />
                      View resume
                    </Button>
                  ) : null}

                  {links.map(({ url, Icon, label }) => (
                    <Button key={label} variant="outline" asChild>
                      <a href={url!} target="_blank" rel="noopener noreferrer">
                        <Icon className="size-4" aria-hidden />
                        {label}
                        <ExternalLink className="size-3.5 opacity-60" aria-hidden />
                      </a>
                    </Button>
                  ))}

                  {!profile.resume_url && links.length === 0 && (
                    <Blank>
                      No resume or links yet. A resume is the single most useful thing to add.
                    </Blank>
                  )}
                </div>
              </Panel>

              <Panel title="Account">
                <p className="text-sm text-ink-2">
                  Signed in as <span className="text-ink">{profile.email || user?.email}</span>
                </p>
              </Panel>
            </div>
          )}
        </div>
      </div>
    </StudentLayout>
  );
}

/** "your name, your major and skills" — never a bare comma-spliced list. */
function listOut(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-e1">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Blank({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-3">{children}</p>;
}

/**
 * Skills and interests are free text a student typed — sentence case, UI face.
 * The uppercase `Tag` is for taxonomy, which these are not.
 */
function ChipRow({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item) => (
        <li
          key={item}
          className="rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-[13px] text-ink-2"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
