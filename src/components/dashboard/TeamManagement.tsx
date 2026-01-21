import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  MoreHorizontal, 
  Mail, 
  UserCog, 
  Trash2,
  Users,
  Loader2,
  Clock,
  CheckCircle,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";

interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  invited_at: string;
  joined_at: string | null;
  display_order: number | null;
  user_id: string | null;
}

interface TeamManagementProps {
  teamMembers: TeamMember[];
  onAddMember: (email: string, name: string, role: string) => Promise<boolean>;
  onUpdateMember: (id: string, updates: { role?: string; status?: string }) => Promise<boolean>;
  onRemoveMember: (id: string) => Promise<boolean>;
  onSwapOrder: (memberId1: string, order1: number, memberId2: string, order2: number) => Promise<boolean>;
}

const ROLE_SUGGESTIONS = [
  "President",
  "Vice President", 
  "Treasurer",
  "Secretary",
  "Officer",
  "Director",
  "Chair",
  "Member",
];

const statusColors = {
  pending: "secondary",
  active: "success",
  inactive: "muted",
  declined: "destructive",
} as const;

export function TeamManagement({ 
  teamMembers, 
  onAddMember, 
  onUpdateMember, 
  onRemoveMember,
  onSwapOrder,
}: TeamManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  const [memberToEdit, setMemberToEdit] = useState<TeamMember | null>(null);
  const [customRole, setCustomRole] = useState("");
  
  // Form state
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("Member");

  const handleAddMember = async () => {
    if (!email.trim() || !role.trim()) return;
    
    setIsSubmitting(true);
    const success = await onAddMember(email.trim(), name.trim(), role.trim());
    setIsSubmitting(false);
    
    if (success) {
      setIsAddDialogOpen(false);
      setEmail("");
      setName("");
      setRole("Member");
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToDelete) return;
    
    await onRemoveMember(memberToDelete.id);
    setMemberToDelete(null);
  };

  const handleUpdateRole = async () => {
    if (!memberToEdit || !customRole.trim()) return;
    
    setIsSubmitting(true);
    await onUpdateMember(memberToEdit.id, { role: customRole.trim() });
    setIsSubmitting(false);
    setIsRoleDialogOpen(false);
    setMemberToEdit(null);
    setCustomRole("");
  };

  const openRoleDialog = (member: TeamMember) => {
    setMemberToEdit(member);
    setCustomRole(member.role);
    setIsRoleDialogOpen(true);
  };

  const handleMoveUp = async (index: number) => {
    if (index <= 0 || isReordering) return;
    
    const currentMember = teamMembers[index];
    const previousMember = teamMembers[index - 1];
    
    setIsReordering(true);
    await onSwapOrder(
      currentMember.id,
      currentMember.display_order ?? index,
      previousMember.id,
      previousMember.display_order ?? index - 1
    );
    setIsReordering(false);
  };

  const handleMoveDown = async (index: number) => {
    if (index >= teamMembers.length - 1 || isReordering) return;
    
    const currentMember = teamMembers[index];
    const nextMember = teamMembers[index + 1];
    
    setIsReordering(true);
    await onSwapOrder(
      currentMember.id,
      currentMember.display_order ?? index,
      nextMember.id,
      nextMember.display_order ?? index + 1
    );
    setIsReordering(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Team Members</h2>
          <p className="text-sm text-muted-foreground">
            Manage who has access to your club's dashboard
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Invite someone to join your club's team
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="member@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Input
                  id="role"
                  placeholder="e.g., President, VP of Finance, Social Chair"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  list="role-suggestions"
                />
                <datalist id="role-suggestions">
                  {ROLE_SUGGESTIONS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Type a custom role or select from suggestions
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMember} disabled={isSubmitting || !email.trim() || !role.trim()}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Member"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Team Members List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {teamMembers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No team members yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add members to give them access to your club's dashboard
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {teamMembers.map((member, index) => (
              <div 
                key={member.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-secondary/20 transition-colors"
              >
                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0 || isReordering}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === teamMembers.length - 1 || isReordering}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">
                      {member.name || member.email}
                    </p>
                    <Badge 
                      variant={statusColors[member.status as keyof typeof statusColors] || "muted"}
                      className="capitalize"
                    >
                      {member.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                      {member.status === "active" && <CheckCircle className="w-3 h-3 mr-1" />}
                      {member.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      {member.email}
                    </span>
                    <span className="capitalize">
                      {member.role}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Invited {format(new Date(member.invited_at), "MMM d, yyyy")}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={() => openRoleDialog(member)}
                      className="gap-2"
                    >
                      <UserCog className="w-4 h-4" /> Change Role
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setMemberToDelete(member)}
                      className="gap-2 text-destructive"
                    >
                      <Trash2 className="w-4 h-4" /> Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToDelete?.name || memberToDelete?.email} from the team? 
              They will lose access to the club dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Role Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Update the role for {memberToEdit?.name || memberToEdit?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="custom-role">Role</Label>
              <Input
                id="custom-role"
                placeholder="e.g., President, VP of Finance"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                list="role-suggestions-edit"
              />
              <datalist id="role-suggestions-edit">
                {ROLE_SUGGESTIONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRole} disabled={isSubmitting || !customRole.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Role"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
