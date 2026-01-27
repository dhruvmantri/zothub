/**
 * Shared TypeScript types used across the application.
 * Import from "@/types" to use these types.
 */

// ============= Question Types (Shared by Applications & RSVPs) =============

export type QuestionType = "short_text" | "long_text" | "single_choice" | "multiple_choice";

/**
 * Base question structure used in application and RSVP forms.
 * Used by: ApplicationQuestionsBuilder, ApplicationForm, RSVPForm, OpportunityDetail, EventDetail
 */
export interface FormQuestion {
  id: string;
  type: QuestionType;
  question: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

/** @deprecated Use FormQuestion instead */
export type ApplicationQuestion = FormQuestion;

/** @deprecated Use FormQuestion instead */
export type RSVPQuestion = FormQuestion;

/**
 * Answer structure for form submissions (applications and RSVPs).
 */
export interface FormAnswer {
  question_id: string;
  question: string;
  answer: string | string[];
}

/** @deprecated Use FormAnswer instead */
export type ApplicationAnswer = FormAnswer;

/** @deprecated Use FormAnswer instead */
export type RSVPAnswer = FormAnswer;

// ============= Core Entity Types =============

export interface ClubProfile {
  id: string;
  user_id?: string;
  club_name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  discord_url: string | null;
  email?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  major: string | null;
  year: string | null;
  graduation_date?: string | null;
  skills?: string[] | null;
  interests?: string[] | null;
  avatar_url?: string | null;
  resume_url?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Opportunity {
  id: string;
  title: string;
  type: string;
  description: string | null;
  requirements?: string | null;
  deadline: string | null;
  club_id?: string;
  is_active?: boolean;
  views?: number;
  application_questions?: FormQuestion[] | null;
  show_application_count?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  capacity?: number | null;
  banner_url?: string | null;
  club_id?: string;
  is_active?: boolean;
  views?: number;
  rsvp_questions?: FormQuestion[] | null;
  requires_approval?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export interface Application {
  id: string;
  student_id?: string;
  opportunity_id?: string;
  status: string;
  answers?: FormAnswer[] | Record<string, unknown> | null;
  resume_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RSVP {
  id: string;
  student_id?: string;
  event_id?: string;
  status: string;
  answers?: FormAnswer[] | null;
  created_at?: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  opportunity_id?: string | null;
  event_id?: string | null;
  club_id?: string | null;
  created_at?: string;
}

export interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  invited_at: string;
  joined_at: string | null;
  display_order: number | null;
  user_id: string | null;
}

// ============= Extended Types (with relations) =============

export interface OpportunityWithClub extends Opportunity {
  club_profiles: {
    id?: string;
    club_name: string;
    logo_url: string | null;
    description?: string | null;
    website_url?: string | null;
  };
  applications?: { id: string }[];
}

export interface EventWithClub extends Event {
  club_profiles: {
    id?: string;
    club_name: string;
    logo_url: string | null;
  };
  rsvps?: { id: string; student_id?: string; status?: string | null }[];
}

export interface ClubWithCounts extends ClubProfile {
  opportunity_count: number;
  event_count: number;
}

// ============= Dashboard Types =============

export interface DashboardOpportunity {
  id: string;
  title: string;
  type: string;
  description: string | null;
  requirements?: string | null;
  deadline: string | null;
  is_active?: boolean;
  views?: number;
  show_application_count?: boolean;
  created_at?: string;
  applications_count: number;
}

export interface DashboardEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  capacity?: number | null;
  banner_url?: string | null;
  is_active?: boolean;
  views?: number;
  requires_approval?: boolean | null;
  created_at?: string;
  rsvps_count: number;
}

// ============= Review Types (ApplicationReview & RSVPReview) =============

export interface ApplicationForReview {
  id: string;
  status: string;
  created_at: string;
  resume_url: string | null;
  answers: FormAnswer[];
  opportunity: {
    id: string;
    title: string;
    application_questions: FormQuestion[];
  };
  student: {
    id: string;
    full_name: string | null;
    email: string;
    major: string | null;
    year: string | null;
  };
}

export interface RSVPForReview {
  id: string;
  status: string;
  created_at: string;
  answers: FormAnswer[];
  event: {
    id: string;
    title: string;
    event_date: string;
    location: string | null;
    rsvp_questions: FormQuestion[];
    requires_approval: boolean;
    club_profiles: {
      club_name: string;
    };
  };
  student: {
    id: string;
    full_name: string | null;
    email: string;
    major: string | null;
    year: string | null;
  };
}

// ============= Form Props Types =============

export interface OpportunityForForm {
  id: string;
  title: string;
  club_profiles: {
    club_name: string;
  };
}

export interface EventForForm {
  id: string;
  title: string;
  event_date?: string;
  location?: string | null;
  requires_approval?: boolean;
  club_profiles: {
    club_name: string;
  };
}

// ============= UI Types =============

export type OpportunityType = "leadership" | "project" | "internship" | "volunteer" | "committee" | "other";

export type ApplicationStatus = "pending" | "reviewed" | "accepted" | "rejected";

export type RSVPStatus = "pending" | "confirmed" | "cancelled";

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

export interface FollowedClub {
  id: string;
  club_name: string;
  logo_url: string | null;
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

// ============= Student Dashboard Types =============

export interface StudentApplicationData {
  id: string;
  status: string;
  created_at: string;
  opportunity: {
    title: string;
    club: {
      club_name: string;
    };
  };
}

export interface StudentRSVPData {
  id: string;
  event: {
    id: string;
    title: string;
    event_date: string;
    club: {
      club_name: string;
    };
  };
}

export interface BookmarkedOpportunity {
  id: string;
  title: string;
  deadline: string | null;
  club: { club_name: string };
}

export interface BookmarkedEvent {
  id: string;
  title: string;
  event_date: string;
  club: { club_name: string };
}
