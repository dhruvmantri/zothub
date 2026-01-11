import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ClubLayout } from "@/components/club/ClubLayout";
import { EventManagement } from "@/components/dashboard/EventManagement";
import { useClubData } from "@/hooks/useClubData";

export default function ClubEvents() {
  const {
    events,
    isLoading,
    deleteEvent,
  } = useClubData();

  return (
    <ClubLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Events</h1>
            <p className="text-muted-foreground mt-1">
              Manage your club's events and gatherings
            </p>
          </div>
          <Link to="/club/events/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Event
            </Button>
          </Link>
        </div>

        {/* Event List */}
        <EventManagement 
          events={events}
          onDelete={deleteEvent}
          isLoading={isLoading}
        />
      </div>
    </ClubLayout>
  );
}
