import { useState } from "react";
import { Link } from "react-router-dom";
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
  Filter
} from "lucide-react";

interface Event {
  id: string;
  title: string;
  status: "upcoming" | "ongoing" | "past" | "draft";
  date: string;
  time: string;
  location: string;
  rsvps: number;
  capacity: number;
  views: number;
}

const mockEvents: Event[] = [
  {
    id: "1",
    title: "Winter Hackathon 2025",
    status: "upcoming",
    date: "Jan 18, 2025",
    time: "9:00 AM - 9:00 PM",
    location: "Donald Bren Hall",
    rsvps: 156,
    capacity: 200,
    views: 523
  },
  {
    id: "2",
    title: "Tech Talk: AI in Healthcare",
    status: "upcoming",
    date: "Jan 22, 2025",
    time: "6:00 PM - 8:00 PM",
    location: "ICS 174",
    rsvps: 45,
    capacity: 80,
    views: 234
  },
  {
    id: "3",
    title: "Resume Workshop",
    status: "upcoming",
    date: "Jan 25, 2025",
    time: "4:00 PM - 6:00 PM",
    location: "Career Center",
    rsvps: 32,
    capacity: 50,
    views: 189
  },
  {
    id: "4",
    title: "Fall General Meeting",
    status: "past",
    date: "Dec 1, 2024",
    time: "5:00 PM - 6:30 PM",
    location: "EH 1200",
    rsvps: 120,
    capacity: 150,
    views: 412
  },
  {
    id: "5",
    title: "Spring Kickoff",
    status: "draft",
    date: "Feb 1, 2025",
    time: "5:00 PM - 7:00 PM",
    location: "TBD",
    rsvps: 0,
    capacity: 100,
    views: 0
  },
];

const statusColors = {
  upcoming: "success",
  ongoing: "accent",
  past: "muted",
  draft: "secondary"
} as const;

export function EventManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredEvents = mockEvents.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || event.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
      <div className="grid gap-4">
        {filteredEvents.map((event) => (
          <div 
            key={event.id}
            className="p-5 rounded-xl bg-card border border-border shadow-card hover:shadow-card-hover transition-all"
          >
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Event Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-foreground truncate">{event.title}</h3>
                  <Badge variant={statusColors[event.status]} className="capitalize shrink-0">
                    {event.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {event.date}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {event.time}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {event.location}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{event.rsvps}</p>
                  <p className="text-xs text-muted-foreground">RSVPs</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{event.capacity}</p>
                  <p className="text-xs text-muted-foreground">Capacity</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{event.views}</p>
                  <p className="text-xs text-muted-foreground">Views</p>
                </div>
              </div>

              {/* Progress */}
              <div className="lg:w-32">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Capacity</span>
                  <span>{Math.round((event.rsvps / event.capacity) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div 
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${Math.min((event.rsvps / event.capacity) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="gap-2">
                    <Eye className="w-4 h-4" /> View
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2">
                    <Users className="w-4 h-4" /> View RSVPs
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2">
                    <Edit className="w-4 h-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-destructive">
                    <Trash2 className="w-4 h-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}

        {filteredEvents.length === 0 && (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <p className="text-muted-foreground">No events found</p>
          </div>
        )}
      </div>
    </div>
  );
}
