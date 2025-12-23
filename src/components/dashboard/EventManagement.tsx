import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye,
  Users,
  Clock,
  MapPin,
  Calendar,
  Filter,
  Loader2,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  capacity: number | null;
  banner_url: string | null;
  is_active: boolean;
  views: number;
  created_at: string;
  rsvps_count: number;
}

interface EventManagementProps {
  events: Event[];
  onDelete: (id: string) => Promise<boolean>;
  isLoading?: boolean;
}

export function EventManagement({ events, onDelete, isLoading }: EventManagementProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);

  const getStatus = (event: Event) => {
    if (!event.is_active) return "draft";
    const eventDate = new Date(event.event_date);
    if (isPast(eventDate)) return "past";
    if (isToday(eventDate)) return "ongoing";
    return "upcoming";
  };

  const statusColors: Record<string, "success" | "accent" | "muted" | "secondary"> = {
    upcoming: "success",
    ongoing: "accent",
    past: "muted",
    draft: "secondary",
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
    const status = getStatus(event);
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async () => {
    if (!eventToDelete) return;
    await onDelete(eventToDelete.id);
    setEventToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                {statusFilter === "all" ? "All Status" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Status</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("upcoming")}>Upcoming</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("ongoing")}>Ongoing</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("past")}>Past</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("draft")}>Draft</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link to="/club/events/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Event
            </Button>
          </Link>
        </div>
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            {events.length === 0 ? "No events created yet" : "No events found"}
          </p>
          {events.length === 0 && (
            <Link to="/club/events/new">
              <Button className="mt-4 gap-2">
                <Plus className="w-4 h-4" />
                Create your first event
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredEvents.map((event) => {
            const status = getStatus(event);
            const capacityPercent = event.capacity 
              ? Math.min((event.rsvps_count / event.capacity) * 100, 100) 
              : 0;
            
            return (
              <div 
                key={event.id}
                className="p-5 rounded-xl bg-card border border-border shadow-card hover:shadow-card-hover transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Event Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-foreground truncate">{event.title}</h3>
                      <Badge variant={statusColors[status]} className="capitalize shrink-0">
                        {status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(event.event_date), "MMM d, yyyy")}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        {format(new Date(event.event_date), "h:mm a")}
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" />
                          {event.location}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">{event.rsvps_count}</p>
                      <p className="text-xs text-muted-foreground">RSVPs</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">{event.capacity || "∞"}</p>
                      <p className="text-xs text-muted-foreground">Capacity</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">{event.views}</p>
                      <p className="text-xs text-muted-foreground">Views</p>
                    </div>
                  </div>

                  {/* Progress */}
                  {event.capacity && (
                    <div className="lg:w-32">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Capacity</span>
                        <span>{Math.round(capacityPercent)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div 
                          className="h-full bg-accent rounded-full transition-all"
                          style={{ width: `${capacityPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => navigate(`/events/${event.id}`)}
                        className="gap-2"
                      >
                        <Eye className="w-4 h-4" /> View
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => navigate(`/club/events/${event.id}/edit`)}
                        className="gap-2"
                      >
                        <Edit className="w-4 h-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setEventToDelete(event)}
                        className="gap-2 text-destructive"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!eventToDelete} onOpenChange={() => setEventToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{eventToDelete?.title}"? 
              This will also delete all associated RSVPs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
