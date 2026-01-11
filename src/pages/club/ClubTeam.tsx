import { ClubLayout } from "@/components/club/ClubLayout";
import { TeamManagement } from "@/components/dashboard/TeamManagement";
import { useClubData } from "@/hooks/useClubData";

export default function ClubTeam() {
  const {
    teamMembers,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
  } = useClubData();

  return (
    <ClubLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Team</h1>
          <p className="text-muted-foreground mt-1">
            Manage your club's team members and permissions
          </p>
        </div>

        {/* Team Management */}
        <TeamManagement 
          teamMembers={teamMembers}
          onAddMember={addTeamMember}
          onUpdateMember={updateTeamMember}
          onRemoveMember={removeTeamMember}
        />
      </div>
    </ClubLayout>
  );
}
