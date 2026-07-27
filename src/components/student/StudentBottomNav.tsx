import { TabBar } from "@/components/nav/TabBar";
import { STUDENT_NAV } from "@/components/nav/navConfig";

interface StudentBottomNavProps {
  unreadMessageCount?: number;
}

export function StudentBottomNav({ unreadMessageCount = 0 }: StudentBottomNavProps) {
  return <TabBar items={STUDENT_NAV} counts={{ messages: unreadMessageCount, responses: 0 }} />;
}
