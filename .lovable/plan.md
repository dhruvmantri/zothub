
# Comprehensive Architecture Improvement Plan

This plan addresses all remaining items from the code audit to improve structure, maintainability, and consistency across the codebase.

---

## Overview

We will implement 4 major improvements:
1. **Centralize Constants & Enums** - Create a single source of truth for hardcoded values
2. **Extract RSVP Logic from EventDetail** - Create a dedicated `useEventRSVP` hook
3. **Refactor Notifications Page** - Extract preferences dialog and team invitation components
4. **Update Feed Pages to Use Centralized Types** - Remove local `FeedItem` definitions

---

## Task 1: Centralize Constants & Enums

**Problem**: Hardcoded values like `OPPORTUNITY_TYPES`, `YEAR_OPTIONS`, and club categories are duplicated across multiple files.

**Files with duplication**:
- `CreateOpportunity.tsx` (lines 38-45): `OPPORTUNITY_TYPES`
- `EditOpportunity.tsx` (lines 36-43): `OPPORTUNITY_TYPES` (identical)
- `StudentProfileSetup.tsx` (line 35): `YEAR_OPTIONS`
- `validation.ts` (line 102, 146, 173-179): `opportunityTypes`, `yearOptions`, `categoryOptions`

**Solution**: Create `src/lib/constants.ts` with all shared enums and update imports.

### New File: `src/lib/constants.ts`

```text
// Opportunity Types
OPPORTUNITY_TYPES = [
  { value: "leadership", label: "Leadership Role" },
  { value: "project", label: "Project Team" },
  { value: "internship", label: "Internship" },
  { value: "volunteer", label: "Volunteer" },
  { value: "committee", label: "Committee" },
  { value: "other", label: "Other" },
]

// Student Year Options
YEAR_OPTIONS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate", "PhD"]

// Club Categories
CLUB_CATEGORIES = [
  "Academic", "Arts & Culture", "Business & Finance", ...
]

// Skill/Interest Suggestions for StudentProfileSetup
SKILL_SUGGESTIONS = [...]
INTEREST_SUGGESTIONS = [...]
```

### Files to Update:
| File | Change |
|------|--------|
| `CreateOpportunity.tsx` | Remove local `OPPORTUNITY_TYPES`, import from constants |
| `EditOpportunity.tsx` | Remove local `OPPORTUNITY_TYPES`, import from constants |
| `StudentProfileSetup.tsx` | Remove local `YEAR_OPTIONS`, `SKILL_SUGGESTIONS`, `INTEREST_SUGGESTIONS`, import from constants |
| `validation.ts` | Remove local `opportunityTypes`, `yearOptions`, `categoryOptions`, import from constants |

---

## Task 2: Extract RSVP Logic from EventDetail

**Problem**: `EventDetail.tsx` (~300 lines) mixes RSVP state management with UI rendering.

**Current RSVP logic in EventDetail.tsx**:
- State: `hasRSVP`, `rsvpStatus`, `studentProfileId`, `rsvpLoading`, `showRSVPForm`
- Functions: `fetchStudentProfile()`, `checkRSVP()`, `handleRSVP()`, `handleRSVPFormSuccess()`
- Capacity calculations and status checks

**Solution**: Create `src/hooks/useEventRSVP.ts` to encapsulate all RSVP logic.

### New Hook: `useEventRSVP(eventId, event)`

```text
Returns:
- studentProfileId: string | null
- hasRSVP: boolean
- rsvpStatus: string | null
- rsvpLoading: boolean
- showRSVPForm: boolean
- setShowRSVPForm: (show: boolean) => void
- handleRSVP: () => Promise<void>
- handleRSVPFormSuccess: () => void
- confirmedRsvps: number
- spotsLeft: number | null
```

### Files to Update:
| File | Change |
|------|--------|
| `src/hooks/useEventRSVP.ts` | Create new hook |
| `src/pages/EventDetail.tsx` | Remove RSVP state/logic (~80 lines), use hook instead |

---

## Task 3: Refactor Notifications Page

**Problem**: `Notifications.tsx` (610 lines) contains multiple concerns that should be separate components.

**Extractable sections**:
1. **Notification Preferences Dialog** (lines 351-437): ~90 lines of preferences UI
2. **Team Invitation Rendering** (lines 209-283): ~75 lines for team invitation cards
3. **Standard Notification Rendering** (lines 286-333): ~50 lines for regular notifications

**Solution**: Extract into focused components.

### New Components:

**1. `src/components/notifications/NotificationPreferencesDialog.tsx`**
```text
Props:
- open: boolean
- onOpenChange: (open: boolean) => void
- preferences: NotificationPreferences
- onPreferenceChange: (key, value) => void
```

**2. `src/components/notifications/TeamInvitationCard.tsx`**
```text
Props:
- notification: Notification
- status: InvitationStatus
- isProcessing: boolean
- onAccept: () => void
- onDecline: () => void
```

**3. `src/components/notifications/NotificationCard.tsx`**
```text
Props:
- notification: Notification
- role: UserRole
- onMarkAsRead: () => void
```

### Files to Update:
| File | Change |
|------|--------|
| `src/components/notifications/NotificationPreferencesDialog.tsx` | Create new component |
| `src/components/notifications/TeamInvitationCard.tsx` | Create new component |
| `src/components/notifications/NotificationCard.tsx` | Create new component |
| `src/pages/Notifications.tsx` | Import and use new components (~200 lines removed) |

---

## Task 4: Update Feed Pages to Use Centralized Types

**Problem**: Both `StudentFeed.tsx` and `ClubFeed.tsx` define their own local `FeedItem` interface, despite the same type already existing in `src/types/index.ts`.

**Current duplications**:
- `StudentFeed.tsx` (lines 16-37): Local `FollowedClub` and `FeedItem` interfaces
- `ClubFeed.tsx` (lines 8-24): Local `FeedItem` interface

**Solution**: Import `FeedItem` from centralized types and add `FollowedClub` to types file.

### Types to Add to `src/types/index.ts`:
```text
interface FollowedClub {
  id: string;
  club_name: string;
  logo_url: string | null;
}
```

### Files to Update:
| File | Change |
|------|--------|
| `src/types/index.ts` | Add `FollowedClub` interface |
| `src/pages/StudentFeed.tsx` | Remove local interfaces, import from `@/types` |
| `src/pages/club/ClubFeed.tsx` | Remove local `FeedItem`, import from `@/types` |

---

## Implementation Order

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| 1 | Centralize Constants | High (removes 4 duplications) | Low |
| 2 | Update Feed Types | Medium (removes 2 duplications) | Low |
| 3 | Extract useEventRSVP | High (cleaner EventDetail) | Medium |
| 4 | Refactor Notifications | Medium (cleaner page) | Medium |

---

## Summary of Changes

**New Files (6)**:
- `src/lib/constants.ts`
- `src/hooks/useEventRSVP.ts`
- `src/components/notifications/NotificationPreferencesDialog.tsx`
- `src/components/notifications/TeamInvitationCard.tsx`
- `src/components/notifications/NotificationCard.tsx`
- `src/components/notifications/index.ts` (barrel export)

**Modified Files (8)**:
- `src/types/index.ts` (add FollowedClub)
- `src/lib/validation.ts` (import constants)
- `src/pages/CreateOpportunity.tsx`
- `src/pages/EditOpportunity.tsx`
- `src/pages/StudentProfileSetup.tsx`
- `src/pages/EventDetail.tsx`
- `src/pages/Notifications.tsx`
- `src/pages/StudentFeed.tsx`
- `src/pages/club/ClubFeed.tsx`

**Estimated Lines Removed**: ~350 lines of duplicate code
**Estimated Lines Added**: ~400 lines (but in proper locations with better separation)

---

## Technical Notes

- All constants will be exported as `const` with proper TypeScript typing
- The `useEventRSVP` hook will handle authentication checks and capacity validation internally
- Notification components will follow the existing component patterns in the codebase
- All imports will use the `@/` path alias consistently
