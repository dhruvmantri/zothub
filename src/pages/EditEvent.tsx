import { useState, useEffect } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ClubLayout } from "@/components/club/ClubLayout";
import { eventSchema, validateInput, formatValidationErrors } from "@/lib/validation";
import { ApplicationQuestionsBuilder, ApplicationQuestion } from "@/components/dashboard/ApplicationQuestionsBuilder";
import {
  Calendar,
  MapPin,
  Users,
  Image,
  ArrowLeft,
  Save,
  Loader2,
  Eye,
  Clock,
  Info,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";

export default function EditEvent() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // RSVP form state
  const [rsvpQuestions, setRsvpQuestions] = useState<ApplicationQuestion[]>([]);
  const [requiresApproval, setRequiresApproval] = useState(false);

  useEffect(() => {
    if (id) {
      fetchEvent();
    }
  }, [id]);

  const fetchEvent = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching event:", error);
      toast.error("Failed to load event");
      navigate("/club/dashboard/events");
      return;
    }

    setTitle(data.title);
    setDescription(data.description || "");
    setEventDate(new Date(data.event_date).toISOString().slice(0, 16));
    setLocation(data.location || "");
    setCapacity(data.capacity?.toString() || "");
    setBannerUrl(data.banner_url || "");
    setIsActive(data.is_active ?? true);
    setRsvpQuestions(Array.isArray(data.rsvp_questions) ? (data.rsvp_questions as unknown as ApplicationQuestion[]) : []);
    setRequiresApproval(data.requires_approval ?? false);
    
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent, asDraft = false) => {
    e.preventDefault();
    setFieldErrors({});

    if (!user || !id) {
      toast.error("You must be logged in");
      return;
    }

    // Validate with Zod schema
    const validationResult = validateInput(eventSchema, {
      title: title.trim(),
      description: description.trim() || null,
      event_date: eventDate,
      location: location.trim() || null,
      capacity: capacity ? parseInt(capacity, 10) : null,
      banner_url: bannerUrl.trim() || null,
      is_active: asDraft ? false : isActive,
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
        .from("events")
        .update({
          title: validatedData.title,
          description: validatedData.description,
          event_date: new Date(validatedData.event_date).toISOString(),
          location: validatedData.location,
          capacity: validatedData.capacity,
          banner_url: validatedData.banner_url,
          is_active: validatedData.is_active,
          rsvp_questions: rsvpQuestions as unknown as null,
          requires_approval: requiresApproval,
        })
        .eq("id", id);

      if (error) {
        console.error("Error updating event:", error);
        toast.error("Failed to update event");
        return;
      }

      toast.success(asDraft ? "Event saved as draft" : "Event updated successfully!");
      navigate("/club/dashboard/events");
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
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/club/dashboard/events">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Postings
            </Link>
          </Button>
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">
            Edit Event
          </h1>
          <p className="text-muted-foreground mt-1">
            Update the details of your event
          </p>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5 text-accent" />
                Event Details
              </CardTitle>
              <CardDescription>Basic information about your event</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Winter Hackathon, Tech Talk: AI in Healthcare"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what the event is about, what attendees can expect..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                />
              </div>
            </CardContent>
          </Card>

          {/* Date & Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent" />
                Date & Location
              </CardTitle>
              <CardDescription>When and where is the event?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="eventDate" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Date & Time *
                  </Label>
                  <Input
                    id="eventDate"
                    type="datetime-local"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Location
                  </Label>
                  <Input
                    id="location"
                    placeholder="e.g., Donald Bren Hall 1200"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Capacity & Media */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-accent" />
                Capacity & Media
              </CardTitle>
              <CardDescription>Set limits and add visual appeal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="capacity" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Capacity
                </Label>
                <Input
                  id="capacity"
                  type="number"
                  placeholder="Maximum number of attendees (leave empty for unlimited)"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  min="1"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for unlimited capacity
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bannerUrl" className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Banner Image URL
                </Label>
                <Input
                  id="bannerUrl"
                  type="url"
                  placeholder="https://example.com/event-banner.jpg"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Add a banner image to make your event stand out
                </p>
              </div>

              {bannerUrl && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                  <div className="rounded-lg overflow-hidden border border-border max-w-md">
                    <img 
                      src={bannerUrl} 
                      alt="Event banner preview" 
                      className="w-full h-32 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* RSVP Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-accent" />
                RSVP Form
              </CardTitle>
              <CardDescription>
                Add custom questions for attendees to answer when they RSVP
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <Label htmlFor="requiresApproval" className="text-base flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Require Approval
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Manually approve each RSVP before confirming attendance
                  </p>
                </div>
                <Switch
                  aria-label="Require approval"
                  id="requiresApproval"
                  checked={requiresApproval}
                  onCheckedChange={setRequiresApproval}
                />
              </div>
              
              <ApplicationQuestionsBuilder
                questions={rsvpQuestions}
                onChange={setRsvpQuestions}
              />
            </CardContent>
          </Card>

          {/* Publishing Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-accent" />
                Publishing Options
              </CardTitle>
              <CardDescription>Control your event's visibility</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="isActive" className="text-base">Published</Label>
                  <p className="text-sm text-muted-foreground">
                    Turn off to unpublish this event
                  </p>
                </div>
                <Switch
                  aria-label="Published"
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" asChild>
              <Link to="/club/dashboard/events">Cancel</Link>
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
