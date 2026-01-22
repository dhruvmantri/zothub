import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type ItemType = 'opportunity' | 'event' | 'club';

export function useTrackView(itemType: ItemType, itemId: string | undefined) {
  const tracked = useRef(false);

  useEffect(() => {
    if (!itemId || tracked.current) return;

    const trackView = async () => {
      try {
        // Get or create session ID for anonymous users
        let sessionId = sessionStorage.getItem('view_session_id');
        if (!sessionId) {
          sessionId = crypto.randomUUID();
          sessionStorage.setItem('view_session_id', sessionId);
        }

        await supabase.rpc('track_page_view', {
          p_item_type: itemType,
          p_item_id: itemId,
          p_session_id: sessionId
        });

        tracked.current = true;
      } catch (error) {
        // Silently fail - view tracking shouldn't break the page
        console.error("Failed to track view:", error);
      }
    };

    trackView();
  }, [itemType, itemId]);
}
