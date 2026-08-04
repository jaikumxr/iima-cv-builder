# The format, and where every number came from

`README.md` explains what the builder does. This explains *why the output looks
the way it does*, and which parts are dangerous to change. It is for whoever
maintains this, not for someone writing a CV.

Two reference CVs were measured to build it, called **reference A** and
**reference B** throughout. They are real people's documents and are not in this
repo; only the measurements they yielded are. Reference A has the tight
masthead, reference B the airy one, and where they disagree the disagreement is
usually exposed as a control rather than resolved.

Conversions used everywhere: **1440 twip = 1 in = 25.4 mm**, and Word's `w:sz`
is half-points, so `sz=20` is 10 pt.

## Read out of the source documents

| Property | Source | Value |
|---|---|---|
| Page | `pgSz`, `pgMar` | A4, 0.5 in margins → content width **184.6 mm** |
| Body type | every `w:sz` in the doc | **Garamond 10 pt** — literally no other size in the body |
| Name | `header1.xml` | Centaur Bold 23 pt in the source; **Garamond Bold 20 pt** here |
| Name details | `header1.xml` | Centaur Bold 15 pt in the source; **Garamond Bold 14 pt** here |
| Logo | `wp:extent` | 0.5 in square, right edge flush to the margin |
| Masthead height | `tblpY` | table starts 1.003 in from the page edge |
| Borders | `tblBorders` | single, black |
| Cell padding | `tblCellMar` | left 57 twip, right 28 twip, **top/bottom 0** |
| Bullet indent | `w:ind` | left 176 twip, hanging 153 twip |
| Justification | `jc="distribute"` | every line stretches full width, **including the last** |
| Fills (Ink) | `w:shd` + PDF fills | section `#0D0D0D` · org bar `#BFBFBF` · label col `#D9D9D9` |
| Fills (Slate) | PDF filled rects | section `#BFBFBF` · label col `#D9D9D9` |
| Rules | `tblBorders sz=12` | 1.5 pt (measured 1.4 pt in both PDFs) |

The Slate reference existed only as a PDF, so its fills were read out of the PDF
content stream instead — decompress the streams, track the `sc` colour operator,
and record it against each `re … f` filled rectangle. Its heading bar is
`#BFBFBF` and its label column `#D9D9D9`, i.e. one step *darker* than Ink's, not
lighter.

Two things about the source worth knowing:

- **Heading row heights were never standardised.** The section bars in the
  original are `19, 57, 112, 124, 126, 157, 202` twip — all different. Here they
  are pinned to one constant (`--h-section`) and cannot drift.
- **The per-run `<w:spacing w:val="-8..9"/>` values are hand-tuned
  letter-spacing**, used to stop a bullet spilling onto a second line. That is
  now automatic and unconditional.

## Deliberate departures from the references

- **One family.** The masthead was Centaur MT Bold in both references. It is
  Garamond now, at the CV author's instruction, so the whole document is one
  family at three sizes. `cv.css` records what to put back if that is ever
  reversed. This also retired `--name-stroke`, which existed only because
  Centaur ships no bold companion and Word synthesises one.
- **A flush masthead.** Neither reference is flush: reference A's logo starts
  1.98 mm above the top margin and its name's capitals 1.84 mm above it, and in
  Word the table's own left border hung 1.14 mm outside the left margin. All
  three are corrected here.
- **Line spacing never below single.** See below.
- **Standardised row heights**, per the note above.
- **An optional three-part organisation bar**, per section. Both references put
  the role after the employer in one run; *split bar* offers the arrangement in
  which the role sits on the bar's centre line instead. Off by default, so the
  references' arrangement is still what a CV gets unless it is asked for.
- **A 9.5 pt bullet marker** as an alternative to the references' 10 pt.

## The organisation bar

Three facts — employer, role, dates — in one of two arrangements, chosen per
section by `section.splitBar`:

```
off (default)   ORGANISATION – ROLE ......................... dates
on              ORGANISATION ....... ROLE ................... dates
```

The join is `schema.js`'s `barParts()`, not either renderer's, for the same
reason `sectionTitle()` is: decided once, drawn twice. It also makes the toggle
non-destructive — `role` is a field of the entry either way, and with split off
it runs on after the organisation exactly as it would read had the two been
typed into one box.

**The centre is the row's text area, not its box.** In Word the role sits on a
centre tab stop at half of `textW` — the cell less both cell margins — so
`cv.css` centres `.cv-bar__role` at `50% + (--pad-l − --pad-r)/2`, which is the
same x. Centring it with `justify-content` instead would put it in the middle of
whatever the employer and dates left over: a different position on every CV and
the right one on none. Measured against Word's own render: role ink left
94.33 mm in Word, 94.22 mm in the preview.

**A tab cannot move the pen backwards, and that is visible.** When the employer
already runs past the centre stop, Word does not advance the role to the next
stop — it butts it straight onto the end of the employer with *no* gap:
`…Private Limited (30 Months)Product Analyst II (PPO-UG)`. Measured in Word on
both samples at `?split=1`. `render.js`'s `placeBarRoles()` reproduces exactly
that, rather than letting the preview overprint the two and look tidier than the
export. It is meant to look wrong; the fix is a shorter string, and the author
can only make it if the preview stops hiding the collision.

## The flush masthead

Three separate things had to be fixed, and each is easy to undo by accident.

**`tblInd` is the left cell margin, not zero.** Word measures `tblInd` to the
leading edge of the first cell's *text*, not to its border, so at 0 the border
hangs `tblCellMar/left` (plus half a stroke) into the margin.

**Two corrections are measured, not tabulated**, because they are properties of
the *string* rather than of the font: how far this name's tallest ink rises
above its baseline, and how far its first capital hangs left of its own origin
(Garamond's "J" hangs 0.25 mm; "H" does not). `render.js`'s `mastheadFlush()`
measures both on canvas, and `docx.js` reads those numbers back off the rendered
page rather than recomputing them — which is what stops the preview and the
export correcting by different amounts.

**`NAME_FIRST_BASELINE_MM` is Word-specific and empirical.** It is Word's own
first-baseline offset for a 20 pt Garamond Bold line. If the masthead's font or
size changes, re-measure it: export, render through Word to PDF, rasterise, read
the name's topmost ink, and subtract however far that lands above the 12.7 mm
margin.

What remains adjustable is the band's *height*, from the top margin to the
table. The two references are its ends — 8.44 mm (A) to 12.80 mm (B) — and the
logo is a square that fills it, so a taller band means a bigger logo and more
air under the name. The 9.98 mm default is neither reference: it is reference
A's logo diameter, picked so the logo keeps the size it always had while
becoming flush.

## Line spacing

Stated in **Word's unit**, not CSS's, because that is the number anyone checking
the CV reads off Word's paragraph dialog.

The two are not the same. A CSS line-height multiplies the *font size*; Word's
multiple is of the font's own single line, which for Garamond 10 pt is about
1.26× the font size. An earlier ladder of CSS line-heights (1.28 / 1.23 / 1.17 /
1.11) was, in Word's terms, 1.04 / 1.00 / **0.95** / **0.90** — two settings
below single, which review rejected.

So the DOCX writes `w:lineRule="auto"` with `w:line = 240 × multiple`, and Word
reads "Single" or "Multiple". Three consequences:

- **`SINGLE_LH` in `schema.js` is measured off Word**, not computed. Handing the
  pitch to Word means taking Word's number. It is calibrated until the fit
  meter's prediction matches the table height Word actually renders — currently
  agreeing to 0.01 mm across a full page.
- **Bar rows are pinned at single** rather than taking the body spacing, because
  `cv.css` gives them `line-height: 1` and a fixed height. Without that, raising
  the spacing grew them in Word but not in the preview.
- **The one paragraph not at single is the empty spacer** Word requires after a
  table, held at an exact 1 pt. At single, its 12 pt line lands past the bottom
  margin — the table floats with `wrapSquare`, so Word pushes the spacer below
  it — and takes a full CV onto a second page. It carries no text.

The steps are 0.025 apart because the usable range on a one-page format is that
narrow: a round 1.1 / 1.2 / 1.3 ladder puts both samples onto two pages by 1.2.

## One line per bullet

A wrapped bullet breaks the row rhythm the grid depends on, so this is a hard
rule. Two levers, in order of what they cost:

1. **word-spacing** — bullets are `text-align-last: justify`, so a line that
   fits is stretched back to full width and the compression is absorbed. Free to
   look at. Floor −1 pt.
2. **letter-spacing** — visible. Floor −0.40 pt.

Together they buy roughly four extra words. Past both floors the bullet gets its
space back and is flagged.

**The DOCX re-fits with the word-spacing lever switched off**, because Word has
no such control. This is not a transcription gap — it is the bug that blocked
the DOCX export for a while. On a real CV, word-spacing alone fits nearly every
bullet, so the bullets reached Word carrying *nothing*, arrived at their natural
width, and wrapped; and because `jc="distribute"` stretches the orphaned tail
across the full column, the result read `C a n n o n`. Refitting with
`fitBulletsToOneLine(page, safety, 0)` converts the whole requirement into
letter-spacing, which goes out as `<w:spacing>` in twentieths of a point — the
same units and the same −8..+11 range as the source document's own hand tuning.

The value is quantised **away from zero**, never to nearest: one twentieth of a
point across a ~100-character bullet is ~1.8 mm of line, more than the safety
margin has to give back.

## The bullet marker

A **real list marker** (`word/numbering.xml` + `numPr`), not a `•` typed into
the text. With `jc="distribute"`, Word stretches the line's own whitespace to
fill the column, and on a bullet with slack that swallowed the tab after a
literal bullet and carried the dot several mm right — so the first bullet of a
group sat visibly out of line. A `numPr` marker is drawn by the list machinery
at the indent, outside the text being justified, and cannot move.

It is **Symbol's `F0B7`** — Word's own bullet — while the bullet's *text* stays
Garamond 10 pt. Garamond's own `U+2022` is a much smaller dot and read as
undersized. `cv.css` draws the identical glyph from `local("Symbol")`, confined
by `unicode-range` to that one codepoint so the family cannot leak into other
text. The content must be the private-use `F0B7`: asking for `U+2022` in Symbol
falls through to the next family and quietly gives Garamond's small dot back.

**Do not size the marker above body size.** Its inline box is `line-height × its
own font-size`, so a `1.05em` marker made *every* bullet line 5% taller than the
rest of the CV — about 10 mm on a full page — while Word ignored it entirely,
because its bullet paragraphs use exact line spacing.

That is why `BULLET_SIZES` in `schema.js` has 10 pt at its **top** and offers
only a smaller alternative, 9.5 pt. The rungs are halves because Word's `w:sz`
is half-points, so `numbering.xml` states 9.5 pt as `sz=19` exactly, with no
rounding for `cv.css`'s `--bullet-fs` to disagree with. Below body size the line
box is decided by the text, so the smaller rung costs nothing: measured, both
samples render the same 291.8 / 292.1 mm at either setting, and Word reports the
same line count. The dot itself measures 1.235 mm tall at 10 pt and 1.190 mm at
9.5 pt in Word's own render, against 1.256 / 1.190 mm in the preview.

It is **one setting for the whole CV**, exposed in the top bar and nowhere else.
Per-section or per-bullet marker sizes would only ever produce a document with
two sizes of dot in it, which is a formatting error rather than a choice.

## Fonts

Body is **Monotype Garamond MT**, the exact face the source was authored in, so
line breaks match Word's. EB Garamond sits behind it as glyph-coverage fallback;
it sets about **3.7% wider** on the same probe string, which alone forced 7
extra line-wraps on one sample CV and 19 on the other.

Fonts must be loaded *before* anything is measured. `document.fonts.ready` is
not sufficient: with `font-display: block` nothing requests a face until an
element uses it, so `ready` resolves instantly and every measurement lands on
fallback metrics. `ensureFonts()` in `render.js` asks for each face by name
first — do not remove it.

`Garamond-*.ttf` come from a local Microsoft Office install. **Check the licence
before making a deploy public.**

## Structure

The CV is built from flex rows, not `<table>`: exact mm column widths with no
colspan arithmetic, and vertical connectors become plain nesting instead of
`vMerge`. Collapsed borders are faked with `border-top` on rows and `border-left`
on cells.

The DOCX is hand-built OOXML (`js/docx.js`) over a store-method ZIP writer
(`js/zip.js`) — no library. `js/schema.js` stays the single source of truth and
`metrics.js` exposes `textRuns()`, so *what is bold* is decided once and drawn
twice, as HTML and as `<w:r>`. The table is page-anchored (`vertAnchor="page"`),
which is what actually produces the gap under the masthead, and its grid is the
union of every boundary any row uses, so every row divides it exactly whatever
the interests row's cell count is.

## Checking a change

Two harnesses, and they must both be run on both samples:

```
dev/preview.html?sample=dark      1:1 render with every invariant printed
dev/docx.html?sample=dark         builds the DOCX and checks it part by part
```

Useful parameters: `?spares=1` on the DOCX harness lists every bullet's spare
column width, which is how the samples are kept running close to full width;
`?density=` exercises both ends of the line-spacing range; `?stress=N` pads a
bullet to test the one-line floors; `?bullet=9.5` and `?split=1` exercise the
two settings the samples do not ship with — both harnesses take all four.

**Neither harness is Word.** They are Chrome measuring Chrome, and the wrap bug
lived in exactly that gap. Anything affecting output fidelity gets opened in
real Word before it is believed.
