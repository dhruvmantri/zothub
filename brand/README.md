# ZotHub brand kit

Canonical, ready-to-use brand assets. The runtime copies the app actually serves
live in `/public` (`favicon.*`, `apple-touch-icon.png`, `icon-*.png`,
`og-image.png`, `site.webmanifest`); this folder is the collection to grab from
for social posts, decks, and press.

Every glyph here is **Instrument Sans (weight 700), outlined to vector paths** —
no runtime font dependency, crisp at any size, theme-correct.

## The identity

- **Wordmark** — `zot` upright + `hub` *italic*, one line. The italic is the
  signature gesture; never stack the inline wordmark in running text.
- **Stacked disc mark** — `zot` over italic `hub` on a disc. Used for avatar,
  app icon, favicon, social. Never put the inline wordmark in a disc.
- No UCI seal / gold / anteater — the only UCI-adjacent cue is the Pacific-blue accent.

## Colors

| Role | Hex |
|---|---|
| Disc fill (dark mark) | `#101112` |
| `zot` on dark | `#F5F5F6` |
| italic `hub` on dark | `#5AA2E6` |
| `zot` on light | `#14171B` |
| italic `hub` on light | `#0F5FA8` |
| Accent (Pacific blue) — light / dark | `#0F5FA8` / `#5AA2E6` |
| Page dark bg | `#0E0F10` |

## Files

| File | Use |
|---|---|
| `mark-dark.svg`, `mark-dark-512/1024.png` | disc mark on transparent — dark |
| `mark-light.svg`, `mark-light-512.png` | disc mark on transparent — light |
| `mark-appicon.svg` | full-bleed dark square (app / home-screen) |
| `wordmark-dark.svg` / `-x2.png` | inline wordmark for dark backgrounds |
| `wordmark-light.svg` / `-x2.png` | inline wordmark for light backgrounds |
| `og-image.png` | 1200×630 social / link-preview card (dark — primary) |
| `og-image-light.png` | 1200×630 social card (light — alternate) |
| `favicon.ico` / `.svg`, `favicon-16/32/48/64.png` | favicons |
| `apple-touch-icon.png` | 180×180 iOS home-screen icon |

Regenerate with `generator/` (fontkit → outlined SVG → resvg):

```bash
cd brand/generator && npm install && node generate.js
```

Output lands in `brand/generator/dist/`; copy the runtime files to `/public` and
the kit files here. Do not hand-edit the outlined paths — change `generate.js` and
re-run. See `generator/README.md`.
