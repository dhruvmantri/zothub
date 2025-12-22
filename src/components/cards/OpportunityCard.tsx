import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, Clock, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OpportunityCardProps {
  id: string;
  title: string;
  clubName: string;
  clubLogo?: string;
  type: "leadership" | "project" | "internship" | "volunteer";
  deadline: string;
  description: string;
  applicants?: number;
  isBookmarked?: boolean;
  onBookmark?: () => void;
}

const typeColors = {
  leadership: "accent",
  project: "success",
  internship: "default",
  volunteer: "muted"
} as const;

export function OpportunityCard({
  id,
  title,
  clubName,
  clubLogo,
  type,
  deadline,
  description,
  applicants,
  isBookmarked,
  onBookmark
}: OpportunityCardProps) {
  return (
    <div className="group relative p-6 rounded-2xl bg-card shadow-card hover:shadow-card-hover transition-all duration-300 border border-border/50">
      {/* Bookmark button */}
      <button
        onClick={onBookmark}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-secondary transition-colors"
      >
        <Bookmark 
          className={cn(
            "w-4 h-4 transition-colors",
            isBookmarked ? "fill-accent text-accent" : "text-muted-foreground"
          )} 
        />
      </button>

      {/* Club info */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
          {clubLogo ? (
            <img src={clubLogo} alt={clubName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">
              {clubName.charAt(0)}
            </span>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{clubName}</p>
          <Badge variant={typeColors[type]} className="mt-1 capitalize">
            {type}
          </Badge>
        </div>
      </div>

      {/* Title and description */}
      <Link to={`/opportunities/${id}`}>
        <h3 className="font-display text-lg font-semibold text-foreground mb-2 group-hover:text-accent transition-colors line-clamp-2">
          {title}
        </h3>
      </Link>
      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
        {description}
      </p>

      {/* Meta info */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>Due {deadline}</span>
        </div>
        {applicants !== undefined && (
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>{applicants} applied</span>
          </div>
        )}
      </div>
    </div>
  );
}

export interface EventCardProps {
  id: string;
  title: string;
  clubName: string;
  clubLogo?: string;
  date: string;
  time: string;
  location: string;
  bannerImage?: string;
  attendees?: number;
  capacity?: number;
  isBookmarked?: boolean;
  onBookmark?: () => void;
}

export function EventCard({
  id,
  title,
  clubName,
  clubLogo,
  date,
  time,
  location,
  bannerImage,
  attendees,
  capacity,
  isBookmarked,
  onBookmark
}: EventCardProps) {
  return (
    <div className="group relative rounded-2xl bg-card shadow-card hover:shadow-card-hover transition-all duration-300 border border-border/50 overflow-hidden">
      {/* Banner */}
      <div className="relative h-40 bg-secondary overflow-hidden">
        {bannerImage ? (
          <img 
            src={bannerImage} 
            alt={title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20" />
        )}
        
        {/* Bookmark button */}
        <button
          onClick={onBookmark}
          className="absolute top-3 right-3 p-2 rounded-lg bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
        >
          <Bookmark 
            className={cn(
              "w-4 h-4 transition-colors",
              isBookmarked ? "fill-accent text-accent" : "text-foreground"
            )} 
          />
        </button>

        {/* Date badge */}
        <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-background/90 backdrop-blur-sm">
          <p className="text-xs font-semibold text-foreground">{date}</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Club info */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center overflow-hidden">
            {clubLogo ? (
              <img src={clubLogo} alt={clubName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-muted-foreground">
                {clubName.charAt(0)}
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-muted-foreground">{clubName}</p>
        </div>

        {/* Title */}
        <Link to={`/events/${id}`}>
          <h3 className="font-display text-lg font-semibold text-foreground mb-3 group-hover:text-accent transition-colors line-clamp-2">
            {title}
          </h3>
        </Link>

        {/* Meta info */}
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>{time}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span className="line-clamp-1">{location}</span>
          </div>
        </div>

        {/* Attendees */}
        {attendees !== undefined && capacity !== undefined && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {attendees}/{capacity} attending
              </span>
              <div className="h-2 w-24 rounded-full bg-secondary overflow-hidden">
                <div 
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${Math.min((attendees / capacity) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
