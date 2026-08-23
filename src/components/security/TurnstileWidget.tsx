import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

// Cloudflare Turnstile site key.
//
// PRODUCTION REQUIRES BOTH KEYS:
//   VITE_TURNSTILE_SITE_KEY  (this client build)
//   TURNSTILE_SECRET_KEY     (send-otp + submit-club-claim edge functions)
// The server fails closed: without its secret it returns 503 unless a deployment
// explicitly sets CAPTCHA_DISABLED=true (local/dev only). The client mirrors that —
// in a production build a missing site key is a hard, visible error rather than a
// silently skipped challenge.
const SITE_KEY = (import.meta.env as Record<string, string | undefined>).VITE_TURNSTILE_SITE_KEY;
const IS_PROD = Boolean((import.meta.env as Record<string, unknown>).PROD);

/** True when a captcha challenge must be solved before submitting. */
export const TURNSTILE_ENABLED = Boolean(SITE_KEY) || IS_PROD;

interface TurnstileGlobal {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileGlobal;
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

interface TurnstileWidgetProps {
  /** Receives the token, or null whenever no valid token is available. */
  onToken: (token: string | null) => void;
  /**
   * Change this to force a FRESH token. Turnstile tokens are single-use, so every
   * resend/retry must reset the widget — otherwise the second request replays an
   * already-redeemed token and the server rejects it.
   */
  refreshKey?: number;
}

/**
 * Renders a Cloudflare Turnstile challenge and reports its token via `onToken`
 * (null when loading, errored, or expired), with a brief loading/error state.
 *
 * When no site key is configured AND this is a dev build, it renders nothing and
 * reports no token — local dev works because the edge functions are started with
 * CAPTCHA_DISABLED=true. In a PRODUCTION build a missing site key renders an
 * explicit error and never yields a token, so submission stays blocked.
 */
export function TurnstileWidget({ onToken, refreshKey = 0 }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const cb = useCallback(onToken, [onToken]);

  const misconfigured = !SITE_KEY && IS_PROD;

  useEffect(() => {
    if (!SITE_KEY) {
      cb(null);
      if (misconfigured) setStatus("error");
      return;
    }

    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | undefined;

    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => {
            setStatus("ready");
            cb(token);
          },
          "error-callback": () => {
            setStatus("error");
            cb(null);
          },
          "timeout-callback": () => {
            setStatus("error");
            cb(null);
          },
          "expired-callback": () => {
            // Expired tokens are unusable — drop it and re-challenge.
            setStatus("loading");
            cb(null);
            if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
          },
        });
      } catch {
        setStatus("error");
        cb(null);
      }
    };

    if (window.turnstile) {
      render();
    } else if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = render;
      s.onerror = () => {
        setStatus("error");
        cb(null);
      };
      document.head.appendChild(s);
    } else {
      poll = setInterval(() => {
        if (window.turnstile) {
          clearInterval(poll);
          render();
        }
      }, 200);
    }

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = undefined;
      }
    };
  }, [cb, misconfigured]);

  // A bumped refreshKey means the previous token was consumed (e.g. an OTP resend).
  // Clear it and reset the widget so the next request carries a FRESH token.
  useEffect(() => {
    if (refreshKey === 0 || !SITE_KEY) return;
    cb(null);
    setStatus("loading");
    if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
  }, [refreshKey, cb]);

  if (misconfigured) {
    return (
      <p role="alert" className="text-[13px] text-bad">
        Verification isn't configured, so this form can't be submitted.{" "}
        <Link
          to="/help"
          className="text-accent-text underline underline-offset-2 hover:no-underline"
        >
          Get help
        </Link>
        {" "}and we'll sort it out.
      </p>
    );
  }
  if (!SITE_KEY) return null;

  return (
    <div className="space-y-1">
      <div ref={containerRef} />
      {status === "loading" && (
        <p className="text-[12px] text-ink-3" aria-live="polite">
          Loading verification…
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="text-[12px] text-bad">
          Verification failed to load. Reload the page and try again.
        </p>
      )}
    </div>
  );
}
