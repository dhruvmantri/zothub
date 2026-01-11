import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { FileUpload } from "@/components/ui/file-upload";
import { toast } from "sonner";
import { ClubLayout } from "@/components/club/ClubLayout";
import { eventSchema, validateInput, formatValidationErrors } from "@/lib/validation";
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
} from "lucide-react";

export default function CreateEvent() {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const handleSubmit = async (e: React.FormEvent, asDraft = false) => {
    e.preventDefault();
    setFieldErrors({});

    if (!user) {
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
      // First, get the club profile for this user
      const { data: clubProfile, error: clubError } = await supabase
        .from("club_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (clubError) {
        console.error("Error fetching club profile:", clubError);
        toast.error("Failed to find club profile");
        return;
      }

      if (!clubProfile) {
        toast.error("Club profile not found. Please complete your club profile first.");
        return;
      }

      const validatedData = validationResult.data;

      const { error } = await supabase.from("events").insert({
        club_id: clubProfile.id,
        title: validatedData.title,
        description: validatedData.description,
        event_date: new Date(validatedData.event_date).toISOString(),
        location: validatedData.location,
        capacity: validatedData.capacity,
        banner_url: validatedData.banner_url,
        is_active: validatedData.is_active,
      });

      if (error) {
        console.error("Error creating event:", error);
        toast.error("Failed to create event");
        return;
      }

      toast.success(asDraft ? "Event saved as draft" : "Event created successfully!");
      navigate("/club/dashboard");
    } catch (err) {
      console.error("Error:", err);
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

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
            Create New Event
          </h1>
          <p className="text-muted-foreground mt-1">
            Host an event and let students RSVP
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
                <Label className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Banner Image
                </Label>
                <FileUpload
                  bucket="club-assets"
                  folder="event-banners"
                  accept="image/*"
                  maxSizeMB={5}
                  currentUrl={bannerUrl}
                  onUploadComplete={(url) => setBannerUrl(url)}
                  onRemove={() => setBannerUrl("")}
                  variant="image"
                  placeholder="Click to upload event banner"
                />
                <p className="text-xs text-muted-foreground">
                  Add a banner image to make your event stand out (max 5MB)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Publishing Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-accent" />
                Publishing Options
              </CardTitle>
              <CardDescription>Control when your event goes live</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="isActive" className="text-base">Publish immediately</Label>
                  <p className="text-sm text-muted-foreground">
                    Turn off to save as draft and publish later
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
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Publish Event
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </ClubLayout>
  );
}
