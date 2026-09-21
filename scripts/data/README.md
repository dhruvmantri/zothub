# `scripts/data/`

## `zotspot_club_manifest.json`

The ZotSpot export the 724 seeded clubs came from. Committed 2026-09-21 with
the maintainer's approval, so the seed and the logo re-host are repeatable
without hunting for the file again.

**Checked before committing.** Nine fields per record — `source`,
`source_club_id`, `source_url`, `club_name`, `category`, `description`,
`logo_url`, `website_url`, `category_review_required`. **No contact fields,
no officer names, no member data.** Four *club* email addresses appear inside
free-text descriptions (e.g. `archery@uci.edu`); they are organisational
addresses already published on UCI's own public club directory, which is where
this data came from, and the same text is already in `club_profiles.description`
in production and rendered on the club pages. Committing it therefore adds no
exposure that did not already exist.

Used by:

```bash
node scripts/verify_logo_manifest.mjs scripts/data/zotspot_club_manifest.json --check-urls --all
node scripts/rehost_club_logos.mjs   scripts/data/zotspot_club_manifest.json --limit=5 --commit
node scripts/seed_clubs.mjs          scripts/data/zotspot_club_manifest.json
```

Note the `logo_url` in here is ZotSpot's **100×100** variant. `rehost_club_logos.mjs`
deliberately fetches the 320×320 one from the same path — see `MB5-logo` in
`docs/BACKLOG.md` for why.
