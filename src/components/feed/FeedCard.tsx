import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Briefcase, MapPin, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface FeedCardProps {
  type: "opportunity" | "event";
  id: string;
  title: string;
  description: string | null;
  clubName: string;
  clubLogo: string | null;
  clubId: string;
  createdAt: string;
  // Opportunity specific
  deadline?: string | null;
  opportunityType?: string;
  // Event specific
  eventDate?: string;
  location?: string | null;
}

export function FeedCard({
  type,
  id,
  title,
  description,
  clubName,
  clubLogo,
  clubId,
  createdAt,
  deadline,
  opportunityType,
  eventDate,
  location,
}: FeedCardProps) {
  const linkPath = type === "opportunity" ? `/opportunities/${id}` : `/events/${id}`;
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true });

  return (
    <Card className="hover:bg-secondary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Club Avatar */}
          <Link to={`/clubs/${clubId}`} className="flex-shrink-0">
            <Avatar className="w-12 h-12 border-2 border-border hover:border-primary transition-colors">
              <AvatarImage src={clubLogo || undefined} alt={clubName} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {clubName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Link 
                  to={`/clubs/${clubId}`}
                  className="font-semibold text-foreground hover:text-primary transition-colors"
                >
                  {clubName}
                </Link>
                <span className="text-muted-foreground text-sm">•</span>
                <span className="text-muted-foreground text-sm">{timeAgo}</span>
              </div>
              <Badge 
                variant={type === "opportunity" ? "default" : "accent"}
                className="flex-shrink-0"
              >
                {type === "opportunity" ? (
                  <>
                    <Briefcase className="w-3 h-3 mr-1" />
                    {opportunityType || "Opportunity"}
                  </>
                ) : (
                  <>
                    <Calendar className="w-3 h-3 mr-1" />
                    Event
                  </>
                )}
              </Badge>
            </div>

            {/* Title */}
            <Link to={linkPath}>
              <h3 className="font-display font-semibold text-lg text-foreground hover:text-primary transition-colors mb-1">
                {title}
              </h3>
            </Link>

            {/* Description Preview */}
            {description && (
              <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
                {description}
              </p>
            )}

            {/* Meta Info */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {type === "opportunity" && deadline && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>Due {format(new Date(deadline), "MMM d, yyyy")}</span>
                </div>
              )}
              {type === "event" && eventDate && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(eventDate), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
              )}
              {type === "event" && location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate max-w-[200px]">{location}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
