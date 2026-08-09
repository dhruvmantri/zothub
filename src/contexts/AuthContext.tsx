import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_ALLOWED_EMAILS } from "@/lib/constants";

type UserRole = "student" | "club" | "admin" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (intendedRole?: "student" | "club") => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role fetch to avoid deadlock, but keep isLoading true until role is fetched
        if (session?.user) {
          setTimeout(() => {
            if (isMounted) {
              fetchUserRole(session.user.id);
            }
          }, 0);
        } else {
          setRole(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchUserRole(session.user.id);
      } else {
        setIsLoading(false);
      }
    };

    initSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      // One account = one role. (Club claims are logged-out-only and always create
      // a separate club account, so an account never accrues a second role here.)
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching role:", error);
        setRole(null);
      } else if (data) {
        setRole(data.role as UserRole);
      } else {
        // No role found - this might be a new Google OAuth user
        // Check if there's an intended role stored
        await handleNewOAuthUser(userId);
      }
    } catch (err) {
      console.error("Error fetching role:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewOAuthUser = async (userId: string) => {
    const intendedRole = localStorage.getItem("zothub_intended_role") as "student" | "club" | null;
    
    if (!intendedRole) {
      // No intended role - user needs to select one
      setRole(null);
      return;
    }

    try {
      // Get user email from auth
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email;

      if (!email) {
        console.error("No email found for user");
        return;
      }

      // Validate UCI email (allow admin emails to bypass)
      if (!email.endsWith("@uci.edu") && !ADMIN_ALLOWED_EMAILS.includes(email.toLowerCase())) {
        console.error("Non-UCI email attempted to sign up");
        await supabase.auth.signOut();
        return;
      }

      // Add to waitlist instead of user_roles (pending admin approval)
      const { error: waitlistError } = await supabase
        .from("waitlist")
        .insert({ 
          user_id: userId, 
          email: email,
          role: intendedRole,
          status: "pending"
        });

      if (waitlistError) {
        console.error("Error inserting waitlist entry:", waitlistError);
        return;
      }

      // Create initial profile based on role
      if (intendedRole === "student") {
        await supabase
          .from("student_profiles")
          .insert({ 
            user_id: userId, 
            email: email,
            full_name: user?.user_metadata?.full_name || null,
            avatar_url: user?.user_metadata?.avatar_url || null
          });
      } else {
        // Pending club → published=false so it stays out of the public directory
        // and profile until an admin approves (the waitlist-approval trigger flips it).
        await supabase
          .from("club_profiles")
          .insert({
            user_id: userId,
            email: email,
            club_name: "My Club",
            published: false
          });
      }

      // Send waitlist confirmation email. Recipient is derived server-side from the
      // signed-in caller's own account (authoritative self-send) — no client `to`.
      await supabase.functions.invoke("send-email", {
        body: {
          type: "waitlist_confirmation",
          data: { role: intendedRole },
        },
      });

      // Don't set role since they're on waitlist
      setRole(null);
      localStorage.removeItem("zothub_intended_role");
    } catch (err) {
      console.error("Error handling new OAuth user:", err);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signInWithGoogle = async (intendedRole?: "student" | "club") => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            hd: "uci.edu", // Restrict to UCI Google Workspace domain
          },
          ...(intendedRole && {
            scopes: "email profile",
          }),
        },
      });

      if (error) {
        return { error };
      }

      // Store intended role in localStorage for post-OAuth handling
      if (intendedRole) {
        localStorage.setItem("zothub_intended_role", intendedRole);
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    localStorage.removeItem("zothub_intended_role");
  };

  return (
    <AuthContext.Provider value={{ user, session, role, isLoading, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
