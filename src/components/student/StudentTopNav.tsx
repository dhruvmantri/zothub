import { TopNav } from "@/components/nav/TopNav";
import { STUDENT_NAV } from "@/components/nav/navConfig";
import { useAccountIdentity } from "@/hooks/useAccountIdentity";

interface StudentTopNavProps {
  unreadMessageCount: number;
  notificationCount: number;
}

/** Discover · Clubs · Activity · Messages (Structure §2). */
export function StudentTopNav({ unreadMessageCount, notificationCount }: StudentTopNavProps) {
  // isLoading is destructured deliberately: dropping it is exactly what made the
  // avatar flash the email-derived initials on every route change (UX7).
  const { displayName, subtitle, avatarUrl, isLoading } = useAccountIdentity();

  return (
    <TopNav
      items={STUDENT_NAV}
      role="student"
      displayName={displayName}
      subtitle={subtitle}
      avatarUrl={avatarUrl}
      isLoading={isLoading}
      counts={{ messages: unreadMessageCount, responses: 0 }}
      notificationCount={notificationCount}
    />
  );
}
