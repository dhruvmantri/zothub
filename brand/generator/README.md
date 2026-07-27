# Brand asset generator

Regenerates the full ZotHub brand set by **outlining Instrument Sans glyphs to
vector paths** (no runtime font dependency), then rasterizing.

```bash
cd brand/generator
npm install          # fontkit, @resvg/resvg-js, png-to-ico (local only, not app deps)
node generate.js     # → brand/generator/dist/
```

Then copy the runtime files (`favicon.*`, `apple-touch-icon.png`, `icon-*.png`,
`og-image.png`) to `/public`, and the kit files (`brand-kit/*`, both `og-*`) to
`/brand`.

Pipeline: `fontkit` loads the TTF, `getVariation({wght:700})`, lays out `zot`
(upright) + `hub` (italic) and emits glyph outlines → composed SVG (disc mark,
app icon, wordmark, OG card) → `@resvg/resvg-js` PNGs → `png-to-ico` favicon.ico.
Edit `generate.js` to change sizes, colors, or the OG copy — never hand-edit the
outputs.

## Fonts

`InstrumentSans.ttf` / `InstrumentSans-Italic.ttf` are the full variable fonts
(**SIL Open Font License 1.1**, © The Instrument Sans Project Authors), from
<https://fonts.google.com/specimen/Instrument+Sans>. Included so outlining is
reproducible without a network fetch; the app itself ships the subset woff2 in
`/public/fonts`. Redistributed under the OFL — keep this notice with the files.

## Colors (source of truth: `src/index.css` tokens)

disc `#101112` · `zot` on dark `#F5F5F6` · italic `hub` on dark `#5AA2E6` ·
`zot` on light `#14171B` · `hub` on light `#0F5FA8` · dark page bg `#0E0F10`.
