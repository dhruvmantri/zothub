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
  const { displayName, subtitle, avatarUrl } = useAccountIdentity();

  return (
    <TopNav
      items={CLUB_NAV}
      role="club"
      displayName={displayName}
      subtitle={subtitle}
      avatarUrl={avatarUrl}
      counts={{ messages: unreadMessageCount, responses: applicationCount }}
      notificationCount={notificationCount}
    />
  );
}
