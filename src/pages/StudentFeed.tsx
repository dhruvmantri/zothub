import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2,
  Rss
} from "lucide-react";
import { FeedCard } from "@/components/feed/FeedCard";
import { FollowedClubsList } from "@/components/feed/FollowedClubsList";
import { EmptyFeedState } from "@/components/feed/EmptyFeedState";
import { toast } from "sonner";
import { StudentLayout } from "@/components/student/StudentLayout";

interface FollowedClub {
  id: string;
  club_name: string;
  logo_url: string | null;
}

interface FeedItem {
  type: "opportunity" | "event";
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  club_id: string;
  club_name: string;
  club_logo: string | null;
  // Opportunity specific
  deadline?: string | null;
  opportunity_type?: string;
  // Event specific
  event_date?: string;
  location?: string | null;
}

export default function StudentFeed() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [followedClubs, setFollowedClubs] = useState<FollowedClub[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [isUnfollowing, setIsUnfollowing] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchFeedData();
    }
  }, [user]);

  const fetchFeedData = async () => {
    if (!user) return;

    try {
      // Fetch followed clubs
      const { data: bookmarks, error: bookmarksError } = await supabase
        .from("bookmarks")
        .select("club_id")
        .eq("user_id", user.id)
        .not("club_id", "is", null);

      if (bookmarksError) {
        console.error("Error fetching bookmarks:", bookmarksError);
        setIsLoading(false);
        return;
      }

      const clubIds = bookmarks?.map((b) => b.club_id).filter(Boolean) as string[];

      if (clubIds.length === 0) {
        setFollowedClubs([]);
        setFeedItems([]);
        setIsLoading(false);
        return;
      }

      // Fetch club profiles
      const { data: clubs, error: clubsError } = await supabase
        .from("club_profiles")
        .select("id, club_name, logo_url")
        .in("id", clubIds);

      if (clubsError) {
        console.error("Error fetching clubs:", clubsError);
      } else {
        setFollowedClubs(clubs || []);
      }

      // Fetch opportunities from followed clubs
      const { data: opportunities, error: oppsError } = await supabase
        .from("opportunities")
        .select(`
          id,
          title,
          description,
          created_at,
          deadline,
          type,
          club_id,
          club:club_profiles!inner(club_name, logo_url)
        `)
        .in("club_id", clubIds)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50);

      if (oppsError) {
        console.error("Error fetching opportunities:", oppsError);
      }

      // Fetch events from followed clubs
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select(`
          id,
          title,
          description,
          created_at,
          event_date,
          location,
          club_id,
          club:club_profiles!inner(club_name, logo_url)
        `)
        .in("club_id", clubIds)
        .eq("is_active", true)
        .gte("event_date", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      if (eventsError) {
        console.error("Error fetching events:", eventsError);
      }

      // Combine and sort feed items
      const allItems: FeedItem[] = [];

      (opportunities || []).forEach((opp: any) => {
        allItems.push({
          type: "opportunity",
          id: opp.id,
          title: opp.title,
          description: opp.description,
          created_at: opp.created_at,
          club_id: opp.club_id,
          club_name: opp.club.club_name,
          club_logo: opp.club.logo_url,
          deadline: opp.deadline,
          opportunity_type: opp.type,
        });
      });

      (events || []).forEach((event: any) => {
        allItems.push({
          type: "event",
          id: event.id,
          title: event.title,
          description: event.description,
          created_at: event.created_at,
          club_id: event.club_id,
          club_name: event.club.club_name,
          club_logo: event.club.logo_url,
          event_date: event.event_date,
          location: event.location,
        });
      });

      // Sort by created_at descending
      allItems.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setFeedItems(allItems);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnfollow = async (clubId: string) => {
    if (!user) return;
    
    setIsUnfollowing(clubId);

    try {
      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("club_id", clubId);

      if (error) throw error;

      // Update local state
      setFollowedClubs((prev) => prev.filter((c) => c.id !== clubId));
      setFeedItems((prev) => prev.filter((item) => item.club_id !== clubId));
      
      toast.success("Unfollowed club");
    } catch (err) {
      console.error("Error unfollowing:", err);
      toast.error("Failed to unfollow club");
    } finally {
      setIsUnfollowing(null);
    }
  };

  const filteredItems = feedItems.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "opportunities") return item.type === "opportunity";
    if (activeTab === "events") return item.type === "event";
    return true;
  });

  if (isLoading) {
    return (
      <StudentLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Rss className="w-6 h-6 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              My Feed
            </h1>
          </div>
          <p className="text-muted-foreground">
            {followedClubs.length > 0 
              ? `Updates from ${followedClubs.length} club${followedClubs.length !== 1 ? 's' : ''} you follow`
              : "Follow clubs to see their updates here"
            }
          </p>
        </div>

        {/* Followed Clubs */}
        <FollowedClubsList 
          clubs={followedClubs} 
          onUnfollow={handleUnfollow}
          isUnfollowing={isUnfollowing}
        />

        {/* Feed Content */}
        {followedClubs.length === 0 ? (
          <EmptyFeedState hasFollowedClubs={false} />
        ) : feedItems.length === 0 ? (
          <EmptyFeedState hasFollowedClubs={true} />
        ) : (
          <>
            {/* Filter Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Feed Items */}
            <div className="space-y-4">
              {filteredItems.map((item) => (
                <FeedCard
                  key={`${item.type}-${item.id}`}
                  type={item.type}
                  id={item.id}
                  title={item.title}
                  description={item.description}
                  clubName={item.club_name}
                  clubLogo={item.club_logo}
                  clubId={item.club_id}
                  createdAt={item.created_at}
                  deadline={item.deadline}
                  opportunityType={item.opportunity_type}
                  eventDate={item.event_date}
                  location={item.location}
                />
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No {activeTab === "opportunities" ? "opportunities" : "events"} to show.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </StudentLayout>
  );
}
