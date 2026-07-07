
Goal
- Fix “Success” modals (especially “Application Submitted”) so text and buttons always fit cleanly (no overflow, awkward wrapping, or cramped horizontal layouts).
- Ensure other confirmation prompts that use dialogs (publish/create flows, delete confirmations) look consistent and not broken across mobile/tablet/desktop.

What I found (root causes likely contributing)
- SuccessModal can render long action labels side-by-side on larger screens (sm:flex-row) inside a relatively narrow modal (sm:max-w-md). Two long labels (e.g., “Browse More Opportunities”) can look cramped; three buttons (calendar + secondary + primary) can overflow or wrap awkwardly.
- The base DialogFooter / AlertDialogFooter uses `sm:space-x-2`, which can look messy when items wrap (it leaves “indent” spacing on wrapped lines). The SuccessModal also adds `gap-*`, so on some breakpoints you effectively have both `gap` and `space-x`.
- index.html currently starts as `class="light"` / `color-scheme: light` even though the app forces dark theme. This can cause inconsistent “first paint” styling and any Tailwind `dark:` utilities (used inside SuccessModal) can be unreliable if `.dark` isn’t present immediately.

Scope check: where success dialogs are used
- src/pages/OpportunityDetail.tsx → SuccessModal: “Application Submitted!” (two long-ish buttons)
- src/pages/CreateOpportunity.tsx → SuccessModal: “Opportunity Published!”
- src/pages/CreateEvent.tsx → SuccessModal: “Event Published!”
- RSVP success is currently toast-based (not SuccessModal), so it’s less likely affected, but we’ll still verify the overall toast look after theme baseline fixes.

Implementation approach (changes to make)
1) Stabilize dark theme at first paint (prevents odd colors in modals)
   - File: index.html
   - Change `<html>` to start with `class="dark"` and `style="color-scheme: dark"`.
   - Update the small inline script to default to dark (or simply ensure `.dark` is always applied), since the app is already forced dark in src/App.tsx via next-themes.

2) Make base Dialog / AlertDialog surfaces more consistent (optional but recommended)
   - File: src/components/ui/dialog.tsx
     - Change DialogContent background from `bg-background` to `bg-card` (better elevated surface contrast in your dark-only design).
     - Add overflow protection: `max-h-[90vh] overflow-y-auto` so long content never pushes buttons off-screen.
     - Update DialogFooter default layout to avoid `space-x-*` and support wrapping cleanly:
       - Use `gap-2` and `sm:flex-wrap` (instead of `sm:space-x-2`), so if buttons wrap they still look aligned.
   - File: src/components/ui/alert-dialog.tsx
     - Mirror the same improvements (bg-card, overflow handling, footer gap + wrap).
   - These changes help all dialog-based prompts, not just SuccessModal.

3) Fix SuccessModal layout so buttons always fit (primary focus)
   - File: src/components/SuccessModal.tsx
   - Adjust modal width:
     - Replace `sm:max-w-md` with `sm:max-w-lg` (or remove the override and let the base `max-w-lg` stand). This alone reduces cramping for long labels.
   - Replace the footer layout with a responsive grid that adapts to 1/2/3 buttons:
     - Count how many buttons will render (calendar?, secondary?, primary/done?).
     - Render actions inside a container like:
       - `grid grid-cols-1 sm:grid-cols-2 gap-2` for 2 buttons
       - `grid grid-cols-1 sm:grid-cols-3 gap-2` for 3 buttons
     - Ensure each Button is `w-full` at all sizes for a clean, consistent alignment.
   - Allow long button labels to wrap nicely within the button:
     - Override the global `whitespace-nowrap` for these specific modal buttons with `whitespace-normal` (and optionally `leading-snug text-center`), so labels never overflow.
   - Make the success icon styling theme-token-based (removes reliance on `dark:`):
     - Replace `bg-green-100 dark:bg-green-900/30` with something like `bg-success/15`
     - Replace green icon text with `text-success`
     - This keeps the look consistent in your dark-only palette and avoids “light green bubble” mismatches.

4) Verification checklist (I’ll run through these after implementing)
   - Apply flow:
     - Go to an opportunity detail, submit an application, confirm “Application Submitted!” modal:
       - Title/description readable
       - Buttons do not overflow
       - Buttons are aligned and spaced cleanly
       - Works on mobile, tablet, desktop widths
   - Publish flows:
     - Publish an opportunity → “Opportunity Published!” modal
     - Publish an event → “Event Published!” modal
     - Confirm the two-button layout still looks good (and doesn’t look overly “stretched”).
   - Any dialog/alert dialogs:
     - Open a delete confirmation (OpportunityManagement / EventManagement / TeamManagement) and verify footer spacing/wrapping looks correct.
   - Smoke-check toasts (RSVP success):
     - Confirm toasts still render with correct dark styling.

Acceptance criteria (what “fixed” means)
- No overlapping or overflowing text in the SuccessModal title/description/buttons.
- Buttons never run off the modal width; they either wrap cleanly or stack predictably.
- Spacing looks intentional (no strange indenting from wrapped `space-x` layouts).
- Dark theme appearance is consistent immediately on load and inside all dialogs.

Risk / rollback notes
- Changing DialogFooter / AlertDialogFooter affects all dialogs; if anything looks worse in a specific dialog, we can localize the layout changes just to SuccessModal instead (but the footer gap+wrap change is generally an improvement).
