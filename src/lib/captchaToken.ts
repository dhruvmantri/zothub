// Captcha token lifecycle, as a pure reducer so the "fresh token per request" rule
// is unit-testable without a browser (see src/lib/captchaToken.test.ts).
//
// Cloudflare Turnstile tokens are SINGLE-USE: once a token has been submitted, the
// server redeems it and a replay is rejected. Any second request — most visibly an
// OTP *resend* — therefore needs a brand-new challenge. Bumping `refreshKey` is what
// resets the widget; clearing `token` is what keeps the submit/resend button disabled
// until the new token arrives.

export interface CaptchaState {
  /** The current unused token, or null when none is available. */
  token: string | null;
  /** Bumped every time a token is consumed; resets the Turnstile widget. */
  refreshKey: number;
}

export const initialCaptchaState: CaptchaState = { token: null, refreshKey: 0 };

export type CaptchaEvent =
  /** The widget produced a token. */
  | { type: "solved"; token: string }
  /** The token expired or the widget errored — unusable, but no new challenge forced. */
  | { type: "cleared" }
  /** A request just submitted the token; it is now spent. Force a fresh challenge. */
  | { type: "consumed" };

export function captchaReducer(state: CaptchaState, event: CaptchaEvent): CaptchaState {
  switch (event.type) {
    case "solved":
      return { ...state, token: event.token };
    case "cleared":
      return { ...state, token: null };
    case "consumed":
      return { token: null, refreshKey: state.refreshKey + 1 };
    default:
      return state;
  }
}

/** Whether a captcha-gated action may proceed. */
export function canSubmitWithCaptcha(state: CaptchaState, captchaEnabled: boolean): boolean {
  return !captchaEnabled || state.token !== null;
}
