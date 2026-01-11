import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SmartLayout } from "@/components/SmartLayout";
import { 
  ArrowRight, 
  Users, 
  Calendar, 
  Briefcase, 
  Zap,
  Building2,
  GraduationCap,
  MessageSquare,
  Bell
} from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

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

const stats = [
  { value: "200+", label: "Active Clubs" },
  { value: "1,500+", label: "Opportunities" },
  { value: "10K+", label: "Students" },
  { value: "500+", label: "Events Monthly" },
];

export default function Landing() {
  return (
    <SmartLayout>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-hero">
        {/* Background Pattern */}
        <div className="absolute inset-0 z-0 opacity-30">
          <img 
            src={heroBg} 
            alt="" 
            className="w-full h-full object-cover"
          />
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 backdrop-blur-sm text-sm font-medium text-primary-foreground mb-6 animate-fade-up" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              Built for UCI Anteaters
            </div>
            
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-primary-foreground leading-tight mb-6 animate-fade-up" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
              Your gateway to{" "}
              <span className="text-gradient">campus life</span>
            </h1>
            
            <p className="text-lg md:text-xl text-primary-foreground/80 max-w-xl mb-8 animate-fade-up" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
              Discover opportunities, connect with clubs, and make the most of your UCI experience. All in one place.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-up" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
              <Button variant="accent" size="xl" asChild>
                <Link to="/signup">
                  Get Started
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button variant="glass" size="xl" asChild>
                <Link to="/opportunities">Browse Opportunities</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10" />
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div 
                key={stat.label} 
                className="text-center animate-fade-up opacity-0"
                style={{ animationDelay: `${0.1 * index}s`, animationFillMode: 'forwards' }}
              >
                <div className="font-display text-4xl md:text-5xl font-bold text-foreground mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything you need to thrive
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              ZotHub brings together all the tools students and clubs need to connect, collaborate, and grow.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className="group p-6 rounded-2xl bg-card shadow-card hover:shadow-card-hover transition-all duration-300 border border-border/50"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4 group-hover:bg-accent/10 transition-colors">
                  <feature.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
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
      <section className="py-24 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* For Students */}
            <div className="p-8 rounded-3xl bg-card shadow-card border border-border/50">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
                <GraduationCap className="w-7 h-7 text-accent" />
              </div>
              <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                For Students
              </h3>
              <ul className="space-y-4 mb-8">
                {[
                  "Discover opportunities that match your interests",
                  "Track applications and get status updates",
                  "RSVP to events and get reminders",
                  "Message clubs and build connections"
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-muted-foreground">
                    <div className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-success" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Button variant="hero" asChild>
                <Link to="/signup?role=student">
                  Join as Student
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>

            {/* For Clubs */}
            <div className="p-8 rounded-3xl bg-card shadow-card border border-border/50">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
                <Building2 className="w-7 h-7 text-accent" />
              </div>
              <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                For Clubs
              </h3>
              <ul className="space-y-4 mb-8">
                {[
                  "Post opportunities and recruit talented members",
                  "Create events and manage RSVPs",
                  "Review applications with ease",
                  "Track engagement with analytics"
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-muted-foreground">
                    <div className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-success" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Button variant="hero" asChild>
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
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden rounded-3xl bg-hero p-12 md:p-16 text-center">
            <div className="relative z-10">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Ready to get involved?
              </h2>
              <p className="text-lg text-primary-foreground/80 max-w-xl mx-auto mb-8">
                Join thousands of UCI students and clubs already using ZotHub to connect and grow.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="glass" size="xl" asChild>
                  <Link to="/signup">
                    Create Account
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </Button>
              </div>
            </div>
            {/* Decorative gradient orbs */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 rounded-full blur-2xl" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-lg text-foreground">
                Zot<span className="text-accent">Hub</span>
              </span>
            </div>
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
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ZotHub. Made for UCI.
            </p>
          </div>
        </div>
      </footer>
    </SmartLayout>
  );
}
