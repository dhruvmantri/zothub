import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, ArrowLeft, CheckCircle, Loader2 } from "lucide-react";

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [preferences, setPreferences] = useState({
    application_updates: true,
    event_reminders: true,
    new_messages: true,
    deadline_reminders: true,
    team_invitations: true,
    new_post_notifications: true,
  });
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    checkAuthAndLoadPreferences();
  }, []);

  const checkAuthAndLoadPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      setIsAuthenticated(true);

      const { data: prefs, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && prefs) {
        setPreferences({
          application_updates: prefs.application_updates,
          event_reminders: prefs.event_reminders,
          new_messages: prefs.new_messages,
          deadline_reminders: prefs.deadline_reminders,
          team_invitations: prefs.team_invitations ?? true,
          new_post_notifications: prefs.new_post_notifications ?? true,
        });
      }

      // If coming from email with type param, auto-disable that type
      if (type && type in preferences) {
        const newPrefs = { ...preferences, [type]: false };
        setPreferences(newPrefs);
        await savePreferences(newPrefs, user.id);
        setShowSuccess(true);
      }
    } catch (err) {
      console.error("Error loading preferences:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async (prefs: typeof preferences, userId?: string) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const id = userId || user?.id;
      
      if (!id) {
        toast.error("Please log in to update preferences");
        return;
      }

      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: id,
          ...prefs,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success("Email preferences updated");
    } catch (err) {
      console.error("Error saving preferences:", err);
      toast.error("Failed to update preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (key: keyof typeof preferences) => {
    const newPrefs = { ...preferences, [key]: !preferences[key] };
    setPreferences(newPrefs);
    await savePreferences(newPrefs);
  };

  const preferenceLabels: Record<keyof typeof preferences, { label: string; description: string }> = {
    application_updates: {
      label: "Application Updates",
      description: "Notifications when your application status changes",
    },
    event_reminders: {
      label: "Event Reminders",
      description: "Reminders 24 hours before events you've RSVP'd to",
    },
    new_messages: {
      label: "New Messages",
      description: "Notifications when you receive a new message",
    },
    deadline_reminders: {
      label: "Deadline Reminders",
      description: "Reminders when bookmarked opportunity deadlines approach",
    },
    team_invitations: {
      label: "Team Invitations",
      description: "Notifications when you're invited to join a club team",
    },
    new_post_notifications: {
      label: "New Posts from Followed Clubs",
      description: "Emails when a club you follow posts an opportunity or event",
    },
  };

  if (isLoading) {
    return (
      <RoleBasedLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </RoleBasedLayout>
    );
  }

  return (
    <RoleBasedLayout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-lg mx-auto">
            <Button variant="ghost" size="sm" asChild className="mb-6">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>

            {showSuccess && (
              <Card className="mb-6 border-green-500/50 bg-green-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <p className="text-foreground">
                      You've been unsubscribed from {type?.replace("_", " ")} emails.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Email Preferences</CardTitle>
                <CardDescription>
                  {isAuthenticated 
                    ? "Manage which emails you receive from ZotHub"
                    : "Please log in to manage your email preferences"
                  }
                </CardDescription>
              </CardHeader>

              <CardContent>
                {isAuthenticated ? (
                  <div className="space-y-6">
                    {(Object.keys(preferences) as Array<keyof typeof preferences>).map((key) => (
                      <div key={key} className="flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <Label htmlFor={key} className="text-foreground font-medium">
                            {preferenceLabels[key].label}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {preferenceLabels[key].description}
                          </p>
                        </div>
                        <Switch
                          id={key}
                          checked={preferences[key]}
                          onCheckedChange={() => handleToggle(key)}
                          disabled={isSaving}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-4">
                      Sign in to manage your notification preferences.
                    </p>
                    <Button asChild>
                      <Link to="/login">Sign In</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-sm text-muted-foreground text-center mt-6">
              You can also manage these settings from your{" "}
              {isAuthenticated ? (
                <Link to="/notifications" className="text-primary hover:underline">
                  notification settings
                </Link>
              ) : (
                "account settings"
              )}
              .
            </p>
          </div>
        </div>
      </div>
    </RoleBasedLayout>
  );
}
