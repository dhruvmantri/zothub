import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { UserMinus, ChevronRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FollowedClub {
  id: string;
  club_name: string;
  logo_url: string | null;
}

interface FollowedClubsListProps {
  clubs: FollowedClub[];
  onUnfollow: (clubId: string) => void;
  isUnfollowing: string | null;
}

export function FollowedClubsList({ clubs, onUnfollow, isUnfollowing }: FollowedClubsListProps) {
  if (clubs.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-foreground">Following</h2>
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link to="/clubs" className="flex items-center gap-1">
            Discover more
            <ChevronRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
      
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-4 pb-2">
          {clubs.map((club) => (
            <div 
              key={club.id}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="relative">
                <Link to={`/clubs/${club.id}`}>
                  <Avatar className="w-16 h-16 border-2 border-border hover:border-primary transition-colors">
                    <AvatarImage src={club.logo_url || undefined} alt={club.club_name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                      {club.club_name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onUnfollow(club.id)}
                      disabled={isUnfollowing === club.id}
                    >
                      <UserMinus className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Unfollow</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              <Link 
                to={`/clubs/${club.id}`}
                className="text-xs text-center text-muted-foreground hover:text-foreground transition-colors max-w-[80px] truncate"
              >
                {club.club_name}
              </Link>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
