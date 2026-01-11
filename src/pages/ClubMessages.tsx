import { ClubLayout } from "@/components/club/ClubLayout";
import { MessagesContainer } from "@/components/messaging/MessagesContainer";

export default function ClubMessages() {
  return (
    <ClubLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground mt-1">
            Communicate with students interested in your opportunities
          </p>
        </div>
        
        <MessagesContainer className="h-[calc(100vh-280px)] min-h-[500px]" />
      </div>
    </ClubLayout>
  );
}
