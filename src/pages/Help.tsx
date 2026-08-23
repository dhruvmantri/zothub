import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { Link } from "react-router-dom";
import { ArrowLeft, GraduationCap, Users, ShieldQuestion, Mail, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * /help — the Support surface (backlog MB4).
 *
 * Why it exists: four places in the product already tell people to "contact
 * support" with nowhere to go — WaitlistRejected.tsx, TurnstileWidget.tsx (the
 * fail-closed path, i.e. exactly when a user is most stuck), the claim emails in
 * send-email, and the privacy policy's manual deletion/data route (the only route,
 * now that self-service deletion is post-launch). Foundation §Principles rule 1 —
 * "never a dead end, no message names a problem without offering the remedy" —
 * makes each of those a violation, not a backlog item.
 *
 * Scope (maintainer decision 2026-08-23): one static page. FAQ + contact + report.
 * No ticket table, no new email path, no spam surface.
 *
 * Shell deliberately mirrors Privacy.tsx (header band → max-w-3xl sectioned
 * column) because "consistent beats clever" is Foundation rule 4. Accent usage
 * follows design-system.md §1: --accent-wash for chip fills and --accent-text for
 * accent-as-text, which are the AA-measured pairs. (Privacy.tsx still uses the
 * older bg-primary/10 approximation; retrofitting it is logged, not done here.)
 */

interface QA {
  q: string;
  a: React.ReactNode;
}

const STUDENT_FAQ: QA[] = [
  {
    q: "Who can use ZotHub?",
    a: (
      <>
        Any UCI student with an <strong className="text-foreground">@uci.edu</strong> email. You
        verify your email with a one-time code and you're in straight away — there's no waiting
        list for students.
      </>
    ),
  },
  {
    q: "Do I need an account to look around?",
    a: (
      <>
        No. You can browse clubs, roles and events without signing in. You'll need an account to
        apply, RSVP, save something, follow a club, or message anyone.{" "}
        <Link to="/clubs" className="text-accent-text underline underline-offset-2 hover:no-underline">
          Browse clubs
        </Link>
        .
      </>
    ),
  },
  {
    q: "How do I apply for something?",
    a: (
      <>
        Open the role you're interested in and choose Apply. Some clubs add their own questions,
        and you can attach a resume — if your profile already has one, it's filled in for you.
      </>
    ),
  },
  {
    q: "How do I know whether I got in?",
    a: (
      <>
        Every application's current status lives in Activity, and you get a notification — in the
        app and by email — each time a club changes it. You're never left guessing.
      </>
    ),
  },
  {
    q: "I'm not getting emails from ZotHub.",
    a: (
      <>
        Our emails come from <strong className="text-foreground">notifications@zothub.app</strong>.
        Check your spam or Promotions folder and mark one as "not spam" so the rest arrive. If
        they're still missing, email us below and we'll look into it.
      </>
    ),
  },
  {
    q: "How do I get fewer emails?",
    a: (
      <>
        Every email has an unsubscribe link for that specific kind of message, and you can switch
        each type on or off in your notification settings. Turning them all off never affects your
        applications — you'll still see everything in the app.
      </>
    ),
  },
];

const CLUB_FAQ: QA[] = [
  {
    q: "How do I get my club onto ZotHub?",
    a: (
      <>
        Two ways. Most UCI clubs are already listed — find yours and claim it, which keeps the
        listing and its history. If it isn't listed, sign your club up from scratch. Either way a
        person reviews it before it goes live.
      </>
    ),
  },
  {
    q: "What happens after I sign up or claim my club?",
    a: (
      <>
        A person reviews it before it goes live — we check claims by hand so a club's listing and
        its applicants don't end up with the wrong people. You'll get an email either way. If yours
        has been waiting and you'd like an update, just ask us below and we'll tell you where it is.
      </>
    ),
  },
  {
    q: "My club is listed but I didn't put it there.",
    a: (
      <>
        Those listings come from UCI's public club directory, so your club may appear before anyone
        from it has joined. Claiming it makes it yours. If you'd rather it weren't listed at all,
        email us and we'll take it down.
      </>
    ),
  },
  {
    q: "Someone else claimed our club.",
    a: (
      <>
        Email us and we'll sort it out. Every claim is reviewed by a person and recorded, so we can
        see who claimed what and when, and move it to the right officer.
      </>
    ),
  },
  {
    q: "Do we have to move our whole recruiting process over?",
    a: (
      <>
        No. You can post a role that simply points at the Google Form you already use, and stop
        there. The application forms, review tools and analytics are here when you want them, not a
        condition of listing.
      </>
    ),
  },
  {
    q: "Why can't I see my club on the public site yet?",
    a: (
      <>
        A club stays hidden from the public directory until it's approved. Once it is, your profile
        and anything you've posted appear together.
      </>
    ),
  },
];

const ACCOUNT_FAQ: QA[] = [
  {
    q: "How do I delete my account or get a copy of my data?",
    a: (
      <>
        Email us below and we'll take care of it — we handle these by hand at the moment. Note that
        applications you've already sent stay with the club that received them, since those are
        their own records.
      </>
    ),
  },
  {
    q: "I can't log in.",
    a: (
      <>
        Use{" "}
        <Link
          to="/forgot-password"
          className="text-accent-text underline underline-offset-2 hover:no-underline"
        >
          Forgot password
        </Link>{" "}
        to set a new one. If you signed up with Google, sign in with Google rather than a password.
      </>
    ),
  },
  {
    q: "My club doesn't have a @uci.edu email.",
    a: (
      <>
        That's fine — clubs can sign up with any email address. Only students are required to use an
        @uci.edu address, because that's how we confirm they're at UCI.
      </>
    ),
  },
  {
    q: "What do you do with my data?",
    a: (
      <>
        Our{" "}
        <Link to="/privacy" className="text-accent-text underline underline-offset-2 hover:no-underline">
          privacy policy
        </Link>{" "}
        sets out exactly what we collect, who processes it, and what a club can see when you apply.
      </>
    ),
  },
];

const SUPPORT_EMAIL = "zothub.uci@gmail.com";

// Pre-filled so a report arrives with something we can act on. Encoded rather
// than interpolated so a newline never breaks the mailto.
const REPORT_MAILTO =
  `mailto:${SUPPORT_EMAIL}` +
  `?subject=${encodeURIComponent("ZotHub — problem report")}` +
  `&body=${encodeURIComponent(
    "What happened:\n\n\nWhat you expected instead:\n\n\nWhich page you were on:\n\n\n",
  )}`;

function FaqSection({
  id,
  icon: Icon,
  title,
  items,
}: {
  id: string;
  icon: typeof GraduationCap;
  title: string;
  items: QA[];
}) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-accent-wash flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-accent-text" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      </div>
      <Accordion type="single" collapsible className="w-full">
        {items.map((item, i) => (
          <AccordionItem key={item.q} value={`${id}-${i}`}>
            <AccordionTrigger className="text-left text-foreground">{item.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export default function Help() {
  return (
    <RoleBasedLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="bg-secondary/50 border-b border-border">
          <div className="container mx-auto px-4 py-12">
            <Button variant="ghost" size="sm" asChild className="mb-4">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Help &amp; Support
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Answers to the things people ask most. If yours isn't here, a real person reads the
              support inbox — just email us.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto space-y-12">
            <FaqSection id="student" icon={GraduationCap} title="For students" items={STUDENT_FAQ} />
            <FaqSection id="club" icon={Users} title="For clubs" items={CLUB_FAQ} />
            <FaqSection
              id="account"
              icon={ShieldQuestion}
              title="Accounts &amp; privacy"
              items={ACCOUNT_FAQ}
            />

            {/* Contact — the page must never dead-end (Foundation rule 1). */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-accent-wash flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-accent-text" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Still stuck?</h2>
              </div>
              <div className="p-6 rounded-lg bg-card border border-border space-y-4">
                <p className="text-muted-foreground">
                  Email us and we'll get back to you. ZotHub is run by students at UCI, so replies
                  come from a person, not a ticket system.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button asChild>
                    <a href={`mailto:${SUPPORT_EMAIL}`}>
                      <Mail className="w-4 h-4 mr-2" />
                      Email support
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={REPORT_MAILTO}>
                      <Bug className="w-4 h-4 mr-2" />
                      Report a problem
                    </a>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Or write to us directly at{" "}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="text-accent-text underline underline-offset-2 hover:no-underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                  .
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </RoleBasedLayout>
  );
}
