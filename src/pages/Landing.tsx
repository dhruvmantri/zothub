import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { Logo } from "@/components/Logo";
import { 
  ArrowRight, 
  Users, 
  Calendar, 
  Briefcase, 
  Zap,
  Building2,
  GraduationCap,
  Check
} from "lucide-react";

const features = [
  {
    icon: Briefcase,
    title: "Discover Opportunities",
    description: "Find leadership roles, projects, and internships from UCI's vibrant club ecosystem."
  },
  {
    icon: Calendar,
    title: "Never Miss an Event",
    description: "Browse, RSVP, and get reminders for workshops, socials, and more."
  },
  {
    icon: Users,
    title: "Connect with Clubs",
    description: "Message clubs directly and stay updated on their latest activities."
  },
  {
    icon: Zap,
    title: "Track Applications",
    description: "Monitor your application status and get real-time updates."
  }
];

// The fabricated stats block that used to live here ("200+ Active Clubs",
// "10K+ Students") was removed on 2026-07-23. Production has one club, and any
// visitor could disprove the numbers in two clicks by opening /clubs — which
// makes false social proof worse than none during club outreach.
// The brand pass replaces this section with something honest and specific.

export default function Landing() {
  return (
    <RoleBasedLayout>
      {/* Hero Section - Minimal */}
      <section className="min-h-[85vh] flex items-center pt-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-secondary text-sm text-muted-foreground mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Built for UCI Anteaters
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-foreground leading-tight mb-6 tracking-tight">
              Your gateway to{" "}
              <span className="text-primary">campus life</span>
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-10">
              Discover opportunities, connect with clubs, and make the most of your UCI experience. All in one place.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="accent" size="lg" asChild>
                <Link to="/signup">
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/opportunities">Browse Opportunities</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">
              Everything you need to thrive
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              ZotHub brings together all the tools students and clubs need to connect, collaborate, and grow.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature) => (
              <div 
                key={feature.title}
                className="p-6 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-medium text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Clubs & Students Section */}
      <section className="py-20 bg-secondary/50">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* For Students */}
            <div className="p-8 rounded-xl bg-card border border-border">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                <GraduationCap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">
                For Students
              </h3>
              <ul className="space-y-3 mb-8">
                {[
                  "Discover opportunities that match your interests",
                  "Track applications and get status updates",
                  "RSVP to events and get reminders",
                  "Message clubs and build connections"
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-muted-foreground text-sm">
                    <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button asChild>
                <Link to="/signup?role=student">
                  Join as Student
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>

            {/* For Clubs */}
            <div className="p-8 rounded-xl bg-card border border-border">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-6">
                <Building2 className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">
                For Clubs
              </h3>
              <ul className="space-y-3 mb-8">
                {[
                  "Post opportunities and recruit talented members",
                  "Create events and manage RSVPs",
                  "Review applications with ease",
                  "Track engagement with analytics"
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-muted-foreground text-sm">
                    <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button variant="accent" asChild>
                <Link to="/signup?role=club">
                  Register Club
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-4">
              Ready to get involved?
            </h2>
            <p className="text-muted-foreground mb-8">
              Built for UCI. We're onboarding our first clubs now — come in early.
            </p>
            <Button size="lg" asChild>
              <Link to="/signup">
                Create Account
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Logo />
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/opportunities" className="hover:text-foreground transition-colors">
                Opportunities
              </Link>
              <Link to="/events" className="hover:text-foreground transition-colors">
                Events
              </Link>
              <Link to="/clubs" className="hover:text-foreground transition-colors">
                Clubs
              </Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ZotHub. Made for UCI.
            </p>
          </div>
        </div>
      </footer>
    </RoleBasedLayout>
  );
}
