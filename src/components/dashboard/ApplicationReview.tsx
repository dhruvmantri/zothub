import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EntityAvatar } from "@/components/ui/avatar";
import { getStatus } from "@/lib/status";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  FileText,
  ExternalLink,
  Check,
  X,
  User,
  Mail,
  GraduationCap,
  Calendar,
  Loader2,
  Inbox,
  Download,
  CheckSquare,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { exportToCSV, type CSVColumn } from "@/lib/csvExport";
import { sendApplicationStatusUpdate } from "@/lib/emailService";
import { openFileUrl } from "@/lib/storageUrls";
import type { FormQuestion, FormAnswer } from "@/types";

interface Application {
  id: string;
  status: string;
  created_at: string;
  resume_url: string | null;
  answers: FormAnswer[];
  opportunity: {
    id: string;
    title: string;
    application_questions: FormQuestion[];
  };
  student: {
    id: string;
    full_name: string | null;
    email: string;
    major: string | null;
    year: string | null;
  };
}

interface Opportunity {
  id: string;
  title: string;
}

export function ApplicationReview() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [opportunityFilter, setOpportunityFilter] = useState<string>("all");
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchApplications();
    }
  }, [user]);

  const fetchApplications = async () => {
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

      // Fetch opportunities for the filter dropdown
      const { data: opps } = await supabase
        .from("opportunities")
        .select("id, title")
        .eq("club_id", clubProfile.id)
        .order("created_at", { ascending: false });
      
      setOpportunities(opps || []);

      // Fetch applications for this club's opportunities
      const { data, error } = await supabase
        .from("applications")
        .select(`
          id,
          status,
          created_at,
          resume_url,
          answers,
          opportunity:opportunities!inner (
            id,
            title,
            application_questions,
            club_id
          ),
          student:student_profiles!inner (
            id,
            full_name,
            email,
            major,
            year
          )
        `)
        .eq("opportunity.club_id", clubProfile.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching applications:", error);
        toast.error("Failed to load applications");
        return;
      }

      // Transform the data
      const transformedApplications: Application[] = (data || []).map((app) => ({
        id: app.id,
        status: app.status || "pending",
        created_at: app.created_at,
        resume_url: app.resume_url,
        // JSONB column; the application form writes FormAnswer[] here.
        answers: (app.answers || []) as unknown as FormAnswer[],
        opportunity: {
          id: app.opportunity.id,
          title: app.opportunity.title,
          // JSONB column; the question builder writes FormQuestion[] here.
          application_questions: (app.opportunity.application_questions || []) as unknown as FormQuestion[]
        },
        student: {
          id: app.student.id,
          full_name: app.student.full_name,
          email: app.student.email,
          major: app.student.major,
          year: app.student.year
        }
      }));

      setApplications(transformedApplications);
    } catch (err) {
      console.error("Error:", err);
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const updateApplicationStatus = async (applicationId: string, newStatus: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("applications")
        .update({ status: newStatus })
        .eq("id", applicationId);

      if (error) {
        console.error("Error updating application:", error);
        toast.error("Failed to update application");
        return;
      }

      // Find the application to get student info for email
      const app = applications.find(a => a.id === applicationId);
      
      // Update local state
      setApplications(prev => 
        prev.map(a => 
          a.id === applicationId ? { ...a, status: newStatus } : a
        )
      );

      // Update selected application if it's the one being updated
      if (selectedApplication?.id === applicationId) {
        setSelectedApplication(prev => prev ? { ...prev, status: newStatus } : null);
      }

      // Send status update email (non-blocking). The DB status was just updated
      // above; the edge function derives recipient + current status from it.
      if (app && (newStatus === "accepted" || newStatus === "rejected")) {
        sendApplicationStatusUpdate(applicationId).catch(console.error);
      }

      toast.success(
        newStatus === "reviewed"
          ? "Marked as reviewed"
          : `Application ${getStatus("application", newStatus, "club").label.toLowerCase()}`,
      );
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
      
      const { error } = await supabase
        .from("applications")
        .update({ status: newStatus })
        .in("id", idsToUpdate);

      if (error) {
        console.error("Error updating applications:", error);
        toast.error("Failed to update applications");
        return;
      }

      // Send status update emails for accepted/rejected (non-blocking). The DB
      // statuses were just updated above; each send derives from the application id.
      if (newStatus === "accepted" || newStatus === "rejected") {
        const appsToEmail = applications.filter(app => selectedIds.has(app.id));
        appsToEmail.forEach(app => {
          sendApplicationStatusUpdate(app.id).catch(console.error);
        });
      }

      // Update local state
      setApplications(prev => 
        prev.map(app => 
          selectedIds.has(app.id) ? { ...app, status: newStatus } : app
        )
      );

      toast.success(
        `${selectedIds.size} applications ${getStatus("application", newStatus, "club").label.toLowerCase()}`,
      );
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
      setSelectedIds(new Set(filteredApplications.map(app => app.id)));
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
      ? filteredApplications.filter(app => selectedIds.has(app.id))
      : filteredApplications;

    if (dataToExport.length === 0) {
      toast.error("No applications to export");
      return;
    }

    // Build columns dynamically based on question keys
    const allQuestionIds = new Set<string>();
    dataToExport.forEach(app => {
      app.answers.forEach(ans => allQuestionIds.add(ans.question_id));
    });

    const columns: CSVColumn<Application>[] = [
      { header: "Applicant Name", accessor: (app) => app.student.full_name || "N/A" },
      { header: "Email", accessor: (app) => app.student.email },
      { header: "Major", accessor: (app) => app.student.major || "N/A" },
      { header: "Year", accessor: (app) => app.student.year || "N/A" },
      { header: "Opportunity", accessor: (app) => app.opportunity.title },
      { header: "Status", accessor: (app) => app.status },
      { header: "Applied Date", accessor: (app) => format(new Date(app.created_at), "yyyy-MM-dd") },
      { header: "Resume URL", accessor: (app) => app.resume_url || "" },
    ];

    // Add columns for each unique question
    Array.from(allQuestionIds).forEach((qId, index) => {
      columns.push({
        header: `Question ${index + 1}`,
        accessor: (app) => {
          const answer = app.answers.find(a => a.question_id === qId);
          if (!answer) return "";
          return Array.isArray(answer.answer) ? answer.answer.join("; ") : String(answer.answer);
        }
      });
    });

    const filename = `applications-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    exportToCSV(dataToExport, columns, filename);
    toast.success(`Exported ${dataToExport.length} applications`);
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

  const filteredApplications = useMemo(() => {
    return applications.filter(app => {
      const matchesSearch = 
        (app.student.full_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        app.opportunity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.student.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || app.status === statusFilter;
      const matchesOpportunity = opportunityFilter === "all" || app.opportunity.id === opportunityFilter;
      return matchesSearch && matchesStatus && matchesOpportunity;
    });
  }, [applications, searchQuery, statusFilter, opportunityFilter]);

  const pendingCount = applications.filter(a => a.status === "pending").length;
  const allSelected = filteredApplications.length > 0 && filteredApplications.every(app => selectedIds.has(app.id));
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
              placeholder="Search applications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Opportunity Filter */}
            <Select value={opportunityFilter} onValueChange={setOpportunityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Opportunities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Opportunities</SelectItem>
                {opportunities.map((opp) => (
                  <SelectItem key={opp.id} value={opp.id}>
                    {opp.title.length > 25 ? opp.title.substring(0, 25) + "..." : opp.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" />
                  {/* Club-audience wording: "pending" reads as "New", "rejected"
                      as "Declined" — same vocabulary as the badges. */}
                  {statusFilter === "all" ? "All statuses" : getStatus("application", statusFilter, "club").label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>All statuses</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("pending")}>
                  New ({pendingCount})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("reviewed")}>Reviewed</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("accepted")}>Accepted</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("rejected")}>Declined</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export Button */}
            <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {someSelected && (
          <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-3">
            <CheckSquare className="w-4 h-4 text-ink-2" />
            <span className="text-sm font-medium text-ink">{selectedIds.size} selected</span>
            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-ok/40 text-ok hover:bg-ok-wash hover:text-ok"
                disabled={isBulkUpdating}
                onClick={() => handleBulkStatusUpdate("accepted")}
              >
                <Check className="w-3.5 h-3.5" />
                Accept all
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-bad/40 text-bad hover:bg-bad-wash hover:text-bad"
                disabled={isBulkUpdating}
                onClick={() => handleBulkStatusUpdate("rejected")}
              >
                <X className="w-3.5 h-3.5" />
                Decline all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Applications List — same table shape as the RSVP queue so both
          Responses tabs read as one surface: a header row, then aligned
          columns that don't shift whether a row is decided or not. */}
      {filteredApplications.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface py-12 text-center">
          <Inbox className="w-12 h-12 mx-auto text-ink-3 mb-4" />
          <p className="text-ink-2">
            {applications.length === 0
              ? "No applications yet. They'll appear here when students apply to your opportunities."
              : "No applications match your search criteria."
            }
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <div className="min-w-[760px]">
            {/* Header */}
            <div className="grid grid-cols-[auto_1.6fr_1fr_120px_116px_176px] items-center gap-4 border-b border-line bg-surface-2 px-4 py-3 text-sm font-medium text-ink-2">
              <div className="flex items-center">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all applications"
                />
              </div>
              <div>Applicant</div>
              <div>Opportunity</div>
              <div>Applied</div>
              <div>Status</div>
              <div className="text-right">Actions</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-line">
              {filteredApplications.map((application) => {
                const decided = application.status === "accepted" || application.status === "rejected";
                return (
                  <div
                    key={application.id}
                    className="grid grid-cols-[auto_1.6fr_1fr_120px_116px_176px] items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2 cursor-pointer"
                    onClick={() => setSelectedApplication(application)}
                  >
                    <div className="flex items-center">
                      <Checkbox
                        checked={selectedIds.has(application.id)}
                        onCheckedChange={(checked) => handleSelectOne(application.id, checked as boolean)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${application.student.full_name || application.student.email}`}
                      />
                    </div>

                    {/* Applicant */}
                    <div className="flex items-center gap-3 min-w-0">
                      <EntityAvatar
                        kind="person"
                        name={application.student.full_name || application.student.email}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-ink truncate">
                          {application.student.full_name || application.student.email}
                        </p>
                        <p className="text-sm text-ink-2 truncate">
                          {application.student.major || "No major"} • {application.student.year || "Year not set"}
                        </p>
                      </div>
                    </div>

                    {/* Opportunity */}
                    <div className="min-w-0">
                      <p className="text-sm text-ink truncate">{application.opportunity.title}</p>
                    </div>

                    {/* Applied */}
                    <div className="font-data text-sm text-ink-2">
                      {format(new Date(application.created_at), "MMM d, yyyy")}
                    </div>

                    {/* Status */}
                    <div>
                      <StatusBadge domain="application" status={application.status} audience="club" />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2">
                      {application.resume_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFileUrl(application.resume_url!).catch(() =>
                              toast.error("Could not open resume")
                            );
                          }}
                        >
                          <FileText className="w-4 h-4" />
                          Resume
                        </Button>
                      )}
                      {/* A reviewed application must still be decidable — the old
                          `=== "pending"` gate is the "reviewed status unsettable" bug. */}
                      {!decided && (
                        <>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            className="text-ok hover:bg-ok-wash hover:text-ok"
                            aria-label="Accept application"
                            disabled={isUpdating}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateApplicationStatus(application.id, "accepted");
                            }}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            className="text-bad hover:bg-bad-wash hover:text-bad"
                            aria-label="Decline application"
                            disabled={isUpdating}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateApplicationStatus(application.id, "rejected");
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Application Detail Dialog */}
      <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedApplication && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <EntityAvatar
                    kind="person"
                    name={selectedApplication.student.full_name || selectedApplication.student.email}
                    size="xl"
                  />
                  <div>
                    <DialogTitle className="text-xl">
                      {selectedApplication.student.full_name || selectedApplication.student.email}
                    </DialogTitle>
                    <DialogDescription>
                      Applied for {selectedApplication.opportunity.title}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Applicant Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedApplication.student.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedApplication.student.major || "No major"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedApplication.student.year || "Year not set"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>Applied {format(new Date(selectedApplication.created_at), "MMM d, yyyy")}</span>
                  </div>
                </div>

                {/* Resume Link */}
                {selectedApplication.resume_url && (
                  <div>
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={() =>
                        openFileUrl(selectedApplication.resume_url!).catch(() =>
                          toast.error("Could not open resume")
                        )
                      }
                    >
                      <FileText className="w-4 h-4" />
                      View Resume
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                )}

                {/* Responses */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-ink">Application responses</h4>
                  {selectedApplication.answers.length > 0 ? (
                    selectedApplication.answers.map((response, index) => (
                      <div key={index} className="space-y-2">
                        <p className="text-sm font-medium text-ink">
                          {getQuestionText(response.question_id, selectedApplication.opportunity.application_questions)}
                        </p>
                        <p className="rounded-lg border border-line bg-surface-2 p-3 text-sm text-ink-2">
                          {formatAnswer(response.answer)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-ink-3">No custom responses provided.</p>
                  )}
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-ink">Status</h4>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      domain="application"
                      status={selectedApplication.status}
                      audience="club"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                {selectedApplication.status === "accepted" || selectedApplication.status === "rejected" ? (
                  <Button variant="outline" onClick={() => setSelectedApplication(null)}>
                    Close
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="gap-2 border-bad/40 text-bad hover:bg-bad-wash hover:text-bad"
                      disabled={isUpdating}
                      onClick={() => updateApplicationStatus(selectedApplication.id, "rejected")}
                    >
                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      Decline
                    </Button>
                    <div className="flex gap-2">
                      {/* "Mark as reviewed" — the seen-but-not-decided middle
                          state, previously unreachable from any screen. */}
                      {selectedApplication.status !== "reviewed" && (
                        <Button
                          variant="ghost"
                          disabled={isUpdating}
                          onClick={() => updateApplicationStatus(selectedApplication.id, "reviewed")}
                        >
                          Mark as reviewed
                        </Button>
                      )}
                      <Button
                        variant="success"
                        className="gap-2"
                        disabled={isUpdating}
                        onClick={() => updateApplicationStatus(selectedApplication.id, "accepted")}
                      >
                        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Accept
                      </Button>
                    </div>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
