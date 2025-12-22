import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Search, 
  Filter,
  FileText,
  ExternalLink,
  Check,
  X,
  Clock,
  MoreHorizontal,
  User,
  Mail,
  GraduationCap,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Application {
  id: string;
  applicantName: string;
  applicantEmail: string;
  major: string;
  year: string;
  opportunityTitle: string;
  status: "pending" | "reviewed" | "accepted" | "rejected";
  submittedAt: string;
  resumeUrl?: string;
  responses: { question: string; answer: string }[];
}

const mockApplications: Application[] = [
  {
    id: "1",
    applicantName: "Sarah Chen",
    applicantEmail: "schen@uci.edu",
    major: "Computer Science",
    year: "Junior",
    opportunityTitle: "Technical Lead - Web Development",
    status: "pending",
    submittedAt: "Dec 20, 2024",
    resumeUrl: "#",
    responses: [
      { question: "Why are you interested in this role?", answer: "I'm passionate about web development and have been building projects using React and Node.js for the past 2 years. I believe my experience in leading a team project last quarter has prepared me well for this leadership role." },
      { question: "Describe a challenging project you've worked on.", answer: "I developed a full-stack e-commerce platform for a local business. The challenge was implementing real-time inventory management while ensuring the system could handle high traffic during sales events." },
    ]
  },
  {
    id: "2",
    applicantName: "Michael Nguyen",
    applicantEmail: "mnguyen@uci.edu",
    major: "Software Engineering",
    year: "Senior",
    opportunityTitle: "Technical Lead - Web Development",
    status: "pending",
    submittedAt: "Dec 19, 2024",
    resumeUrl: "#",
    responses: [
      { question: "Why are you interested in this role?", answer: "As a senior with internship experience at a tech company, I want to give back to the UCI community by mentoring junior developers while continuing to grow my technical skills." },
      { question: "Describe a challenging project you've worked on.", answer: "During my internship, I worked on migrating a legacy system to a microservices architecture. This required careful planning and coordination with multiple teams." },
    ]
  },
  {
    id: "3",
    applicantName: "Emily Park",
    applicantEmail: "epark@uci.edu",
    major: "Informatics",
    year: "Sophomore",
    opportunityTitle: "Marketing Intern",
    status: "reviewed",
    submittedAt: "Dec 18, 2024",
    resumeUrl: "#",
    responses: [
      { question: "What marketing experience do you have?", answer: "I managed social media for my high school's student council and increased engagement by 150%. I'm also proficient in Canva and Figma." },
      { question: "Share a creative campaign idea.", answer: "A 'Day in the Life' video series featuring different club members would humanize the organization and attract new members through authentic storytelling." },
    ]
  },
  {
    id: "4",
    applicantName: "David Kim",
    applicantEmail: "dkim@uci.edu",
    major: "Business Administration",
    year: "Junior",
    opportunityTitle: "Event Coordinator",
    status: "accepted",
    submittedAt: "Dec 15, 2024",
    resumeUrl: "#",
    responses: [
      { question: "Describe your event planning experience.", answer: "I've organized multiple networking events for the Business Student Association, including our annual career fair with 500+ attendees." },
      { question: "How would you handle a last-minute venue change?", answer: "I would immediately notify all stakeholders, create a backup plan, and ensure clear communication through multiple channels." },
    ]
  },
  {
    id: "5",
    applicantName: "Lisa Wang",
    applicantEmail: "lwang@uci.edu",
    major: "Computer Science",
    year: "Freshman",
    opportunityTitle: "Campus Outreach Volunteer",
    status: "rejected",
    submittedAt: "Dec 14, 2024",
    responses: [
      { question: "Why do you want to volunteer?", answer: "I want to get involved on campus and meet new people while contributing to the tech community." },
      { question: "How many hours can you commit weekly?", answer: "I can commit around 3-4 hours per week." },
    ]
  },
];

const statusColors = {
  pending: "accent",
  reviewed: "default",
  accepted: "success",
  rejected: "destructive"
} as const;

export function ApplicationReview() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);

  const filteredApplications = mockApplications.filter(app => {
    const matchesSearch = 
      app.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.opportunityTitle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = mockApplications.filter(a => a.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
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
      </div>

      {/* Applications List */}
      <div className="space-y-3">
        {filteredApplications.map((application) => (
          <div 
            key={application.id}
            className="p-5 rounded-xl bg-card border border-border shadow-card hover:shadow-card-hover transition-all cursor-pointer"
            onClick={() => setSelectedApplication(application)}
          >
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* Applicant Info */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <span className="text-lg font-semibold text-muted-foreground">
                    {application.applicantName.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">{application.applicantName}</h3>
                    <Badge variant={statusColors[application.status]} className="capitalize shrink-0">
                      {application.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {application.major} • {application.year}
                  </p>
                </div>
              </div>

              {/* Opportunity */}
              <div className="md:w-64">
                <p className="text-sm font-medium text-foreground truncate">{application.opportunityTitle}</p>
                <p className="text-xs text-muted-foreground">Applied {application.submittedAt}</p>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                {application.resumeUrl && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Open resume
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
                      className="h-8 w-8 text-success hover:bg-success/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Accept
                      }}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Reject
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
            <p className="text-muted-foreground">No applications found</p>
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
                      {selectedApplication.applicantName.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <DialogTitle className="text-xl">{selectedApplication.applicantName}</DialogTitle>
                    <DialogDescription>
                      Applied for {selectedApplication.opportunityTitle}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Applicant Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedApplication.applicantEmail}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedApplication.major}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedApplication.year}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>Applied {selectedApplication.submittedAt}</span>
                  </div>
                </div>

                {/* Resume Link */}
                {selectedApplication.resumeUrl && (
                  <div>
                    <Button variant="outline" className="gap-2">
                      <FileText className="w-4 h-4" />
                      View Resume
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                )}

                {/* Responses */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground">Application Responses</h4>
                  {selectedApplication.responses.map((response, index) => (
                    <div key={index} className="space-y-2">
                      <p className="text-sm font-medium text-foreground">{response.question}</p>
                      <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                        {response.answer}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Status and Notes */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground">Status</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusColors[selectedApplication.status]} className="capitalize">
                      {selectedApplication.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                {selectedApplication.status === "pending" && (
                  <>
                    <Button variant="outline" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
                      <X className="w-4 h-4" />
                      Reject
                    </Button>
                    <Button className="gap-2">
                      <Check className="w-4 h-4" />
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
