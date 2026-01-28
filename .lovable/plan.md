

# Pre-Launch Critical Fixes Plan

This plan addresses 5 critical stability and performance fixes for the beta launch (5-10 clubs, 50-100 students).

---

## Overview

| # | Fix | Category | Risk | Effort |
|---|-----|----------|------|--------|
| 1 | Remove .env from git history + rotate keys | SECURITY | Critical | Medium |
| 2 | Add query limits to Opportunities, Events, Messages | PERFORMANCE | High | Low |
| 3 | Wrap filtering in useMemo() for 4 pages | PERFORMANCE | Medium | Low |
| 4 | Batch profile fetches in useMessages.ts | PERFORMANCE | High | Medium |
| 5 | Add 18 database indexes | DATABASE | High | Low |

---

## Task 1: Security - Remove .env from Git History

**Problem**: The `.env` file may exist in git history, exposing Supabase credentials.

**Current State**: 
- `.gitignore` correctly lists `.env` (line 16-18)
- However, if it was ever committed, history retains the credentials

**Solution**:
This is a manual task that requires git commands outside of Lovable. The user must:

1. **Run locally or in CI**:
```bash
# Use git-filter-repo (preferred) or BFG Repo Cleaner
git filter-repo --path .env --invert-paths
# Force push to remote
git push origin --force --all
```

2. **Rotate Supabase keys** via Lovable Cloud settings (critical - old keys are compromised)

3. **Verify**:
```bash
git log --all -- .env
# Should return nothing
```

**Note**: This cannot be done through Lovable's code editor. User must run commands locally.

---

## Task 2: Add Query Limits

**Problem**: Unbounded queries can return thousands of rows, causing slow loads and potential timeouts.

**Current Issues**:
- `Opportunities.tsx` line 78: No `.limit()`
- `Events.tsx` line 56: No `.limit()`
- `useMessages.ts` line 43-47: No `.limit()` on initial message fetch

**Solution**:

### File: `src/pages/Opportunities.tsx`
Add `.limit(50)` after the `.order()` call:
```typescript
// Line 78: Add after .order()
.order("created_at", { ascending: false })
.limit(50);  // ADD THIS
```

### File: `src/pages/Events.tsx`
Add `.limit(50)` after the `.order()` call:
```typescript
// Line 56: Add after .order()
.order("event_date", { ascending: true })
.limit(50);  // ADD THIS
```

### File: `src/hooks/useMessages.ts`
Add `.limit(100)` to prevent loading thousands of messages:
```typescript
// Line 47: Add after .order()
.order("created_at", { ascending: false })
.limit(100);  // ADD THIS
```

---

## Task 3: Wrap Filtering in useMemo()

**Problem**: Filter/sort logic recalculates on every render, causing lag during typing in search.

**Current Issues**:
- `Opportunities.tsx` lines 122-153: `filteredOpportunities` recalculates on every render
- `Events.tsx` lines 80-96: `filteredEvents` recalculates on every render
- `StudentFeed.tsx` lines 189-194: `filteredItems` recalculates on every render
- `ClubFeed.tsx` lines 137-142: `filteredItems` recalculates on every render

**Solution**:

### File: `src/pages/Opportunities.tsx`
```typescript
// Add useMemo import
import { useState, useEffect, useMemo } from "react";

// Replace lines 122-153 with:
const filteredOpportunities = useMemo(() => {
  return opportunities
    .filter((opp) => {
      const clubName = opp.club_profiles?.club_name || "";
      const matchesSearch =
        opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clubName.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (selectedCategory === "Saved") {
        return matchesSearch && isBookmarked(opp.id);
      }
      
      const matchesCategory =
        selectedCategory === "All" ||
        opp.type.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortOption) {
        case "deadline":
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        case "popular":
          return (b.applications?.length || 0) - (a.applications?.length || 0);
        default:
          return 0;
      }
    });
}, [opportunities, searchQuery, selectedCategory, sortOption, isBookmarked]);
```

### File: `src/pages/Events.tsx`
```typescript
// Add useMemo import
import { useState, useEffect, useMemo } from "react";

// Wrap filterEventsByDate AND filteredEvents in useMemo
const filteredEvents = useMemo(() => {
  return events.filter((event) => {
    const clubName = event.club_profiles?.club_name || "";
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clubName.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedDateFilter === "Saved") {
      return matchesSearch && isBookmarked(event.id);
    }
    
    // Inline date filtering logic
    const eventDate = new Date(event.event_date);
    const now = new Date();
    let matchesDate = true;
    
    switch (selectedDateFilter) {
      case "This Week":
        matchesDate = isAfter(eventDate, startOfWeek(now)) && isBefore(eventDate, endOfWeek(now));
        break;
      case "This Month":
        matchesDate = isAfter(eventDate, startOfMonth(now)) && isBefore(eventDate, endOfMonth(now));
        break;
      case "Upcoming":
        matchesDate = isAfter(eventDate, now);
        break;
    }
    
    return matchesSearch && matchesDate;
  });
}, [events, searchQuery, selectedDateFilter, isBookmarked]);
```

### File: `src/pages/StudentFeed.tsx`
```typescript
// Add useMemo import
import { useState, useEffect, useMemo } from "react";

// Replace lines 189-194 with:
const filteredItems = useMemo(() => {
  return feedItems.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "opportunities") return item.type === "opportunity";
    if (activeTab === "events") return item.type === "event";
    return true;
  });
}, [feedItems, activeTab]);
```

### File: `src/pages/club/ClubFeed.tsx`
```typescript
// Add useMemo import
import { useState, useEffect, useMemo } from "react";

// Replace lines 137-142 with:
const filteredItems = useMemo(() => {
  return feedItems.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "opportunities") return item.type === "opportunity";
    if (activeTab === "events") return item.type === "event";
    return true;
  });
}, [feedItems, activeTab]);
```

---

## Task 4: Batch Profile Fetches in useMessages.ts

**Problem**: N+1 query pattern - each conversation partner triggers 2 separate API calls (club_profiles + student_profiles), causing waterfall requests.

**Current Issue** (lines 78-79):
```typescript
for (const [partnerId, data] of conversationMap) {
  const profile = await fetchProfileInfo(partnerId);  // N+1 calls!
```

**Solution**: Create a batched profile fetch function.

### File: `src/hooks/useProfileLookup.ts`
Add a new batch function:
```typescript
// Add batch fetch function
const fetchProfileInfoBatch = useCallback(async (userIds: string[]): Promise<Map<string, ProfileInfo>> => {
  const results = new Map<string, ProfileInfo>();
  const uncachedIds = userIds.filter(id => !profileCache.has(id));
  
  // Return cached results for already-known users
  userIds.forEach(id => {
    if (profileCache.has(id)) {
      results.set(id, profileCache.get(id)!);
    }
  });
  
  if (uncachedIds.length === 0) return results;
  
  try {
    // Batch fetch clubs
    const { data: clubProfiles } = await supabase
      .from("club_profiles")
      .select("id, club_name, logo_url, user_id")
      .in("user_id", uncachedIds);
    
    const foundClubUserIds = new Set<string>();
    for (const cp of clubProfiles || []) {
      const info: ProfileInfo = {
        id: cp.id,
        name: cp.club_name,
        avatar: cp.logo_url || undefined,
        isClub: true,
        userId: cp.user_id,
      };
      results.set(cp.user_id, info);
      foundClubUserIds.add(cp.user_id);
    }
    
    // Batch fetch students for remaining IDs
    const remainingIds = uncachedIds.filter(id => !foundClubUserIds.has(id));
    if (remainingIds.length > 0) {
      const { data: studentProfiles } = await supabase
        .from("student_profiles")
        .select("id, full_name, avatar_url, user_id")
        .in("user_id", remainingIds);
      
      for (const sp of studentProfiles || []) {
        const info: ProfileInfo = {
          id: sp.id,
          name: sp.full_name || "Student",
          avatar: sp.avatar_url || undefined,
          isClub: false,
          userId: sp.user_id,
        };
        results.set(sp.user_id, info);
      }
    }
    
    // Update cache
    setProfileCache(prev => {
      const newCache = new Map(prev);
      results.forEach((info, userId) => newCache.set(userId, info));
      return newCache;
    });
  } catch (error) {
    console.error("Error batch fetching profiles:", error);
  }
  
  return results;
}, [profileCache]);

// Return it from hook
return {
  fetchProfileInfo,
  fetchProfileInfoBatch,  // ADD THIS
  profileCache,
  clearCache,
};
```

### File: `src/hooks/useMessages.ts`
Update to use batched fetch:
```typescript
// Update import
const { fetchProfileInfo, fetchProfileInfoBatch } = useProfileLookup();

// Replace lines 76-91 with:
// Batch fetch all profiles at once
const partnerIds = Array.from(conversationMap.keys());
const profiles = await fetchProfileInfoBatch(partnerIds);

// Build conversation list using cached profiles
const conversationList: Conversation[] = [];

for (const [partnerId, data] of conversationMap) {
  const profile = profiles.get(partnerId);
  const lastMsg = data.messages[0];
  
  conversationList.push({
    participantId: partnerId,
    participantName: profile?.name || "Unknown User",
    participantAvatar: profile?.avatar,
    lastMessage: lastMsg.content,
    lastMessageTime: lastMsg.created_at,
    unreadCount: data.unreadCount,
    isClub: profile?.isClub || false,
  });
}
```

---

## Task 5: Add Database Indexes

**Problem**: Missing indexes on frequently-queried columns cause slow lookups at scale.

**Solution**: Create a migration with 18 indexes covering:
- Foreign key columns (club_id, user_id, student_id, event_id, opportunity_id)
- Timestamp columns used for sorting/filtering (created_at, event_date, deadline)
- Status/boolean columns (is_active, status, is_read)

### New Migration: `add_performance_indexes.sql`
```sql
-- =====================================================
-- Performance Indexes for Beta Launch
-- =====================================================

-- OPPORTUNITIES TABLE
CREATE INDEX IF NOT EXISTS idx_opportunities_club_id ON opportunities(club_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_is_active ON opportunities(is_active);
CREATE INDEX IF NOT EXISTS idx_opportunities_deadline ON opportunities(deadline);
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at ON opportunities(created_at DESC);

-- EVENTS TABLE
CREATE INDEX IF NOT EXISTS idx_events_club_id ON events(club_id);
CREATE INDEX IF NOT EXISTS idx_events_is_active ON events(is_active);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

-- APPLICATIONS TABLE
CREATE INDEX IF NOT EXISTS idx_applications_opportunity_id ON applications(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_applications_student_id ON applications(student_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- RSVPS TABLE
CREATE INDEX IF NOT EXISTS idx_rsvps_event_id ON rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_student_id ON rsvps(student_id);

-- MESSAGES TABLE
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- BOOKMARKS TABLE
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_club_id ON bookmarks(club_id);

-- NOTIFICATIONS TABLE
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
```

---

## Implementation Order

| Step | Task | Files Changed |
|------|------|---------------|
| 1 | Add database indexes | New migration file |
| 2 | Add query limits | Opportunities.tsx, Events.tsx, useMessages.ts |
| 3 | Wrap filtering in useMemo | 4 page files |
| 4 | Batch profile fetches | useProfileLookup.ts, useMessages.ts |
| 5 | (Manual) Remove .env from git + rotate keys | User runs locally |

---

## Verification Checklist

After implementation:

- [ ] Pages load < 3s (check Opportunities, Events, Messages)
- [ ] No filter lag when typing in search
- [ ] Single query batch for conversation list profiles (check Network tab)
- [ ] `git log --all -- .env` returns nothing (manual check)
- [ ] No console errors
- [ ] Database indexes visible in Cloud View > Database

---

## Summary

**Files to Create**: 1 (migration file)

**Files to Modify**: 6
- `src/pages/Opportunities.tsx` (limit + useMemo)
- `src/pages/Events.tsx` (limit + useMemo)
- `src/pages/StudentFeed.tsx` (useMemo)
- `src/pages/club/ClubFeed.tsx` (useMemo)
- `src/hooks/useMessages.ts` (limit + batch fetch)
- `src/hooks/useProfileLookup.ts` (batch fetch function)

**Net Impact**:
- Prevents unbounded queries
- Eliminates N+1 profile lookups
- Reduces re-renders on filter changes
- Adds proper database indexes for scale

