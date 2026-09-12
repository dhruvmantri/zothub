import { TopNav } from "@/components/nav/TopNav";
import { CLUB_NAV } from "@/components/nav/navConfig";
import { useAccountIdentity } from "@/hooks/useAccountIdentity";

interface ClubTopNavProps {
  unreadMessageCount: number;
  notificationCount: number;
  /** Pending applications + pending RSVPs — the work waiting in Responses. */
  applicationCount: number;
}

/** Postings · Responses · Messages · My Club (Structure §5). */
export function ClubTopNav({ unreadMessageCount, notificationCount, applicationCount }: ClubTopNavProps) {
  // isLoading is destructured deliberately: dropping it is exactly what made the
  // avatar flash the email-derived initials on every route change (UX7).
  const { displayName, subtitle, avatarUrl, isLoading } = useAccountIdentity();

  return (
    <TopNav
      items={CLUB_NAV}
      role="club"
      displayName={displayName}
      subtitle={subtitle}
      avatarUrl={avatarUrl}
      isLoading={isLoading}
      counts={{ messages: unreadMessageCount, responses: applicationCount }}
      notificationCount={notificationCount}
    />
  );
}
