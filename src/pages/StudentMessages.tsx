import { MessagesContainer } from "@/components/messaging/MessagesContainer";
import { StudentLayout } from "@/components/student/StudentLayout";

export default function StudentMessages() {
  return (
    <StudentLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">Messages</h1>
          <p className="text-ink-2 mt-1">
            Communicate with clubs about opportunities and events
          </p>
        </div>
        
        <MessagesContainer className="h-[calc(100vh-280px)] min-h-[500px]" />
      </div>
    </StudentLayout>
  );
}
