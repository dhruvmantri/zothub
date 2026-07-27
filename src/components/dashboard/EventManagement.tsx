import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getStatus, getEventStatus } from "@/lib/status";
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
} from "lucide-react";
import { format } from "date-fns";
import type { DashboardEvent } from "@/types";
import { PageLoader } from "@/components/ui/page-loader";

interface EventManagementProps {
  events: DashboardEvent[];
  onDelete: (id: string) => Promise<boolean>;
  isLoading?: boolean;
}

export function EventManagement({ events, onDelete, isLoading }: EventManagementProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventToDelete, setEventToDelete] = useState<DashboardEvent | null>(null);

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
    const status = getEventStatus(event);
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async () => {
    if (!eventToDelete) return;
    await onDelete(eventToDelete.id);
    setEventToDelete(null);
  };

  if (isLoading) {
    return <PageLoader />;
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
                {statusFilter === "all" ? "All statuses" : getStatus("event", statusFilter).label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>All statuses</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("upcoming")}>Upcoming</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("ongoing")}>Today</DropdownMenuItem>
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
        <div className="rounded-lg border border-line bg-surface py-12 text-center">
          <Calendar className="w-12 h-12 mx-auto text-ink-3 mb-4" />
          <p className="text-ink-2">
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
            const capacityPercent = event.capacity
              ? Math.min((event.rsvps_count / event.capacity) * 100, 100)
              : 0;

            return (
              <div
                key={event.id}
                className="rounded-lg border border-line bg-surface p-5 shadow-e1 transition-all hover:shadow-e2"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Event Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-ink truncate">{event.title}</h3>
                      <StatusBadge domain="event" status={getEventStatus(event)} className="shrink-0" />
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-ink-2">
                      <div className="flex items-center gap-1.5 font-data">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(event.event_date), "MMM d, yyyy")}
                      </div>
                      <div className="flex items-center gap-1.5 font-data">
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
                      <p className="font-data text-2xl font-semibold text-ink">{event.rsvps_count}</p>
                      <p className="text-xs text-ink-2">RSVPs</p>
                    </div>
                    <div className="text-center">
                      <p className="font-data text-2xl font-semibold text-ink">{event.capacity || "∞"}</p>
                      <p className="text-xs text-ink-2">Capacity</p>
                    </div>
                    <div className="text-center">
                      <p className="font-data text-2xl font-semibold text-ink">{event.views}</p>
                      <p className="text-xs text-ink-2">Views</p>
                    </div>
                  </div>

                  {/* Progress */}
                  {event.capacity && (
                    <div className="lg:w-32">
                      <div className="mb-1 flex items-center justify-between text-xs text-ink-2">
                        <span>Capacity</span>
                        <span className="font-data">{Math.round(capacityPercent)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${capacityPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        aria-label={`Actions for ${event.title}`}
                      >
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
