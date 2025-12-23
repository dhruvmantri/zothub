import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MessagesContainer } from "@/components/messaging/MessagesContainer";

export default function ClubMessages() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground mt-1">
            Communicate with students interested in your opportunities
          </p>
        </div>
        
        <MessagesContainer className="h-[calc(100vh-220px)] min-h-[500px]" />
      </div>
    </DashboardLayout>
  );
}
