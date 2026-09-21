import { useAuth } from "@/contexts/AuthContext";
import ClubMessages from "@/pages/ClubMessages";
import StudentMessages from "@/pages/StudentMessages";

/**
 * One address, `/messages`, for both inboxes.
 *
 * Students and clubs have genuinely different message pages, but nobody needs
 * the word "student" or "club" in their own address bar — they know which
 * account they signed up for (maintainer decision, 2026-09-21, UX8). The role
 * picks the page; the URL stays the same for everyone, which is also what lets
 * the nav's Messages icon be a single path rather than a per-role lookup.
 *
 * `role` is null only while auth is still resolving, and ProtectedRoute holds
 * the render until it is not — so there is no third case to design for.
 */
export default function Messages() {
  const { role } = useAuth();
  return role === "club" ? <ClubMessages /> : <StudentMessages />;
}
