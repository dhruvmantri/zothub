import { test, expect, type Page } from "@playwright/test";

// Smoke-level e2e for the core public flows (WS7). Backend-independent: these
// assertions hold whether the app is talking to a real Supabase project or the
// placeholder backend injected by playwright.config.ts (in which case data
// pages render their documented loading/empty/error states). Authenticated
// journeys (apply, RSVP, review) need a seeded backend and are out of smoke
// scope.

// Fail any test in which the page throws an uncaught error (an ErrorBoundary
// crash or unhandled exception is exactly what a smoke suite must catch).
function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  return errors;
}

test.describe("public discovery smoke", () => {
  test("landing page renders hero and discovery CTA", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Browse Opportunities" })
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  for (const route of ["/opportunities", "/events", "/clubs"]) {
    test(`${route} renders its page shell without crashing`, async ({
      page,
    }) => {
      const errors = collectPageErrors(page);
      await page.goto(route);
      // The page heading is part of the static shell — it must render even
      // when the backend is unreachable (clean empty/error state, no crash).
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.getByPlaceholder(/search/i).first()).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test("privacy policy page renders", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/privacy");
    await expect(page.locator("h1").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("unknown route shows the 404 page", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByText("Oops! Page not found")).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("auth entry points smoke", () => {
  test("login page renders the login form", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/login");
    await expect(page.getByText("Log in to ZotHub")).toBeVisible();
    await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("signup page renders", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/signup");
    await expect(page.locator("h1").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a protected route redirects logged-out visitors to /login", async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    await page.goto("/student/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Log in to ZotHub")).toBeVisible();
    expect(errors).toEqual([]);
  });

  // WS8: Waitlist / WaitlistRejected now redirect logged-out visitors via
  // <Navigate> instead of calling navigate() in the render body. The redirect
  // must still land on /login, and crucially without any render-time React
  // warning/error (collectPageErrors also catches console errors would-be
  // "cannot update a component while rendering" surfaced as pageerror).
  for (const route of ["/waitlist", "/waitlist-rejected"]) {
    test(`${route} redirects a logged-out visitor to /login`, async ({
      page,
    }) => {
      const errors = collectPageErrors(page);
      await page.goto(route);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByText("Log in to ZotHub")).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});
