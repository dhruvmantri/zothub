import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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

  // Provision a brand-new Google-OAuth account (backlog A1).
  //
  // This used to insert the waitlist row and the profile row straight from the
  // browser. The profile insert was ALWAYS rejected by RLS and the failure was
  // never surfaced — `await supabase.from(...).insert(...)` with the result
  // discarded — so every Google signup produced an account with no profile,
  // silently, and (because it hard-coded status:"pending") queued students for a
  // review that OTP students have not needed since S3.
  //
  // It cannot be fixed in the client: the profile policies require a role
  // (20251223013805:73,:108) and the client cannot grant itself one, because the
  // user_roles self-insert policy was dropped as a privilege-escalation fix (S1).
  // Provisioning therefore happens in the `provision-oauth-user` edge function,
  // which mirrors what verify-otp already does for the OTP path.
  const handleNewOAuthUser = async (userId: string) => {
    const intendedRole = localStorage.getItem("zothub_intended_role") as "student" | "club" | null;

    if (!intendedRole) {
      // Signed in with no role chosen — e.g. an OAuth sign-IN that predates a
      // role, or a returning user whose provisioning never completed. Leave the
      // role null; routing handles this state.
      setRole(null);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("provision-oauth-user", {
        body: { role: intendedRole },
      });

      if (error) {
        // Surfaced deliberately. The silent-failure version of this call is
        // exactly what made A1 invisible for weeks.
        console.error("Error provisioning OAuth account:", error);
        setRole(null);
        return;
      }

      // Students are auto-approved server-side, so set the role we were given
      // rather than assuming the waitlist. Clubs come back autoApproved:false
      // and stay role-less until an admin approves them.
      if (data?.autoApproved && data?.role) {
        setRole(data.role as UserRole);
      } else {
        setRole(null);
      }

      localStorage.removeItem("zothub_intended_role");
    } catch (err) {
      console.error("Error provisioning OAuth account:", err);
      setRole(null);
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
