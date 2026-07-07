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

const statusColors = {
  pending: "accent",
  reviewed: "default",
  accepted: "default",
  rejected: "destructive"
} as const;

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
      const transformedApplications: Application[] = (data || []).map((app: any) => ({
        id: app.id,
        status: app.status || "pending",
        created_at: app.created_at,
        resume_url: app.resume_url,
        answers: app.answers || [],
        opportunity: {
          id: app.opportunity.id,
          title: app.opportunity.title,
          application_questions: app.opportunity.application_questions || []
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

      // Send status update email (non-blocking)
      if (app && (newStatus === "accepted" || newStatus === "rejected")) {
        sendApplicationStatusUpdate(
          app.student.email,
          app.student.full_name || "Applicant",
          app.opportunity.title,
          newStatus
        ).catch(console.error);
      }

      toast.success(`Application ${newStatus}`);
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

      // Send status update emails for accepted/rejected (non-blocking)
      if (newStatus === "accepted" || newStatus === "rejected") {
        const appsToEmail = applications.filter(app => selectedIds.has(app.id));
        appsToEmail.forEach(app => {
          sendApplicationStatusUpdate(
            app.student.email,
            app.student.full_name || "Applicant",
            app.opportunity.title,
            newStatus
          ).catch(console.error);
        });
      }

      // Update local state
      setApplications(prev => 
        prev.map(app => 
          selectedIds.has(app.id) ? { ...app, status: newStatus } : app
        )
      );

      toast.success(`${selectedIds.size} applications ${newStatus}`);
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

  const getInitials = (name: string | null): string => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
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
                  {statusFilter === "all" ? "All Status" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Status</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("pending")}>
                  Pending ({pendingCount})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("reviewed")}>Reviewed</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("accepted")}>Accepted</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("rejected")}>Rejected</DropdownMenuItem>
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
          <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
            <CheckSquare className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-green-600 border-green-600/30 hover:bg-green-600/10"
                disabled={isBulkUpdating}
                onClick={() => handleBulkStatusUpdate("accepted")}
              >
                <Check className="w-3.5 h-3.5" />
                Accept All
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                disabled={isBulkUpdating}
                onClick={() => handleBulkStatusUpdate("rejected")}
              >
                <X className="w-3.5 h-3.5" />
                Reject All
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

      {/* Applications List */}
      <div className="space-y-3">
        {/* Select All Header */}
        {filteredApplications.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-2 text-sm text-muted-foreground">
            <Checkbox
              checked={allSelected}
              onCheckedChange={handleSelectAll}
              aria-label="Select all"
            />
            <span>Select all ({filteredApplications.length})</span>
          </div>
        )}

        {filteredApplications.map((application) => (
          <div 
            key={application.id}
            className="p-5 rounded-xl bg-card border border-border shadow-card hover:shadow-card-hover transition-all"
          >
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* Checkbox */}
              <Checkbox
                checked={selectedIds.has(application.id)}
                onCheckedChange={(checked) => handleSelectOne(application.id, checked as boolean)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select ${application.student.full_name || application.student.email}`}
              />

              {/* Applicant Info */}
              <div 
                className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                onClick={() => setSelectedApplication(application)}
              >
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <span className="text-lg font-semibold text-muted-foreground">
                    {getInitials(application.student.full_name)}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">
                      {application.student.full_name || application.student.email}
                    </h3>
                    <Badge 
                      variant={statusColors[application.status as keyof typeof statusColors] || "default"} 
                      className="capitalize shrink-0"
                    >
                      {application.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {application.student.major || "No major"} • {application.student.year || "Year not set"}
                  </p>
                </div>
              </div>

              {/* Opportunity */}
              <div className="md:w-64 cursor-pointer" onClick={() => setSelectedApplication(application)}>
                <p className="text-sm font-medium text-foreground truncate">{application.opportunity.title}</p>
                <p className="text-xs text-muted-foreground">
                  Applied {format(new Date(application.created_at), "MMM d, yyyy")}
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                {application.resume_url && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(application.resume_url!, "_blank");
                    }}
                  >
                    <FileText className="w-4 h-4" />
                    Resume
                  </Button>
                )}
                {application.status === "pending" && (
                  <>
                    <Button 
                      variant="outline" 
                      size="icon"
                      className="h-8 w-8 text-green-600 hover:bg-green-600/10"
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
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
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
          </div>
        ))}

        {filteredApplications.length === 0 && (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <Inbox className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {applications.length === 0 
                ? "No applications yet. Applications will appear here when students apply to your opportunities."
                : "No applications match your search criteria."
              }
            </p>
          </div>
        )}
      </div>

      {/* Application Detail Dialog */}
      <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedApplication && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
                    <span className="text-xl font-semibold text-muted-foreground">
                      {getInitials(selectedApplication.student.full_name)}
                    </span>
                  </div>
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
                      onClick={() => window.open(selectedApplication.resume_url!, "_blank")}
                    >
                      <FileText className="w-4 h-4" />
                      View Resume
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                )}

                {/* Responses */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground">Application Responses</h4>
                  {selectedApplication.answers.length > 0 ? (
                    selectedApplication.answers.map((response, index) => (
                      <div key={index} className="space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          {getQuestionText(response.question_id, selectedApplication.opportunity.application_questions)}
                        </p>
                        <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                          {formatAnswer(response.answer)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No custom responses provided.</p>
                  )}
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground">Status</h4>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={statusColors[selectedApplication.status as keyof typeof statusColors] || "default"} 
                      className="capitalize"
                    >
                      {selectedApplication.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                {selectedApplication.status === "pending" && (
                  <>
                    <Button 
                      variant="outline" 
                      className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                      disabled={isUpdating}
                      onClick={() => updateApplicationStatus(selectedApplication.id, "rejected")}
                    >
                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      Reject
                    </Button>
                    <Button 
                      className="gap-2"
                      disabled={isUpdating}
                      onClick={() => updateApplicationStatus(selectedApplication.id, "accepted")}
                    >
                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Accept
                    </Button>
                  </>
                )}
                {selectedApplication.status !== "pending" && (
                  <Button variant="outline" onClick={() => setSelectedApplication(null)}>
                    Close
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
