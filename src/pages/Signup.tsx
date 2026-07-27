import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { ArrowLeft, GraduationCap, Building2, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ADMIN_ALLOWED_EMAILS } from "@/lib/constants";
import { OTPVerification } from "@/components/OTPVerification";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

type UserRole = "student" | "club";

export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get("role") as UserRole | null;
  const { signInWithGoogle, user, role } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<"role" | "details" | "otp">(initialRole ? "details" : "role");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // OTP state
  const [otpExpiresAt, setOtpExpiresAt] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (user && role) {
      if (role === "club") {
        navigate("/club/dashboard");
      } else {
        navigate("/student/dashboard");
      }
    }
  }, [user, role, navigate]);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setStep("details");
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!formData.email.endsWith("@uci.edu") && !ADMIN_ALLOWED_EMAILS.includes(formData.email.toLowerCase())) {
      newErrors.email = "Please use your @uci.edu email";
    }
    
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const sendOTP = async () => {
    setIsSubmitting(true);
    setErrors({});
    
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: {
          email: formData.email,
          password: formData.password,
          role: selectedRole,
        },
      });

      if (error) {
        // Handle HTTP errors from edge function (non-2xx responses)
        if (error instanceof FunctionsHttpError) {
          const errorData = await error.context.json();
          throw new Error(errorData.error || "Request failed");
        }
        throw new Error(error.message);
      }

      // Also check for error in response data (for 2xx responses with error payload)
      if (data?.error) {
        throw new Error(data.error);
      }

      setOtpExpiresAt(data.expiresAt);
      setStep("otp");
      toast({
        title: "Code sent!",
        description: "Check your email for the 6-digit verification code.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send verification code";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !selectedRole) return;
    await sendOTP();
  };

  const handleVerifyOTP = async (code: string) => {
    setIsVerifying(true);
    setOtpError("");

    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: {
          email: formData.email,
          code,
          password: formData.password,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        setOtpError(data.error);
        return;
      }

      // Sign the new account in rather than bouncing to /login. The password
      // was just proven correct by verify-otp (it hash-matches the one held
      // with the OTP), so re-asking for it is pure friction — and the fair-booth
      // signup is exactly where friction loses the user.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        // The account exists and is valid; only the convenience step failed.
        // Send them to /login rather than stranding them on the OTP screen.
        console.error("Auto sign-in after signup failed:", signInError);
        toast({
          title: "Account created!",
          description: "Welcome to ZotHub. Please log in to continue.",
        });
        navigate("/login");
        return;
      }

      if (data?.autoApproved) {
        toast({
          title: "Welcome to ZotHub!",
          description: "Your account is ready.",
        });
        navigate("/student/dashboard");
      } else {
        // Clubs still go through the /admin review queue.
        toast({
          title: "Account created!",
          description: "Your club is pending review — we'll email you once it's approved.",
        });
        navigate("/waitlist");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Verification failed";
      setOtpError(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    setOtpError("");
    await sendOTP();
  };

  const handleGoogleSignUp = async () => {
    if (!selectedRole) return;
    
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle(selectedRole);
    
    if (error) {
      toast({
        title: "Google sign-up failed",
        description: error.message,
        variant: "destructive",
      });
      setIsGoogleLoading(false);
    }
    // Note: Don't set loading to false on success - page will redirect
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Logo />
          </div>

          {step === "role" ? (
            <>
              <h1 className="font-display text-2xl font-bold text-center text-foreground mb-2">
                Join ZotHub
              </h1>
              <p className="text-center text-muted-foreground mb-8">
                Are you a student or representing a club?
              </p>

              <div className="space-y-4">
                <button
                  onClick={() => handleRoleSelect("student")}
                  className="w-full p-6 rounded-2xl border-2 border-border hover:border-accent bg-card hover:bg-secondary/30 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-secondary group-hover:bg-accent/10 flex items-center justify-center transition-colors">
                      <GraduationCap className="w-7 h-7 text-accent" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-display font-semibold text-foreground">
                        I'm a Student
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Discover opportunities and events
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleRoleSelect("club")}
                  className="w-full p-6 rounded-2xl border-2 border-border hover:border-accent bg-card hover:bg-secondary/30 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-secondary group-hover:bg-accent/10 flex items-center justify-center transition-colors">
                      <Building2 className="w-7 h-7 text-accent" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-display font-semibold text-foreground">
                        I represent a Club
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Post opportunities and manage events
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <p className="mt-8 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-accent font-medium hover:underline">
                  Log in
                </Link>
              </p>
            </>
          ) : step === "otp" ? (
            <OTPVerification
              email={formData.email}
              expiresAt={otpExpiresAt}
              onVerify={handleVerifyOTP}
              onResend={handleResendOTP}
              onBack={() => setStep("details")}
              isVerifying={isVerifying}
              error={otpError}
            />
          ) : (
            <>
              <button
                onClick={() => setStep("role")}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Change role
              </button>

              <h1 className="font-display text-2xl font-bold text-foreground mb-2">
                Create your account
              </h1>
              <p className="text-muted-foreground mb-6">
                Sign up as a {selectedRole === "student" ? "student" : "club representative"}
              </p>

              {/* Google OAuth Button */}
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full mb-6 gap-3"
                onClick={handleGoogleSignUp}
                disabled={isGoogleLoading || isSubmitting}
              >
                {isGoogleLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Sign up with UCI Google
              </Button>

              {/* Divider */}
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with email
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">UCI Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@uci.edu"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={errors.email ? "border-destructive" : ""}
                    disabled={isSubmitting}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={cn("pr-10", errors.password ? "border-destructive" : "")}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={errors.confirmPassword ? "border-destructive" : ""}
                    disabled={isSubmitting}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending code...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-accent font-medium hover:underline">
                  Log in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-bl from-primary/90 to-primary relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="text-center max-w-md">
            <h2 className="font-display text-3xl font-bold text-primary-foreground mb-4">
              Welcome to the Anteater Community
            </h2>
            <p className="text-lg text-primary-foreground/80">
              Join thousands of UCI students and clubs connecting, collaborating, and growing together.
            </p>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-32 left-20 w-48 h-48 bg-accent/20 rounded-full blur-2xl" />
      </div>
    </div>
  );
}
