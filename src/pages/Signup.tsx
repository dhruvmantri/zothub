import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, ArrowLeft, GraduationCap, Building2, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type UserRole = "student" | "club";

export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get("role") as UserRole | null;
  const { signUp, user, role } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<"role" | "details">(initialRole ? "details" : "role");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    } else if (!formData.email.endsWith("@uci.edu")) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !selectedRole) return;

    setIsSubmitting(true);
    
    const { error } = await signUp(formData.email, formData.password, selectedRole);

    if (error) {
      let errorMessage = error.message;
      
      // Handle common errors with friendly messages
      if (error.message.includes("already registered")) {
        errorMessage = "This email is already registered. Please log in instead.";
      }
      
      toast({
        title: "Signup failed",
        description: errorMessage,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    toast({
      title: "Account created!",
      description: "Welcome to ZotHub. Let's set up your profile.",
    });

    // Redirect based on role
    if (selectedRole === "club") {
      navigate("/club/dashboard");
    } else {
      navigate("/student/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Logo */}
          <Link to="/" className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-2xl text-foreground">
              Zot<span className="text-accent">Hub</span>
            </span>
          </Link>

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
              <p className="text-muted-foreground mb-8">
                Sign up as a {selectedRole === "student" ? "student" : "club representative"}
              </p>

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

                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating account...
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
      <div className="hidden lg:flex flex-1 bg-hero relative overflow-hidden">
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
        <div className="absolute top-20 right-20 w-32 h-32 bg-accent/20 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-32 left-20 w-48 h-48 bg-accent/10 rounded-full blur-2xl" />
      </div>
    </div>
  );
}
