import { useState, useMemo } from "react";
import { useWaitlistAdmin } from "@/hooks/useWaitlist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PageLoader } from "@/components/ui/page-loader";
import { Check, X, Trash2, RefreshCw, Users, Clock, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { ClubClaimsPanel } from "@/components/admin/ClubClaimsPanel";

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const { entries, isLoading, refetch, approveUser, rejectUser, deleteEntry } = useWaitlistAdmin();
  const { toast } = useToast();
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<{ userId: string; email: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
      const matchesRole = roleFilter === "all" || entry.role === roleFilter;
      const matchesSearch = 
        entry.email.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesRole && matchesSearch;
    });
  }, [entries, statusFilter, roleFilter, searchQuery]);

  const stats = useMemo(() => ({
    total: entries.length,
    pending: entries.filter(e => e.status === "pending").length,
    approved: entries.filter(e => e.status === "approved").length,
    rejected: entries.filter(e => e.status === "rejected").length,
  }), [entries]);

  const handleApprove = async (userId: string, email: string, role: "student" | "club") => {
    setIsProcessing(true);
    const result = await approveUser(userId, email, role);
    setIsProcessing(false);

    if (result.success) {
      // Only claim they were notified when the email actually went out.
      toast({
        title: result.emailSent ? "User Approved" : "Approved — email NOT sent",
        description: result.emailSent
          ? `${email} has been approved and notified.`
          : `${email} has been approved, but the notification email failed${result.emailError ? `: ${result.emailError}` : ""}.`,
        variant: result.emailSent ? undefined : "destructive",
      });
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to approve user.",
        variant: "destructive",
      });
    }
  };

  const handleRejectClick = (userId: string, email: string) => {
    setSelectedEntry({ userId, email });
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedEntry) return;

    setIsProcessing(true);
    const result = await rejectUser(selectedEntry.userId, selectedEntry.email, rejectionReason);
    setIsProcessing(false);
    setRejectDialogOpen(false);

    if (result.success) {
      toast({
        title: result.emailSent ? "User Rejected" : "Rejected — email NOT sent",
        description: result.emailSent
          ? `${selectedEntry.email} has been rejected and notified.`
          : `${selectedEntry.email} has been rejected, but the notification email failed${result.emailError ? `: ${result.emailError}` : ""}.`,
        variant: result.emailSent ? undefined : "destructive",
      });
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to reject user.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete the entry for ${email}?`)) return;

    const result = await deleteEntry(userId);

    if (result.success) {
      toast({
        title: "Entry Deleted",
        description: "Waitlist entry has been removed.",
      });
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to delete entry.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) =>
    status ? <StatusBadge domain="waitlist" status={status} /> : <Badge variant="outline">Unknown</Badge>;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <PageLoader size="md" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo />
            <Badge variant="secondary">Admin</Badge>
          </div>
          <Button variant="outline" onClick={() => signOut()}>
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Waitlist Management</h1>
          <p className="text-muted-foreground mt-1">
            Review and manage signup requests
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
              <p className="text-sm text-muted-foreground">Total Signups</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-warn" />
                <span className="font-data text-2xl font-semibold text-ink">{stats.pending}</span>
              </div>
              <p className="text-sm text-ink-2">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-ok" />
                <span className="font-data text-2xl font-semibold text-ink">{stats.approved}</span>
              </div>
              <p className="text-sm text-ink-2">Approved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-bad" />
                <span className="font-data text-2xl font-semibold text-ink">{stats.rejected}</span>
              </div>
              <p className="text-sm text-ink-2">Rejected</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                placeholder="Search by email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sm:max-w-xs"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="sm:w-[150px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="club">Club</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => refetch()} className="sm:ml-auto">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Signups ({filteredEntries.length})</CardTitle>
            <CardDescription>
              Click Approve or Reject to process each signup
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No entries match your filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {entry.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(entry.status || "pending")}</TableCell>
                        <TableCell>
                          {new Date(entry.requested_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {entry.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-ok/40 text-ok hover:bg-ok-wash hover:text-ok"
                                  aria-label={`Approve ${entry.email}`}
                                  onClick={() => handleApprove(entry.user_id, entry.email, entry.role as "student" | "club")}
                                  disabled={isProcessing}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-bad/40 text-bad hover:bg-bad-wash hover:text-bad"
                                  aria-label={`Reject ${entry.email}`}
                                  onClick={() => handleRejectClick(entry.user_id, entry.email)}
                                  disabled={isProcessing}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-ink-3 hover:bg-bad-wash hover:text-bad"
                              aria-label={`Delete ${entry.email}`}
                              onClick={() => handleDelete(entry.user_id, entry.email)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <ClubClaimsPanel />
      </main>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Signup</DialogTitle>
            <DialogDescription>
              Optionally provide a reason for rejection. This will be sent to the user via email.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection (optional)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={isProcessing}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
