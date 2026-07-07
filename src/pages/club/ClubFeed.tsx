import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Rss } from "lucide-react";
import { FeedCard } from "@/components/feed/FeedCard";
import { EmptyFeedState } from "@/components/feed/EmptyFeedState";
import { ClubLayout } from "@/components/club/ClubLayout";
import type { FeedItem } from "@/types";

export default function ClubFeed() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (user) {
      fetchFeedData();
    }
  }, [user]);

  const fetchFeedData = async () => {
    if (!user) return;

    try {
      // Fetch all active opportunities from all clubs (excluding own club)
      const { data: clubProfile } = await supabase
        .from("club_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const ownClubId = clubProfile?.id;

      // Fetch opportunities
      let oppsQuery = supabase
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
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50);

      if (ownClubId) {
        oppsQuery = oppsQuery.neq("club_id", ownClubId);
      }

      const { data: opportunities, error: oppsError } = await oppsQuery;

      if (oppsError) {
        console.error("Error fetching opportunities:", oppsError);
      }

      // Fetch events
      let eventsQuery = supabase
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
        .eq("is_active", true)
        .gte("event_date", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      if (ownClubId) {
        eventsQuery = eventsQuery.neq("club_id", ownClubId);
      }

      const { data: events, error: eventsError } = await eventsQuery;

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

  const filteredItems = useMemo(() => {
    return feedItems.filter((item) => {
      if (activeTab === "all") return true;
      if (activeTab === "opportunities") return item.type === "opportunity";
      if (activeTab === "events") return item.type === "event";
      return true;
    });
  }, [feedItems, activeTab]);

  if (isLoading) {
    return (
      <ClubLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </ClubLayout>
    );
  }

  return (
    <ClubLayout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Rss className="w-6 h-6 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Feed
            </h1>
          </div>
          <p className="text-muted-foreground">
            See what other clubs are posting
          </p>
        </div>

        {/* Feed Content */}
        {feedItems.length === 0 ? (
          <EmptyFeedState hasFollowedClubs={false} />
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
    </ClubLayout>
  );
}
