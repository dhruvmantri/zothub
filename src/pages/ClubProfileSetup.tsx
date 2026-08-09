import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ChangePasswordCard } from "@/components/settings/ChangePasswordCard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { clubProfileSchema, validateInput, formatValidationErrors } from "@/lib/validation";
import {
  Building2,
  LinkIcon,
  Image,
  Globe,
  Linkedin,
  ArrowLeft,
  Save,
  Loader2
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { CLUB_CATEGORIES } from "@/lib/constants";

// Discord icon component
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
  </svg>
);

// Instagram icon component
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
);

export default function ClubProfileSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [clubName, setClubName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [discordUrl, setDiscordUrl] = useState("");

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("club_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        toast.error("Failed to load profile");
        return;
      }

      if (data) {
        setClubName(data.club_name || "");
        setDescription(data.description || "");
        setCategory(data.category || "");
        setLogoUrl(data.logo_url || "");
        setBannerUrl(data.banner_url || "");
        setWebsiteUrl(data.website_url || "");
        setLinkedinUrl(data.linkedin_url || "");
        setInstagramUrl(data.instagram_url || "");
        setDiscordUrl(data.discord_url || "");
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Validate with Zod schema
    const validationResult = validateInput(clubProfileSchema, {
      club_name: clubName.trim(),
      description: description.trim() || null,
      category: category || null,
      logo_url: logoUrl.trim() || null,
      banner_url: bannerUrl.trim() || null,
      website_url: websiteUrl.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      instagram_url: instagramUrl.trim() || null,
      discord_url: discordUrl.trim() || null,
    });

    if (!validationResult.success) {
      const errorResult = validationResult as { success: false; errors: Record<string, string> };
      toast.error(formatValidationErrors(errorResult.errors));
      return;
    }
    
    setIsSaving(true);
    try {
      const validatedData = validationResult.data;

      // Upsert (not update): if the row is missing — e.g. it was never created
      // or was removed during orphan cleanup — a plain update would affect 0
      // rows and silently "succeed" without persisting anything, then break
      // opportunity creation ("Club profile not found"). Upserting on user_id
      // creates the row when absent and updates it when present. email/user_id
      // are required (NOT NULL) columns on insert.
      const { error } = await supabase
        .from("club_profiles")
        .upsert(
          {
            user_id: user.id,
            email: user.email ?? "",
            club_name: validatedData.club_name,
            description: validatedData.description,
            category: validatedData.category,
            logo_url: validatedData.logo_url,
            banner_url: validatedData.banner_url,
            website_url: validatedData.website_url,
            linkedin_url: validatedData.linkedin_url,
            instagram_url: validatedData.instagram_url,
            discord_url: validatedData.discord_url,
          },
          { onConflict: "user_id" }
        );

      if (error) {
        console.error("Error saving club profile:", error);
        toast.error(`Failed to save profile: ${error.message}`);
        return;
      }

      toast.success("Profile saved successfully!");
      navigate("/club/dashboard/overview");
    } catch (err) {
      console.error("Error:", err);
      toast.error("An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />

          <Button variant="ghost" size="sm" asChild>
            <Link to="/club/dashboard/overview">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to My Club
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            Club Profile
          </h1>
          <p className="text-muted-foreground">
            Set up your club's profile to attract students. A complete profile helps students understand what your club is about.
          </p>
        </div>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-accent" />
                Basic Information
              </CardTitle>
              <CardDescription>Tell students about your club</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clubName">
                  Club Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="clubName"
                  placeholder="e.g., ACM at UCI"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="category">Category <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLUB_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                <Textarea
                  id="description"
                  placeholder="Tell students what your club is about, your mission, and what members can expect..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">
                  A good description helps students decide if your club is right for them.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Branding */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="w-5 h-5 text-accent" />
                Branding
              </CardTitle>
              <CardDescription>Add visuals to make your profile stand out</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Club Logo <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                <FileUpload
                  bucket="club-assets"
                  folder={user?.id || ""}
                  accept="image/*"
                  maxSizeMB={2}
                  currentUrl={logoUrl}
                  onUploadComplete={(url) => setLogoUrl(url)}
                  onRemove={() => setLogoUrl("")}
                  variant="image"
                  placeholder="Upload your club logo (square format recommended)"
                />
              </div>

              <div className="space-y-2">
                <Label>Banner Image <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                <FileUpload
                  bucket="club-assets"
                  folder={user?.id || ""}
                  accept="image/*"
                  maxSizeMB={5}
                  currentUrl={bannerUrl}
                  onUploadComplete={(url) => setBannerUrl(url)}
                  onRemove={() => setBannerUrl("")}
                  variant="image"
                  placeholder="Upload a banner image (1200x400 recommended)"
                />
              </div>
            </CardContent>
          </Card>

          {/* Social Links */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-accent" />
                Social Links
              </CardTitle>
              <CardDescription>Help students find you online</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="websiteUrl" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Website
                </Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  placeholder="https://yourclub.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagramUrl" className="flex items-center gap-2">
                  <InstagramIcon className="w-4 h-4" />
                  Instagram
                </Label>
                <Input
                  id="instagramUrl"
                  type="url"
                  placeholder="https://instagram.com/yourclub"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discordUrl" className="flex items-center gap-2">
                  <DiscordIcon className="w-4 h-4" />
                  Discord
                </Label>
                <Input
                  id="discordUrl"
                  type="url"
                  placeholder="https://discord.gg/yourserver"
                  value={discordUrl}
                  onChange={(e) => setDiscordUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedinUrl" className="flex items-center gap-2">
                  <Linkedin className="w-4 h-4" />
                  LinkedIn
                </Label>
                <Input
                  id="linkedinUrl"
                  type="url"
                  placeholder="https://linkedin.com/company/yourclub"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" asChild>
              <Link to="/club/dashboard/overview">Cancel</Link>
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Profile
                </>
              )}
            </Button>
          </div>

          <div className="mt-10 border-t pt-8">
            <ChangePasswordCard />
          </div>
        </div>
      </main>
    </div>
  );
}
