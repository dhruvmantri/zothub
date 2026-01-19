import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Users, Bookmark, CheckCircle } from "lucide-react";
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
  hasApplied?: boolean;
}

const typeColors = {
  leadership: "default",
  project: "success",
  internship: "secondary",
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
  onBookmark,
  hasApplied
}: OpportunityCardProps) {
  return (
    <div className="group relative p-5 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors">
      {/* Applied badge */}
      {hasApplied && (
        <Badge 
          variant="default" 
          className="absolute top-4 left-4 bg-success text-success-foreground text-[10px] px-2 py-0.5"
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          Applied
        </Badge>
      )}
      
      {/* Bookmark button */}
      <button
        onClick={onBookmark}
        className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-secondary transition-colors"
      >
        <Bookmark 
          className={cn(
            "w-4 h-4 transition-colors",
            isBookmarked ? "fill-primary text-primary" : "text-muted-foreground"
          )} 
        />
      </button>

      {/* Club info */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center overflow-hidden">
          {clubLogo ? (
            <img src={clubLogo} alt={clubName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              {clubName.charAt(0)}
            </span>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{clubName}</p>
          <Badge variant={typeColors[type]} className="mt-1 capitalize text-[10px] px-2 py-0">
            {type}
          </Badge>
        </div>
      </div>

      {/* Title and description */}
      <Link to={`/opportunities/${id}`}>
        <h3 className="text-base font-medium text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
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
    <div className="group relative rounded-lg bg-card border border-border hover:border-primary/30 transition-colors overflow-hidden">
      {/* Banner */}
      <div className="relative h-36 bg-secondary overflow-hidden">
        {bannerImage ? (
          <img 
            src={bannerImage} 
            alt={title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10" />
        )}
        
        {/* Bookmark button */}
        <button
          onClick={onBookmark}
          className="absolute top-3 right-3 p-1.5 rounded-md bg-background/90 hover:bg-background transition-colors"
        >
          <Bookmark 
            className={cn(
              "w-4 h-4 transition-colors",
              isBookmarked ? "fill-primary text-primary" : "text-foreground"
            )} 
          />
        </button>

        {/* Date badge */}
        <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-background/90 text-xs font-medium text-foreground">
          {date}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Club info */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-md bg-secondary flex items-center justify-center overflow-hidden">
            {clubLogo ? (
              <img src={clubLogo} alt={clubName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-medium text-muted-foreground">
                {clubName.charAt(0)}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{clubName}</p>
        </div>

        {/* Title */}
        <Link to={`/events/${id}`}>
          <h3 className="text-base font-medium text-foreground mb-3 group-hover:text-primary transition-colors line-clamp-2">
            {title}
          </h3>
        </Link>

        {/* Meta info */}
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span>{time}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" />
            <span className="line-clamp-1">{location}</span>
          </div>
        </div>

        {/* Attendees */}
        {attendees !== undefined && capacity !== undefined && (
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {attendees}/{capacity} attending
              </span>
              <div className="h-1.5 w-20 rounded-full bg-secondary overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all"
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
