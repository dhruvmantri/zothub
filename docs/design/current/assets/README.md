# Hero art

`direction-11-v4-uci.html` loads its landing hero from **`hero-campus.jpg`** in this folder.

## To add the image
Save the UCI Student Center photo here as exactly:

```
docs/design/current/assets/hero-campus.jpg
```

The hero has a graceful fallback (a warm campus-toned gradient), so the page never
breaks if the file is missing — but the real photo only appears once it's at that path.

## Notes for production
- **Licensing:** this is a UCI campus photograph. Before the site goes public it needs to be
  a properly licensed image, an own/commissioned shot, or a commissioned illustration.
  It must not be a scraped UCI marketing asset. (For the private mockup it's a reference.)
- **Format/size:** export **WebP or AVIF**, ~1600px wide, and lazy-decode it. A hero photo is
  the single heaviest asset on the landing (perf gate: landing JS ≤ ~200KB).
- **Scrim:** the dark left/bottom scrim is baked into the layout so the white headline,
  light-blue italic, and subhead all clear WCAG AA over the image. Don't remove it.
- **Composition:** the photo is positioned `object-position: 50% 44%` (centred on the courtyard /
  anteater statue). Text sits on the scrimmed left; the statue, buildings, and sky read through
  on the right. Adjust `object-position` in the CSS if a different crop is wanted.
