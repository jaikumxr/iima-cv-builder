# IIMA CV Builder

Write an IIM Ahmedabad CV in your browser and download it as a PDF or a
Word file. The formatting is fixed to the IIMA one-page format, so you only
have to write the words.

Nothing is uploaded anywhere. Your CV is saved in your own browser.

## Starting it

```bash
npm run dev
```

Then open **http://localhost:5173**. There is no sign-up and no build step.

The screen has two halves. You **type on the left** and the **finished CV
appears on the right**, exactly as it will print. Everything saves as you type.

If you have never used it before, press **Load sample…** in the top right to see
a filled-in CV, then press **New** when you want to start your own.

---

## The top bar

| Control | What it does |
|---|---|
| **Layout** | Reorders your sections for a type of role. *Consulting* leads with education, *Product Management* leads with work experience. It only sets a starting order — you can drag anything afterwards. |
| **Theme** | The colour of the heading bars. *Ink* is black with white text, *Slate* is grey with black text, *Charcoal* sits between them. Colour only; nothing moves. |
| **Line spacing** | Space between lines. **Single** is the tightest allowed and is the default. The looser steps (1.025, 1.05, 1.075) add air if your CV is short. |
| **Borders** | Thickness of the grid lines. *Thin* is the default. *Word-exact* matches the original document but costs about 8 mm of page height, which can push a full CV onto a second page. |
| **Bullet** | Size of the dot in front of every bullet, for the whole CV. *10 pt* matches the body text and is the default; *9.5 pt* is a slightly smaller dot. One setting for the whole document on purpose — a CV with two sizes of dot in it looks like a mistake. Neither option changes the height of a line, so this never costs you page space. |
| **metrics** | Automatically bolds numbers, percentages, money and ratios in your bullets. On by default. |
| **gridlines** | Draws Word's grid and the page margins over the preview, so you can check nothing sits outside the margins. A viewing aid only — it never appears in the PDF or the Word file. |
| **Load sample…** | Fills the builder with one of two example CVs. This replaces what you have. |
| **New** | Empties everything and starts a blank CV. |
| **Import / Export** | Saves your CV to a `.json` file, or loads one back. Use this to move between computers or keep a backup. This is *not* the CV itself — for that, use the two buttons below. |
| **Download DOCX** | The Word file. |
| **Download PDF** | The PDF. This is the one to send to recruiters. |

---

## The left pane

### Column widths

Five sliders for the widths of the grid: **Label**, **Connector**, **School**,
**Score** and **Year**.

The education *detail* column is not in the list on purpose — it takes whatever
the others leave over. So if a detail line is cramped, make **School** narrower
and the detail column widens to match.

- **Fit to content** sets every column to the narrowest width its own longest
  entry can live in.
- **Reset** puts them back to the original document's proportions.

### Masthead

One slider: the **height** of the band at the top holding your name and the
logo. Your name and the logo are always flush to the top and outer margins —
that part is not adjustable, because sitting outside the margins is a formatting
error. The slider only sets how much room they have, and the logo grows and
shrinks with it.

The two ends are the two real CVs this format was measured from: tight on the
left, airy on the right.

### Identity and contact bar

Your name, programme, gender and age go across the top of the CV. Phone, address
and email go in the bar along the bottom. Leave anything blank and it is left
out.

### Sections

Every section is a row you can switch off, rename, or drag by the handle on the
left. Ten are available and nobody uses all of them.

Three checkboxes appear on some sections:

- **year** — adds a year column down the right-hand side.
- **inline bar** — folds the first organisation's name into the section heading
  itself, so the heading and the employer read as one bar.
- **split bar** — spreads the grey organisation bar across three positions:
  employer on the left, **designation in the middle**, dates on the right.
  Without it the designation simply follows the employer after a dash.

Open a section with the arrow on the right to edit its content. Inside, you can
add organisations, sub-headings and bullets, and drag any of them into a
different order — with the mouse or with the arrow keys.

**Organisation, designation and dates are three separate boxes** on every work
or internship entry, whichever way the bar is drawn. Nothing is lost by
switching, so try both.

One thing to watch with **split bar**: the middle is a fixed position, not
"whatever space is left". If the employer's name reaches it, the designation
ends up hard against the employer with no gap — in the Word file as well as the
preview, which is why the preview shows it rather than hiding it. Shorten the
employer, or move the duration into the dates box.

**Sub-headings** can be plain, or welded together into a **vertical connector**:
one rotated label spanning two or more sub-groups. The *Responsibilities* block
in the light sample shows what that looks like.

### Writing bullets

- Type normally. Numbers and percentages bold themselves.
- **Ctrl+B** bolds whatever you have selected. Wrapping text in `**asterisks**`
  does the same thing.
- If the builder bolded something you did not want bolded, **click it in the
  preview** to switch it off.
- **Ctrl+Z** undoes.

---

## Rules the builder enforces for you

These are part of the IIMA format, so the builder holds them for you rather than
leaving them to chance.

**Every bullet is one line.** A bullet that wraps breaks the rhythm of the grid.
When one runs slightly long, the builder tightens the spacing inside that line
by an amount too small to see — enough for roughly four extra words. Past that
the text is genuinely too long, and you get a ⚠ **Reduce text** warning on the
bullet, plus a count on its section heading so you can find it while the section
is collapsed. Shorten the sentence; nothing else will fix it.

**The type size never changes.** Garamond 10 pt in the body, 20 pt for your
name, 14 pt for the details beside it. The builder will never quietly shrink
your CV to make it fit, because a CV that arrives at 9.5 pt has failed the
format even though it fits on the page.

**Section headings are always capitals.** Type them however you like; they are
capitalised in the output. An inline bar's organisation and dates are left
exactly as you typed them.

**Education and interests rows stay on one line each.** If one is too long for
its column, widen the column — that is what the sliders are for.

---

## Getting it onto one page

The bar above the preview is the **fit meter**. It tells you how much of the
page you have used, and if you are over, roughly how many lines to cut. A
shaded band appears on the preview showing exactly what is falling off the page.

If you are over, in the order worth trying:

1. **Cut a bullet or two.** Always the best answer.
2. **Shorten any bullet showing ⚠ Reduce text.**
3. **Switch off a section** you can afford to lose.
4. **Set Line spacing to Single**, if it is not already.
5. **Set Borders to Thin**, if it is not already.

There is deliberately no "shrink to fit". See above.

---

## Exporting

### PDF — the one to send

Press **Download PDF**. Your browser's print dialog opens. Set:

- **Destination**: *Save as PDF* — **not** *Microsoft Print to PDF*, which sits
  next to it in the list and produces a flat picture of a CV that no recruiting
  system can read.
- **Margins**: *None*. The CV carries its own margins.
- **Headers and footers**: off.
- **Background graphics**: on, or the heading bars print white.

This gives real, selectable, searchable text at exact A4 size, which is what
recruiters' CV-scanning software needs.

### Word

Press **Download DOCX**. You get a real Word document — a table with proper
borders, real bullets and correct fonts — not a picture.

Neither output shrinks type to fit — 10 pt is the size the format specifies. If
your CV needs more than one page, the builder warns you before writing the file
rather than quietly handing over a two-page CV.

The Word file expects **Garamond** and **Symbol** to be installed, which they
are on any machine with Microsoft Office. Opening it somewhere without them will
substitute other fonts and the line breaks will move.

---

## Your data

Your CV lives in your browser's local storage on this computer only. It is not
sent anywhere.

- **Export** writes it to a `.json` file — your backup, and how you move it
  between machines.
- **Import** reads one back.
- **Reset saved data** (top of the left pane) clears the browser's copy. There
  is no undo for that, so export first.

---

## For developers

The layout is not eyeballed — every measurement was read out of real IIMA CVs'
Word files and PDFs. Those measurements live as constants in `css/cv.css`
and `js/schema.js` — with the provenance in the comments — and both renderers
read them from there,
so change a number in one place and both the preview and the Word export follow.

```
index.html        the app
css/cv.css        the CV itself — drives both the preview and the print output
css/app.css       the builder's own interface, hidden when printing
js/schema.js      the data model and all the option tables
js/render.js      data -> what you see
js/editor.js      the authoring pane
js/metrics.js     auto-bolding and the one-line-per-bullet fitting
js/docx.js        the Word export, written as raw OOXML
js/zip.js         a minimal ZIP writer, so the DOCX needs no library
js/store.js       saving, undo, import/export
js/samples.js     the two example CVs — invented, not real people
dev/preview.html  1:1 rendering harness with every measurement printed
dev/docx.html     builds a DOCX and checks it part by part
```

No build step, no framework, no dependencies in the shipped app.
