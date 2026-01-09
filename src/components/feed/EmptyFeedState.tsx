import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users, Compass } from "lucide-react";

interface EmptyFeedStateProps {
  hasFollowedClubs: boolean;
}

export function EmptyFeedState({ hasFollowedClubs }: EmptyFeedStateProps) {
  if (!hasFollowedClubs) {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Users className="w-10 h-10 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-bold text-foreground mb-2">
          Start Following Clubs
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          Follow clubs you're interested in to see their latest opportunities and events in your personalized feed.
        </p>
        <Button asChild size="lg">
          <Link to="/clubs" className="gap-2">
            <Compass className="w-5 h-5" />
            Discover Clubs
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center py-16 px-4">
      <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
        <Compass className="w-10 h-10 text-muted-foreground" />
      </div>
      <h2 className="font-display text-2xl font-bold text-foreground mb-2">
        No New Activity
      </h2>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        The clubs you follow haven't posted any opportunities or upcoming events yet. Check back soon!
      </p>
      <Button variant="outline" asChild>
        <Link to="/clubs" className="gap-2">
          <Users className="w-5 h-5" />
          Follow More Clubs
        </Link>
      </Button>
    </div>
  );
}
