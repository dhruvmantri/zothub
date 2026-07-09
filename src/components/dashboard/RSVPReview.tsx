import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Filter,
  User,
  Mail,
  GraduationCap,
  Calendar,
  Loader2,
  Inbox,
  Download,
  Check,
  X,
  CalendarCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { exportToCSV, type CSVColumn } from "@/lib/csvExport";
import { sendRSVPStatusEmail } from "@/lib/eventNotifications";
import type { FormQuestion, FormAnswer } from "@/types";

interface RSVP {
  id: string;
  status: string;
  created_at: string;
  answers: FormAnswer[];
  event: {
    id: string;
    title: string;
    event_date: string;
    location: string | null;
    rsvp_questions: FormQuestion[];
    requires_approval: boolean;
    club_profiles: {
      club_name: string;
    };
  };
  student: {
    id: string;
    full_name: string | null;
    email: string;
    major: string | null;
    year: string | null;
  };
}

interface Event {
  id: string;
  title: string;
}

const statusColors = {
  confirmed: "success",
  pending: "accent",
  cancelled: "destructive"
} as const;

export function RSVPReview() {
  const { user } = useAuth();
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [selectedRsvp, setSelectedRsvp] = useState<RSVP | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRsvps();
    }
  }, [user]);

  const fetchRsvps = async () => {
    if (!user) return;

    try {
      // First get the club profile
      const { data: clubProfile, error: clubError } = await supabase
        .from("club_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (clubError || !clubProfile) {
        console.error("Error fetching club profile:", clubError);
        setIsLoading(false);
        return;
      }

      // Fetch events for the filter dropdown
      const { data: evts } = await supabase
        .from("events")
        .select("id, title")
        .eq("club_id", clubProfile.id)
        .order("event_date", { ascending: false });
      
      setEvents(evts || []);

      // Fetch RSVPs for this club's events
      const { data, error } = await supabase
        .from("rsvps")
        .select(`
          id,
          status,
          created_at,
          answers,
          event:events!inner (
            id,
            title,
            event_date,
            location,
            rsvp_questions,
            requires_approval,
            club_id,
            club_profiles (
              club_name
            )
          ),
          student:student_profiles!inner (
            id,
            full_name,
            email,
            major,
            year
          )
        `)
        .eq("event.club_id", clubProfile.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching RSVPs:", error);
        toast.error("Failed to load RSVPs");
        return;
      }

      // Transform the data
      const transformedRsvps: RSVP[] = (data || []).map((rsvp: any) => ({
        id: rsvp.id,
        status: rsvp.status || "confirmed",
        created_at: rsvp.created_at,
        answers: rsvp.answers || [],
        event: {
          id: rsvp.event.id,
          title: rsvp.event.title,
          event_date: rsvp.event.event_date,
          location: rsvp.event.location || null,
          rsvp_questions: rsvp.event.rsvp_questions || [],
          requires_approval: rsvp.event.requires_approval || false,
          club_profiles: {
            club_name: rsvp.event.club_profiles?.club_name || "Unknown Club"
          }
        },
        student: {
          id: rsvp.student.id,
          full_name: rsvp.student.full_name,
          email: rsvp.student.email,
          major: rsvp.student.major,
          year: rsvp.student.year
        }
      }));

      setRsvps(transformedRsvps);
    } catch (err) {
      console.error("Error:", err);
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const updateRsvpStatus = async (rsvpId: string, newStatus: string) => {
    setIsUpdating(true);
    try {
      // .select() so we can confirm a row actually changed. Without this an
      // RLS-filtered update returns success with 0 rows, which previously made
      // the UI show "confirmed" and send the approval email while the DB never
      // changed (row reverted to pending on refresh).
      const { data: updated, error } = await supabase
        .from("rsvps")
        .update({ status: newStatus })
        .eq("id", rsvpId)
        .select("id");

      if (error) {
        console.error("Error updating RSVP:", error);
        toast.error("Failed to update RSVP");
        return;
      }

      if (!updated || updated.length === 0) {
        console.error("RSVP update affected 0 rows (RLS or missing row):", rsvpId);
        toast.error("Could not update this RSVP. Please refresh and try again.");
        return;
      }

      // Find the RSVP to get details for email
      const rsvp = rsvps.find(r => r.id === rsvpId);

      // Send email notification for status change (only for confirm/cancel)
      if (rsvp && (newStatus === "confirmed" || newStatus === "cancelled")) {
        sendRSVPStatusEmail(
          rsvpId,
          newStatus as "confirmed" | "cancelled",
          rsvp.event.title,
          format(new Date(rsvp.event.event_date), "MMMM d, yyyy 'at' h:mm a"),
          rsvp.event.location,
          rsvp.event.club_profiles.club_name,
          rsvp.student.email,
          rsvp.student.full_name || "there"
        ).catch(err => console.error("Failed to send RSVP status email:", err));
      }

      // Update local state
      setRsvps(prev => 
        prev.map(r => 
          r.id === rsvpId ? { ...r, status: newStatus } : r
        )
      );

      // Update selected RSVP if it's the one being updated
      if (selectedRsvp?.id === rsvpId) {
        setSelectedRsvp(prev => prev ? { ...prev, status: newStatus } : null);
      }

      toast.success(`RSVP ${newStatus}`);
    } catch (err) {
      console.error("Error:", err);
      toast.error("An error occurred");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedIds.size === 0) return;
    
    setIsBulkUpdating(true);
    try {
      const idsToUpdate = Array.from(selectedIds);

      const { data: updated, error } = await supabase
        .from("rsvps")
        .update({ status: newStatus })
        .in("id", idsToUpdate)
        .select("id");

      if (error) {
        console.error("Error updating RSVPs:", error);
        toast.error("Failed to update RSVPs");
        return;
      }

      const updatedIds = new Set((updated || []).map((r) => r.id));
      if (updatedIds.size === 0) {
        console.error("Bulk RSVP update affected 0 rows (RLS or missing rows)");
        toast.error("Could not update these RSVPs. Please refresh and try again.");
        return;
      }

      // Send email notifications only for the RSVPs that actually changed
      if (newStatus === "confirmed" || newStatus === "cancelled") {
        const rsvpsToNotify = rsvps.filter(r => updatedIds.has(r.id));
        for (const rsvp of rsvpsToNotify) {
          sendRSVPStatusEmail(
            rsvp.id,
            newStatus as "confirmed" | "cancelled",
            rsvp.event.title,
            format(new Date(rsvp.event.event_date), "MMMM d, yyyy 'at' h:mm a"),
            rsvp.event.location,
            rsvp.event.club_profiles.club_name,
            rsvp.student.email,
            rsvp.student.full_name || "there"
          ).catch(err => console.error("Failed to send RSVP status email:", err));
        }
      }

      // Update local state (only rows that actually changed)
      setRsvps(prev =>
        prev.map(rsvp =>
          updatedIds.has(rsvp.id) ? { ...rsvp, status: newStatus } : rsvp
        )
      );

      toast.success(`${updatedIds.size} RSVPs ${newStatus}`);
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Error:", err);
      toast.error("An error occurred");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredRsvps.map(rsvp => rsvp.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleExportCSV = () => {
    const dataToExport = selectedIds.size > 0 
      ? filteredRsvps.filter(rsvp => selectedIds.has(rsvp.id))
      : filteredRsvps;

    if (dataToExport.length === 0) {
      toast.error("No RSVPs to export");
      return;
    }

    // Build columns dynamically based on question keys
    const allQuestionIds = new Set<string>();
    dataToExport.forEach(rsvp => {
      rsvp.answers.forEach(ans => allQuestionIds.add(ans.question_id));
    });

    const columns: CSVColumn<RSVP>[] = [
      { header: "Attendee Name", accessor: (rsvp) => rsvp.student.full_name || "N/A" },
      { header: "Email", accessor: (rsvp) => rsvp.student.email },
      { header: "Major", accessor: (rsvp) => rsvp.student.major || "N/A" },
      { header: "Year", accessor: (rsvp) => rsvp.student.year || "N/A" },
      { header: "Event", accessor: (rsvp) => rsvp.event.title },
      { header: "Event Date", accessor: (rsvp) => format(new Date(rsvp.event.event_date), "yyyy-MM-dd HH:mm") },
      { header: "Status", accessor: (rsvp) => rsvp.status },
      { header: "RSVP Date", accessor: (rsvp) => format(new Date(rsvp.created_at), "yyyy-MM-dd") },
    ];

    // Add columns for each unique question
    Array.from(allQuestionIds).forEach((qId, index) => {
      columns.push({
        header: `Question ${index + 1}`,
        accessor: (rsvp) => {
          const answer = rsvp.answers.find(a => a.question_id === qId);
          if (!answer) return "";
          return Array.isArray(answer.answer) ? answer.answer.join("; ") : String(answer.answer);
        }
      });
    });

    const filename = `rsvps-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    exportToCSV(dataToExport, columns, filename);
    toast.success(`Exported ${dataToExport.length} RSVPs`);
  };

  const getQuestionText = (questionId: string, questions: FormQuestion[]): string => {
    const question = questions.find(q => q.id === questionId);
    return question?.question || "Unknown question";
  };

  const formatAnswer = (answer: string | string[]): string => {
    if (Array.isArray(answer)) {
      return answer.join(", ");
    }
    return answer;
  };

  const getInitials = (name: string | null): string => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const filteredRsvps = useMemo(() => {
    return rsvps.filter(rsvp => {
      const matchesSearch = 
        (rsvp.student.full_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        rsvp.event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rsvp.student.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || rsvp.status === statusFilter;
      const matchesEvent = eventFilter === "all" || rsvp.event.id === eventFilter;
      return matchesSearch && matchesStatus && matchesEvent;
    });
  }, [rsvps, searchQuery, statusFilter, eventFilter]);

  const pendingCount = rsvps.filter(r => r.status === "pending").length;
  const allSelected = filteredRsvps.length > 0 && filteredRsvps.every(rsvp => selectedIds.has(rsvp.id));
  const someSelected = selectedIds.size > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search RSVPs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-3">
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {events.map(event => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExportCSV} className="gap-2">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {someSelected && (
          <div className="flex items-center gap-4 p-3 bg-accent/10 rounded-lg border border-accent/20">
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size} selected
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkStatusUpdate("confirmed")}
                disabled={isBulkUpdating}
                className="gap-1"
              >
                <Check className="w-3 h-3" />
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkStatusUpdate("cancelled")}
                disabled={isBulkUpdating}
                className="gap-1 text-destructive hover:text-destructive"
              >
                <X className="w-3 h-3" />
                Cancel
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto"
            >
              Clear selection
            </Button>
          </div>
        )}
      </div>

      {/* Pending RSVPs Notice */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-accent/10 rounded-lg border border-accent/20">
          <CalendarCheck className="w-5 h-5 text-accent" />
          <p className="text-sm text-foreground">
            You have <span className="font-semibold">{pendingCount}</span> pending RSVPs awaiting approval
          </p>
        </div>
      )}

      {/* RSVPs List */}
      {filteredRsvps.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Inbox className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            {rsvps.length === 0 ? "No RSVPs yet" : "No RSVPs found matching your filters"}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[auto_1fr_1fr_120px_100px_80px] gap-4 px-4 py-3 bg-secondary/50 border-b border-border text-sm font-medium text-muted-foreground">
            <div className="flex items-center">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
              />
            </div>
            <div>Attendee</div>
            <div>Event</div>
            <div>RSVP Date</div>
            <div>Status</div>
            <div>Actions</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border">
            {filteredRsvps.map((rsvp) => (
              <div 
                key={rsvp.id}
                className="grid grid-cols-[auto_1fr_1fr_120px_100px_80px] gap-4 px-4 py-3 items-center hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center">
                  <Checkbox
                    checked={selectedIds.has(rsvp.id)}
                    onCheckedChange={(checked) => handleSelectOne(rsvp.id, !!checked)}
                  />
                </div>
                
                {/* Attendee Info */}
                <div 
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setSelectedRsvp(rsvp)}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                    {getInitials(rsvp.student.full_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {rsvp.student.full_name || "Unknown"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {rsvp.student.email}
                    </p>
                  </div>
                </div>

                {/* Event */}
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{rsvp.event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(rsvp.event.event_date), "MMM d, yyyy")}
                  </p>
                </div>

                {/* RSVP Date */}
                <div className="text-sm text-muted-foreground">
                  {format(new Date(rsvp.created_at), "MMM d, yyyy")}
                </div>

                {/* Status */}
                <Badge 
                  variant={statusColors[rsvp.status as keyof typeof statusColors] || "default"}
                  className="capitalize"
                >
                  {rsvp.status}
                </Badge>

                {/* Quick Actions */}
                <div className="flex gap-1">
                  {rsvp.status === "pending" && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                        onClick={() => updateRsvpStatus(rsvp.id, "confirmed")}
                        disabled={isUpdating}
                        title="Confirm"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => updateRsvpStatus(rsvp.id, "cancelled")}
                        disabled={isUpdating}
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RSVP Detail Dialog */}
      <Dialog open={!!selectedRsvp} onOpenChange={() => setSelectedRsvp(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                {selectedRsvp && getInitials(selectedRsvp.student.full_name)}
              </div>
              <div>
                <p>{selectedRsvp?.student.full_name || "Unknown Attendee"}</p>
                <p className="text-sm font-normal text-muted-foreground">
                  RSVP for {selectedRsvp?.event.title}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedRsvp && (
            <div className="space-y-6">
              {/* Attendee Info */}
              <div className="space-y-3">
                <h4 className="font-medium text-foreground">Attendee Details</h4>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>{selectedRsvp.student.email}</span>
                  </div>
                  {selectedRsvp.student.major && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GraduationCap className="w-4 h-4" />
                      <span>{selectedRsvp.student.major}</span>
                    </div>
                  )}
                  {selectedRsvp.student.year && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span>{selectedRsvp.student.year}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>RSVP'd on {format(new Date(selectedRsvp.created_at), "MMMM d, yyyy")}</span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge 
                  variant={statusColors[selectedRsvp.status as keyof typeof statusColors] || "default"}
                  className="capitalize"
                >
                  {selectedRsvp.status}
                </Badge>
              </div>

              {/* Answers */}
              {selectedRsvp.answers.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-foreground">Responses</h4>
                  <div className="space-y-4">
                    {selectedRsvp.answers.map((answer, index) => (
                      <div key={index} className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          {getQuestionText(answer.question_id, selectedRsvp.event.rsvp_questions)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatAnswer(answer.answer)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedRsvp?.status === "pending" && (
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => updateRsvpStatus(selectedRsvp.id, "cancelled")}
                  disabled={isUpdating}
                  className="gap-2 flex-1 sm:flex-none"
                >
                  <X className="w-4 h-4" />
                  Cancel RSVP
                </Button>
                <Button
                  onClick={() => updateRsvpStatus(selectedRsvp.id, "confirmed")}
                  disabled={isUpdating}
                  className="gap-2 flex-1 sm:flex-none"
                >
                  {isUpdating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Confirm RSVP
                </Button>
              </div>
            )}
            {selectedRsvp?.status !== "pending" && (
              <Button variant="outline" onClick={() => setSelectedRsvp(null)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
