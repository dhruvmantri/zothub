import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Database, Share2, Clock, Mail, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
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
              Privacy Policy
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Last updated: January 21, 2026
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto space-y-12">
            {/* Introduction */}
            <section>
              <p className="text-muted-foreground leading-relaxed">
                ZotHub ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform. By using ZotHub, you consent to the data practices described in this policy.
              </p>
            </section>

            {/* Data We Collect */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Information We Collect</h2>
              </div>
              <div className="space-y-4 text-muted-foreground">
                <p><strong className="text-foreground">Account Information:</strong> When you create an account, we collect your email address, name, and role (student or club). For students, we may also collect major, graduation year, skills, and interests. For clubs, we collect organization name, description, and category.</p>
                <p><strong className="text-foreground">Profile Data:</strong> Information you choose to add to your profile, including resume links, portfolio URLs, social media handles, and profile photos.</p>
                <p><strong className="text-foreground">Application Data:</strong> Responses you submit when applying to opportunities or RSVPing to events, including custom form responses.</p>
                <p><strong className="text-foreground">Usage Data:</strong> Information about how you interact with ZotHub, including pages visited, features used, and actions taken.</p>
                <p><strong className="text-foreground">Communications:</strong> Messages sent through our platform between students and clubs.</p>
              </div>
            </section>

            {/* How We Use Data */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">How We Use Your Information</h2>
              </div>
              <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                <li>To provide and maintain the ZotHub platform</li>
                <li>To process applications and RSVPs</li>
                <li>To facilitate communication between students and clubs</li>
                <li>To send transactional emails (application confirmations, status updates, event reminders)</li>
                <li>To send optional notifications based on your preferences</li>
                <li>To improve our services and develop new features</li>
                <li>To detect and prevent fraud or abuse</li>
              </ul>
            </section>

            {/* Data Sharing */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Information Sharing</h2>
              </div>
              <div className="space-y-4 text-muted-foreground">
                <p><strong className="text-foreground">With Clubs:</strong> When you apply to an opportunity or RSVP to an event, the hosting club receives your application data and relevant profile information.</p>
                <p><strong className="text-foreground">With Students:</strong> Clubs' public profiles and posted opportunities/events are visible to all users.</p>
                <p><strong className="text-foreground">Service Providers:</strong> We use third-party services for email delivery (Resend), authentication, and hosting. These providers only access data necessary to perform their services.</p>
                <p><strong className="text-foreground">Legal Requirements:</strong> We may disclose information if required by law or to protect our rights, safety, or property.</p>
                <p className="font-medium text-foreground">We do not sell your personal information to third parties.</p>
              </div>
            </section>

            {/* Data Retention */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Data Retention</h2>
              </div>
              <div className="space-y-4 text-muted-foreground">
                <p>We retain your data for as long as your account is active or as needed to provide services. You can request deletion of your account and associated data at any time.</p>
                <p>Application and RSVP data is retained for 2 years after submission to allow clubs to maintain historical records. Anonymized usage data may be retained indefinitely for analytics purposes.</p>
              </div>
            </section>

            {/* Your Rights */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Your Rights & Choices</h2>
              </div>
              <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                <li><strong className="text-foreground">Access:</strong> You can view and export your personal data from your profile settings.</li>
                <li><strong className="text-foreground">Correction:</strong> You can update your profile information at any time.</li>
                <li><strong className="text-foreground">Deletion:</strong> You can request account deletion by contacting us.</li>
                <li><strong className="text-foreground">Notifications:</strong> You can manage your email notification preferences in your account settings.</li>
                <li><strong className="text-foreground">Unsubscribe:</strong> Every email includes an unsubscribe link to opt out of that notification type.</li>
              </ul>
            </section>

            {/* Security */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Security</h2>
              <p className="text-muted-foreground">
                We implement industry-standard security measures including encryption in transit (HTTPS), secure authentication, and row-level security policies on our database. However, no method of transmission over the Internet is 100% secure. We encourage you to use strong, unique passwords and protect your account credentials.
              </p>
            </section>

            {/* Contact */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Contact Us</h2>
              </div>
              <div className="p-6 rounded-lg bg-card border border-border">
                <p className="text-muted-foreground mb-4">
                  If you have questions about this Privacy Policy or your data, please contact us:
                </p>
                <p className="text-foreground font-medium">ZotHub</p>
                <p className="text-muted-foreground">University of California, Irvine</p>
                <p className="text-muted-foreground">Irvine, CA 92697</p>
                <p className="text-primary mt-2">privacy@zothub.lovable.app</p>
              </div>
            </section>

            {/* Updates */}
            <section className="pb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">Policy Updates</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date. Your continued use of ZotHub after changes constitutes acceptance of the updated policy.
              </p>
            </section>
          </div>
        </div>
      </div>
    </RoleBasedLayout>
  );
}
