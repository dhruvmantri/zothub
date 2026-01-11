import { ClubLayout } from "@/components/club/ClubLayout";
import { ApplicationReview } from "@/components/dashboard/ApplicationReview";

export default function ClubApplications() {
  return (
    <ClubLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Applications</h1>
          <p className="text-muted-foreground mt-1">
            Review and manage applications to your opportunities
          </p>
        </div>

        {/* Application Review */}
        <ApplicationReview />
      </div>
    </ClubLayout>
  );
}
