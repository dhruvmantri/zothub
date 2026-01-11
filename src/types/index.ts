/**
 * Shared TypeScript types used across the application.
 * Import from "@/types" to use these types.
 */

// ============= Core Entity Types =============

export interface ClubProfile {
  id: string;
  club_name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  discord_url: string | null;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  major: string | null;
  year: string | null;
  graduation_date: string | null;
  skills: string[] | null;
  interests: string[] | null;
  avatar_url: string | null;
  resume_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Opportunity {
  id: string;
  title: string;
  type: string;
  description: string | null;
  requirements: string | null;
  deadline: string | null;
  club_id: string;
  is_active: boolean;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  capacity: number | null;
  banner_url: string | null;
  club_id: string;
  is_active: boolean;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  student_id: string;
  opportunity_id: string;
  status: string;
  answers: Record<string, unknown> | null;
  resume_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  opportunity_id: string | null;
  event_id: string | null;
  club_id: string | null;
  created_at: string;
}

// ============= Extended Types (with relations) =============

export interface OpportunityWithClub extends Opportunity {
  club_profiles: {
    club_name: string;
    logo_url: string | null;
  };
  applications?: { id: string }[];
}

export interface EventWithClub extends Event {
  club_profiles: {
    club_name: string;
    logo_url: string | null;
  };
  rsvps?: { id: string }[];
}

export interface ClubWithCounts extends ClubProfile {
  opportunity_count: number;
  event_count: number;
}

// ============= UI Types =============

export type OpportunityType = "leadership" | "project" | "internship" | "volunteer" | "committee" | "other";

export type ApplicationStatus = "pending" | "reviewed" | "accepted" | "rejected";

export type UserRole = "student" | "club";

// ============= Feed Types =============

export interface FeedItem {
  type: "opportunity" | "event";
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  club_id: string;
  club_name: string;
  club_logo: string | null;
  // Opportunity specific
  deadline?: string | null;
  opportunity_type?: string;
  // Event specific
  event_date?: string;
  location?: string | null;
}

// ============= Messaging Types =============

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isClub: boolean;
}

// ============= Notification Types =============

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  related_id: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  application_updates: boolean;
  event_reminders: boolean;
  new_messages: boolean;
  deadline_reminders: boolean;
}
