import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Reset scroll position on navigation, and restore it when going back (UX14).
 *
 * Nothing in the app did this, so navigating from halfway down the Clubs list
 * landed you halfway down the next page — a direct contributor to the "the page
 * never changed" complaint (UX1), because the most obvious visual cue that a
 * navigation happened is the viewport jumping back to the top.
 *
 * React Router's own `<ScrollRestoration>` is not usable here: it requires a data
 * router (createBrowserRouter), and this app uses `<BrowserRouter>` with a
 * `<Routes>` tree. Hence the manual version.
 *
 * POP (back/forward) restores the remembered offset so the browser's own
 * expectation is honoured; PUSH/REPLACE go to the top, which is what a new
 * destination should do.
 */

// sessionStorage rather than a module-level Map: a Map is wiped by any full page
// load, so a reload-then-back lost the position. sessionStorage is per-tab and
// cleared when the tab closes, which is exactly the lifetime a scroll offset
// should have. Wrapped in try/catch because it throws outright in some privacy
// modes — a lost scroll offset must never break navigation.
const STORAGE_KEY = "zothub:scroll";

/** ~20 frames (about a third of a second) is plenty for a route to lay out,
 *  and short enough that a genuinely missing target gives up quickly. */
const MAX_RESTORE_FRAMES = 20;

function readPositions(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function writePosition(key: string, value: number) {
  try {
    const all = readPositions();
    all[key] = value;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Ignore: not worth breaking navigation over.
  }
}

function readPosition(key: string): number | undefined {
  return readPositions()[key];
}

export function useScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();

  // Take the browser out of the loop so its guess can't fight ours.
  useEffect(() => {
    if (!("scrollRestoration" in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  // Remember where we were as we leave, keyed by the full path + query so two
  // filtered views of the same list do not share one offset.
  // Track the position CONTINUOUSLY while the route is mounted, rather than
  // reading it once on the way out.
  //
  // Reading it at teardown is wrong, and measurably so: React's cleanup runs
  // AFTER the route has changed and the new page has laid out, so by then the
  // browser has already clamped window.scrollY to the new page's height. Going
  // from /help (1903px tall, scrolled to 700) to / (1286px tall, max scroll 386)
  // stored 386 — the new page's limit, not where the user actually was. The
  // restore then worked perfectly and put them at 386.
  //
  // A passive listener throttled to one write per animation frame costs nothing
  // and always records a position that was real on the page it belongs to.
  useEffect(() => {
    const key = location.pathname + location.search;
    let frame = 0;

    const record = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        writePosition(key, window.scrollY);
      });
    };

    // `pagehide` also covers a full page load, a reload, and closing the tab,
    // where no React cleanup runs at all. scrollY is still valid there because
    // the page has not changed.
    window.addEventListener("scroll", record, { passive: true });
    window.addEventListener("pagehide", record);

    return () => {
      window.removeEventListener("scroll", record);
      window.removeEventListener("pagehide", record);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [location.pathname, location.search]);

  useEffect(() => {
    const key = location.pathname + location.search;
    const remembered = readPosition(key);

    if (navigationType === "POP" && remembered !== undefined) {
      // Restoring on a single animation frame does NOT work: the route's content
      // is still streaming in, the document is shorter than it will be, and the
      // browser clamps the scroll to whatever height exists at that instant.
      // Measured: restoring 700px landed at 386px.
      //
      // So re-apply across frames until the target is actually reached (the
      // document has grown enough) or a short budget expires. Bail out early if
      // the visitor scrolls themselves — never fight a user's own input.
      let frames = 0;
      let cancelled = false;
      const onUserScroll = () => { cancelled = true; };
      window.addEventListener("wheel", onUserScroll, { passive: true, once: true });
      window.addEventListener("touchstart", onUserScroll, { passive: true, once: true });

      const tick = () => {
        if (cancelled) return;
        window.scrollTo(0, remembered);
        frames += 1;
        if (Math.abs(window.scrollY - remembered) <= 2 || frames >= MAX_RESTORE_FRAMES) {
          window.removeEventListener("wheel", onUserScroll);
          window.removeEventListener("touchstart", onUserScroll);
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      return () => {
        cancelled = true;
        window.removeEventListener("wheel", onUserScroll);
        window.removeEventListener("touchstart", onUserScroll);
      };
    }

    // A hash link (#section) means the author asked for a specific place — don't
    // fight it.
    if (location.hash) return;

    window.scrollTo(0, 0);
  }, [location.pathname, location.search, location.hash, navigationType]);
}
