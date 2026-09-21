/**
 * Seeds the LOCAL sandbox only (127.0.0.1:54321). Never points anywhere else —
 * the URL is asserted below, because a seed script that could be aimed at
 * production is a seed script that eventually is. The key below is Supabase's
 * published demo service key, identical in every local install; it grants
 * nothing anywhere else.
 *
 * Why this exists: the student journey cannot be walked read-only. Applying,
 * RSVPing and being accepted are writes, and screens N1-N7 have never been seen
 * with data in them. Running them here means the live site is never touched.
 *
 *   sudo dockerd &                     # cloud sessions only
 *   npx supabase start
 *   node scripts/seed_sandbox.mjs
 *   npx vite --host 127.0.0.1 --port 8080
 *
 * Two traps this hit, both worth knowing before you debug them again:
 *
 *  - The E2E suite's fixtures leave rows in `auth.users` with NULL
 *    `confirmation_token`, `created_at` and friends. GoTrue scans those columns
 *    into non-nullable Go types, so EVERY later admin call dies with a generic
 *    500 ("Database error checking email") that names nothing. Repair with
 *    `update auth.users set confirmation_token = coalesce(confirmation_token,''), ...`
 *    rather than deleting anyone.
 *
 *  - Question `type` must be one of `QuestionType` in `src/types/index.ts`
 *    (short_text | long_text | single_choice | multiple_choice). An unknown
 *    value renders a required question with NO input, which looks exactly like
 *    a broken apply form. See UX37.
 */
import { createClient } from "@supabase/supabase-js";

const URL = "http://127.0.0.1:54321";
const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
if (!URL.startsWith("http://127.0.0.1:")) throw new Error("refusing to seed anything that is not localhost");

const db = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const die = (label, error) => { if (error) { console.error(label, error); process.exit(1); } };

async function user(email, password) {
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error && !/already/i.test(error.message)) die(`createUser ${email}`, error);
  if (data?.user) return data.user.id;
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  return list.users.find((u) => u.email === email).id;
}

const PASSWORD = "SandboxOnly123!";
const clubUid = await user("sandboxclub@uci.edu", PASSWORD);
const s1 = await user("sandboxstudent1@uci.edu", PASSWORD);
const s2 = await user("sandboxstudent2@uci.edu", PASSWORD);
const s3 = await user("sandboxstudent3@uci.edu", PASSWORD);

// Roles (the app gates every protected route on these).
for (const [uid, role] of [[clubUid, "club"], [s1, "student"], [s2, "student"], [s3, "student"]]) {
  const { error } = await db.from("user_roles").upsert({ user_id: uid, role }, { onConflict: "user_id,role" });
  if (error && !/duplicate/i.test(error.message)) die("user_roles", error);
}
// Approved waitlist rows, so the guard lets them in.
for (const [uid, email, role] of [[clubUid, "sandboxclub@uci.edu", "club"], [s1, "sandboxstudent1@uci.edu", "student"],
                                  [s2, "sandboxstudent2@uci.edu", "student"], [s3, "sandboxstudent3@uci.edu", "student"]]) {
  await db.from("waitlist").upsert({ user_id: uid, email, role, status: "approved" }, { onConflict: "user_id" });
}

const { data: club, error: ce } = await db.from("club_profiles").upsert({
  user_id: clubUid, email: "sandboxclub@uci.edu", club_name: "Anteater Robotics",
  description: "We build competition robots and run beginner workshops every quarter.",
  category: "Engineering", published: true, claimed_at: new Date().toISOString(),
  website_url: "https://example.test", instagram_url: "https://instagram.com/example",
}, { onConflict: "user_id" }).select("id").single();
die("club_profiles", ce);

const students = [];
for (const [uid, email, full_name, major, year] of [
  [s1, "sandboxstudent1@uci.edu", "Priya Raghunathan", "Computer Science", "Junior"],
  [s2, "sandboxstudent2@uci.edu", "Marcus Webb", "Mechanical Engineering", "Sophomore"],
  [s3, "sandboxstudent3@uci.edu", "Yuki Tanaka", "Informatics", "Senior"],
]) {
  const { data, error } = await db.from("student_profiles").upsert(
    { user_id: uid, email, full_name, major, year }, { onConflict: "user_id" }).select("id").single();
  die("student_profiles", error);
  students.push({ uid, id: data.id, full_name });
}

const day = 86400000;
const { data: opps, error: oe } = await db.from("opportunities").insert([
  { club_id: club.id, title: "Competition Team Lead", type: "leadership",
    description: "Lead our entry into the regional robotics competition. You'll run weekly builds and mentor first-years.",
    requirements: "Any major. Previous team experience helps but is not required.",
    deadline: new Date(Date.now() + 10 * day).toISOString(), is_active: true, show_application_count: true,
    application_questions: [{ id: "q1", question: "What draws you to this role?", type: "textarea", required: true }] },
  { club_id: club.id, title: "Workshop Volunteer", type: "volunteer",
    description: "Help run our beginner soldering workshops. No experience needed — we train you.",
    deadline: null, is_active: true, show_application_count: true, application_questions: [] },
  { club_id: club.id, title: "Sponsorship Coordinator", type: "leadership",
    description: "Reach out to local companies and manage our sponsor relationships.",
    deadline: new Date(Date.now() + 30 * day).toISOString(), is_active: true, show_application_count: false,
    application_questions: [] },
]).select("id, title");
die("opportunities", oe);

const { data: events, error: ee } = await db.from("events").insert([
  { club_id: club.id, title: "Fall Kickoff & Robot Demo", description: "Meet the team, see last year's robot, and find out how to join.",
    event_date: new Date(Date.now() + 5 * day).toISOString(), location: "Engineering Hall 1200",
    capacity: null, is_active: true, requires_approval: false, rsvp_questions: [] },
  { club_id: club.id, title: "Soldering Workshop (limited places)", description: "Hands-on session. Places are limited so we approve RSVPs by hand.",
    event_date: new Date(Date.now() + 12 * day).toISOString(), location: "Makerspace, Building 3",
    capacity: 2, is_active: true, requires_approval: true, rsvp_questions: [] },
]).select("id, title");
die("events", ee);

const lead = opps.find((o) => o.title === "Competition Team Lead");
const volunteer = opps.find((o) => o.title === "Workshop Volunteer");
const { error: ae } = await db.from("applications").insert([
  { opportunity_id: lead.id, student_id: students[1].id, status: "pending",
    answers: [{ question_id: "q1", answer: "I ran my high school's robotics team and want to keep building." }] },
  { opportunity_id: lead.id, student_id: students[2].id, status: "reviewed",
    answers: [{ question_id: "q1", answer: "I want the leadership experience and I like the mentoring part." }] },
  { opportunity_id: volunteer.id, student_id: students[1].id, status: "accepted", answers: [] },
]);
die("applications", ae);

const kickoff = events.find((e) => e.title.startsWith("Fall Kickoff"));
const { error: re } = await db.from("rsvps").insert([
  { event_id: kickoff.id, student_id: students[1].id, status: "confirmed", answers: [] },
  { event_id: kickoff.id, student_id: students[2].id, status: "confirmed", answers: [] },
]);
die("rsvps", re);

await db.from("club_followers").insert([{ club_id: club.id, student_id: students[0].id }]).then(() => {});

console.log(JSON.stringify({
  club: { email: "sandboxclub@uci.edu", id: club.id },
  students: students.map((s) => ({ name: s.full_name, id: s.id })),
  password: PASSWORD,
  opportunities: opps.length, events: events.length,
}, null, 1));
