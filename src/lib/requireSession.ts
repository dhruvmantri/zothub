import { supabase } from "@/integrations/supabase/client";

/**
 * Ensures we have a valid authenticated session.
 * Returns the session if valid, otherwise throws an error.
 */
export async function requireSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    throw new Error("Failed to get session");
  }
  
  if (!session) {
    // Try to refresh the session
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !refreshData.session) {
      throw new Error("Session expired. Please log in again.");
    }
    
    return refreshData.session;
  }
  
  return session;
}
