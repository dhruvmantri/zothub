import { TopNav } from "@/components/nav/TopNav";
import { STUDENT_NAV } from "@/components/nav/navConfig";
import { useAccountIdentity } from "@/hooks/useAccountIdentity";

interface StudentTopNavProps {
  unreadMessageCount: number;
  notificationCount: number;
}

/** Discover · Clubs · Activity · Messages (Structure §2). */
export function StudentTopNav({ unreadMessageCount, notificationCount }: StudentTopNavProps) {
  const { displayName, subtitle, avatarUrl } = useAccountIdentity();

  return (
    <TopNav
      items={STUDENT_NAV}
      role="student"
      displayName={displayName}
      subtitle={subtitle}
      avatarUrl={avatarUrl}
      counts={{ messages: unreadMessageCount, responses: 0 }}
      notificationCount={notificationCount}
    />
  );
}
