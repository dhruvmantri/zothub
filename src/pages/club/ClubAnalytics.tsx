import { ClubLayout } from "@/components/club/ClubLayout";
import { ClubAnalytics as ClubAnalyticsComponent } from "@/components/dashboard/ClubAnalytics";

export default function ClubAnalytics() {
  return (
    <ClubLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track your club's performance and engagement
          </p>
        </div>

        {/* Analytics Dashboard */}
        <ClubAnalyticsComponent />
      </div>
    </ClubLayout>
  );
}
