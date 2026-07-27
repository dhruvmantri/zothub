import { TabBar } from "@/components/nav/TabBar";
import { CLUB_NAV } from "@/components/nav/navConfig";

interface ClubBottomNavProps {
  unreadMessageCount?: number;
  applicationCount?: number;
}

export function ClubBottomNav({ unreadMessageCount = 0, applicationCount = 0 }: ClubBottomNavProps) {
  return <TabBar items={CLUB_NAV} counts={{ messages: unreadMessageCount, responses: applicationCount }} />;
}
