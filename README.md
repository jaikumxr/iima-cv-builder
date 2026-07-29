# IIMA CV Builder

A one-page IIM Ahmedabad summers CV builder. Zero build step, static deploy, true
vector PDF output.

Open `index.html` through any static server and start typing. Everything autosaves
to `localStorage`.

```bash
npm run dev      # http://localhost:5173
```

## Why it looks right

The layout isn't eyeballed — it was read out of a real IIMA CV's `.docx`
(`word/document.xml`). Those source files are not in this repo; the measurements
they yielded are recorded below and in `css/cv.css`. Conversions: 1440 twip = 1 in = 25.4 mm, and Word's
`w:sz` is half-points, so `sz=20` is 10 pt.

| Property | Source | Value |
|---|---|---|
| Page | `pgSz`, `pgMar` | A4, 0.5 in margins → content width **184.6 mm** |
| Body type | every `w:sz` in the doc | **Garamond 10 pt** — literally no other size in the body |
| Name | `header1.xml` | **Centaur Bold 23 pt** (not Garamond) |
| Name meta | `header1.xml` | Centaur Bold 15 pt |
| Logo | `wp:extent` | 0.5 in square, right edge flush to the margin |
| Masthead height | `tblpY=1445` | table starts 1.003 in from the page edge |
| Borders | `tblBorders` | single, black |
| Cell padding | `tblCellMar` | left 57 twip, right 28 twip, **top/bottom 0** |
| Bullet indent | `w:ind` | left 176 twip, hanging 153 twip |
| Justification | `jc="distribute"` | every line stretches full width, **including the last** |
| Fills (Ink) | `w:shd` + PDF fills | section `#0D0D0D` · org bar `#BFBFBF` · label col `#D9D9D9` |
| Fills (Slate) | PDF filled rects | section `#BFBFBF` · label col `#D9D9D9` |
| Rules | `tblBorders sz=12` | 1.5 pt (measured 1.4 pt in both PDFs) |

The Slate source was only available as a PDF, so its fills were read out of the
PDF content stream instead — decompress the streams, track the `sc` colour operator,
and record it against each `re … f` filled rectangle. Its heading bar is `#BFBFBF`
and its label column `#D9D9D9`, i.e. one step *darker* than Ink's, not lighter.

Two things worth knowing about the source document:

- **Heading row heights were never standardised.** The section bars in the original
  are `19, 57, 112, 124, 126, 157, 202` twip — all different. Here they're pinned to
  one constant (`--h-section`) and cannot drift.
- **The per-run `<w:spacing w:val="-8..9"/>` values are hand-tuned letter-spacing**,
  used to stop a bullet spilling onto a second line. That is now automatic and
  unconditional — see *One line per bullet* below.

## Features

- **Themes** — Ink (black bar, white text), Slate (light bar, black small-caps),
  Charcoal. Set with one CSS custom property block each.
- **Layout presets** — Consulting leads with Educational Background then
  Professional Experience; Product Management leads with Work then Internships.
  A preset only sets a starting order: nothing is pinned afterwards, and every
  section stays free to drag, rename or switch off.
- **Toggleable sections** — nobody has content for all ten. Flip any off.
- **Sub-headings** — horizontal (a label cell) or welded into a **vertical
  connector** spanning two or more sub-groups, as in the light sample's
  *Responsibilities* block.
- **Metric highlighting** — numbers, percentages, currency, ratios and durations
  bold automatically. Click any highlighted token in the preview to mute it.
  `**asterisks**` or Ctrl+B force bold on anything else. Bare years are never
  auto-bolded, matching both source CVs.
- **Fit meter** — live mm-accurate readout of how much of the A4 page is used, and
  how many lines to cut if you're over.
- **Density** — four line-height steps (1.28 / 1.23 / 1.17 / 1.11). `Normal` is the
  1.23 measured from the source. Drop a step when a dense CV runs a few mm over.
- **One line per bullet** — a wrapped bullet breaks the row rhythm the grid
  depends on, so it is a hard rule, not a preference. Two levers in order of what
  they cost: **word-spacing** first (bullets are `text-align-last: justify`, so a
  line that fits is stretched back to full width and the compression is absorbed
  — visually free, floor −1 pt), then **letter-spacing** (visible, floor
  −0.40 pt). Together that buys roughly four extra words. Past both floors the
  text is simply too long: the bullet gets its space back and the editor shows a
  ⚠ with *Reduce text*, on the bullet and as a count on its section header,
  since sections start collapsed.
- **One page, guaranteed** — overflow is corrected, not just reported. Letter-spacing
  is tried first (free, invisible), then a uniform type scale found by binary search:
  7 probes resolve it to ~0.2%, below what a reader notices. Floor is 78%, past which
  10 pt Garamond stops being comfortably legible in print — there the fit meter says
  how many lines to cut instead of shrinking into unreadability. Every probe must
  reproduce the *final* layout including `alignYears()`, since pinning a year to its
  bullet's height can grow a row.
- **Single-line cells** — education and interests rows are one line each in both
  references, and a wrapped one wrecks the row's rhythm. Those cells are `nowrap`.
  Type size never varies between cells: the only automatic remedy is tracking, a
  hair of letter-spacing that reads as the same size. If that is not enough the
  fix is a wider column, not smaller text — hence the sliders.
- **Column widths** — sliders for Label, Connector, School, Score and Year, with
  defaults from the source proportions. The education *detail* column is flex:1
  and absorbs whatever the others give up, so narrowing School widens it.
  **Fit to content** measures what each column's widest cell actually needs —
  `max-content` for nowrap cells, `min-content` (longest word) for label cells,
  since those wrap — reserves the detail column's requirement, and gives School
  the remainder.
- **Border weight** — one token drives every rule in the grid, so weights can never
  go mixed. Integer CSS pixels only: Chrome snaps borders to whole *device* pixels,
  so a fractional width renders 1px in the preview but 1.67px at print DPI, and the
  fit meter would under-predict the printed page. `Thin` (1px) is the default;
  `Word-exact` (2px = 1.5pt) is literally what the source specifies but costs about
  8 mm of page height across ~31 rows, which is enough to push a full CV onto a
  second page.
- **Reorder** — drag or arrow-key everything: sections, organisations,
  sub-headings, individual bullets.

## PDF export

`Download PDF` opens the browser print dialog. That path produces real vector text
at exact A4 — sharp, selectable, ATS-readable — which a canvas-based exporter
cannot. In the dialog: **Save as PDF**, margins **None**, headers/footers **off**,
background graphics **on**.

## Layout

```
index.html            app shell
css/cv.css            the CV — drives both preview and print
css/app.css           builder chrome, hidden at print
js/schema.js          data model, section catalogue, presets
js/render.js          data -> DOM
js/editor.js          authoring pane
js/metrics.js         metric detection, manual bold, one-line fitting
js/store.js           state, undo, autosave, JSON import/export
js/sortable.js        drag-to-reorder
js/samples.js         two mock CVs, one per heading style
dev/preview.html      1:1 fidelity harness — ?sample=dark|light
```

The CV is built from flex rows, not `<table>`: exact mm column widths with no
colspan arithmetic, and vertical connectors become plain nesting instead of
`vMerge`. Collapsed borders are faked with `border-top` on rows and `border-left`
on cells.

## Fonts

Body is **Monotype Garamond MT** — the exact face the source document was authored
in, so line breaks match Word's. EB Garamond sits behind it as a glyph-coverage
fallback; it sets about **3.7% wider** (291.89px vs 303.17px on the same probe
string), which was enough on its own to force 7 extra line-wraps on one sample CV
and 19 on the other.

Fonts must be loaded *before* anything is measured. `document.fonts.ready` is not
sufficient: with `font-display: block` no face is requested until an element uses
it, so `ready` resolves instantly and every measurement lands on fallback metrics.
`ensureFonts()` in `render.js` asks for each face by name first — do not remove it.

Centaur ships as a single Regular face with no bold companion — there is no
Centaur Bold in the Windows font directory or in Office's private font folder,
which is why Word synthesises bold for the masthead. Its `@font-face` must
therefore declare `font-weight: 400` and *not* a `400 700` range: declaring the
range tells the browser the face already covers bold, and `font-weight: 700`
then silently renders plain Regular.

Synthetic bold is all-or-nothing, so weight beyond it comes from stroking the
outline — `--name-stroke`, in `em` so the 23 pt name and 15 pt meta thicken in
proportion. Raise it for more weight, `0` for none. If you ever obtain a real
Centaur Bold, add it as a second `@font-face` at `font-weight: 700` and set
`--name-stroke: 0`; a drawn bold beats a fattened outline.

`Centaur.ttf` and `GaramondMT-*.ttf` come from a local Microsoft Office install.
**Check your licence before making the deploy public.**

## Not built yet

- **DOCX export.** The plan is to hand-write the OOXML rather than pull in a
  library — the exact `tcPr`/`shd`/`gridSpan` structure is already known from the
  source document, and a store-method ZIP writer is ~80 lines.
