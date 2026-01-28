

# Email Notification Fixes Plan

This plan addresses the two missing email notification triggers identified in the audit.

---

## Overview

| Issue | Current State | Fix Required |
|-------|--------------|--------------|
| Event Cancellation Emails | Function exists but never called | Add call before delete |
| New Club Post Emails | Template exists but no trigger | Add call after create |

---

## Task 1: Add Event Cancellation Email Trigger

**Problem**: When a club deletes an event, confirmed attendees are not notified via email.

**Current Code** (`src/hooks/useClubEvents.ts` lines 56-71):
```typescript
const deleteEvent = async (id: string) => {
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id);
  // No notification to attendees!
  ...
};
```

**Solution**: Before deleting, fetch event details and send cancellation emails to all confirmed RSVPs.

### File: `src/hooks/useClubEvents.ts`

Changes:
1. Import `sendEventCancellationEmails` from `@/lib/eventNotifications`
2. Before deleting, fetch event title, date, and club name
3. Call `sendEventCancellationEmails()` to notify attendees
4. Then proceed with delete

The updated function will:
- Fetch the event details (title, date) before deletion
- Get the club name from the clubId
- Call `sendEventCancellationEmails(eventId, title, date, clubName)`
- Then delete the event from database

---

## Task 2: Add New Club Post Email Notification

**Problem**: When a club creates a new opportunity or event, followers only get in-app notifications (via database trigger) but no email.

**Current State**: The database trigger `notify_followers_on_new_post` creates in-app notifications only.

**Solution**: Add email sending logic to the edge function `send-reminders` or create a new database trigger that calls the edge function.

### Option A: Add to Create Flow (Client-Side)

After successfully creating an opportunity/event, call the send-email function for each follower.

### Option B: Create Database Trigger (Recommended)

Create a new edge function `notify-followers` that:
1. Is triggered by the existing database trigger OR
2. Runs on a schedule to check for new posts and email followers

**Recommended Approach**: Modify the existing `send-reminders` function to also check for recent posts (created in last hour) and email followers who haven't been notified.

### File: `supabase/functions/send-reminders/index.ts`

Add a third section after deadline reminders:

1. Query opportunities and events created in the last hour
2. For each new post, get followers who have `deadline_reminders` enabled
3. Check if email already sent (add to reminder_logs with type `new_post_email`)
4. Send `new_club_post` email with link to the opportunity/event

---

## Implementation Order

| Step | Task | Effort |
|------|------|--------|
| 1 | Add event cancellation emails to deleteEvent | Low |
| 2 | Add new_club_post emails to send-reminders | Medium |
| 3 | Test email delivery with real accounts | Low |

---

## Files to Modify

1. **`src/hooks/useClubEvents.ts`**
   - Import eventNotifications
   - Fetch event details before delete
   - Call sendEventCancellationEmails()

2. **`supabase/functions/send-reminders/index.ts`**
   - Add section 3 for new post notifications
   - Query recent opportunities/events
   - Email followers with new_club_post template

---

## Verification

After implementation:
- Delete an event with RSVPs → Attendees should receive cancellation email
- Create a new opportunity → Followers should receive new_club_post email within 1 hour
- Check edge function logs for successful email sends

---

## Note on Testing

Since there are no recent edge function logs, we should also verify:
1. RESEND_API_KEY secret is configured correctly
2. Resend domain is verified
3. Edge functions are deployed and accessible

