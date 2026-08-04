/* schema.js — the CV data model, plus section/layout presets.
   The data model is the single source of truth; render.js turns it into DOM
   and (later) docx.js turns the same data into OOXML. */

export const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------- constructors ---------- */

export const mkBullet = (text = '') => ({ id: uid(), text, mute: [] });

export const mkGroup = (label = '', bullets = []) => ({
  id: uid(),
  type: 'group',
  label,
  bullets: bullets.map(b => (typeof b === 'string' ? mkBullet(b) : b)),
  years: [],
  year: ''
});

/* A cluster is 2+ groups welded together under one vertical connector label —
   the light sample's "Responsibilities" spanning "Execution & Coordination" and
   "Validation & Risk Management". */
export const mkCluster = (label = 'Responsibilities', groups = []) => ({
  id: uid(),
  type: 'cluster',
  label,
  orientation: 'vertical',
  groups: groups.length ? groups : [mkGroup('Sub-heading 1'), mkGroup('Sub-heading 2')]
});

/* An organisation and what you did there. `role` is a separate field rather
   than part of `org` so the bar can put it in the middle — see barParts and
   SPLIT_BAR below. It is appended to the organisation when the section is not
   split, so switching the toggle off never loses what was typed. */
export const mkEntry = (org = '', dates = '', blocks = [], role = '') => ({
  id: uid(),
  org,
  role,
  dates,
  blocks: blocks.length ? blocks : [mkGroup('')]
});

export const mkEduRow = (degree = '', institute = '', score = '', detail = '', year = '') =>
  ({ id: uid(), degree, institute, score, detail, year });

export const mkSection = (key, title, kind, extra = {}) => ({
  id: uid(),
  key,
  title,
  kind,                  // 'experience' | 'list' | 'education' | 'interests'
  enabled: true,
  showYear: kind === 'list',
  entries: [],
  blocks: [],
  rows: [],
  items: [],
  label: '',
  ...extra
});

/* ---------- the canonical section catalogue ---------- */
/* Every CV is assembled from these. `kind` decides the row shape. */

export const SECTION_CATALOGUE = [
  { key: 'work',           title: 'Professional Experience',         kind: 'experience' },
  { key: 'internship',     title: 'Internship Experience',           kind: 'experience' },
  { key: 'education',      title: 'Educational Background',          kind: 'education'  },
  { key: 'por',            title: 'Positions of Responsibility',     kind: 'list'       },
  { key: 'cocurricular',   title: 'Co-Curricular Achievements',      kind: 'list'       },
  { key: 'extracurricular',title: 'Extra-Curricular Achievements',   kind: 'list'       },
  { key: 'scholastic',     title: 'Scholastic Achievements',         kind: 'list'       },
  { key: 'projects',       title: 'Projects and Internships',        kind: 'list'       },
  { key: 'certifications', title: 'Certifications',                  kind: 'list'       },
  { key: 'interests',      title: 'Interests',                       kind: 'interests'  }
];

/* ---------- layout presets ---------- */
/* A preset applies a conventional starting order for a CV archetype. That is
   all it does: nothing is pinned afterwards, and every section stays free to
   drag, rename or switch off. */

export const LAYOUT_PRESETS = {
  consulting: {
    label: 'Consulting',
    order: ['education', 'work', 'internship', 'por', 'scholastic', 'cocurricular', 'extracurricular', 'projects', 'certifications', 'interests']
  },
  product: {
    label: 'Product Management',
    order: ['work', 'internship', 'education', 'por', 'projects', 'cocurricular', 'scholastic', 'extracurricular', 'certifications', 'interests']
  },
  general: {
    label: 'General / Fresher',
    order: ['education', 'internship', 'por', 'cocurricular', 'extracurricular', 'scholastic', 'work', 'projects', 'certifications', 'interests']
  },
  custom: {
    label: 'Custom',
    order: null
  }
};

/* ---------- line spacing ----------
   **Stated as Word's multiple, not as a CSS line-height**, because that is the
   number anyone checking the CV reads off Word's paragraph dialog — and it was
   read, and two of the old steps failed it.

   The two units are not the same. A CSS line-height is a multiple of the *font
   size*; Word's is a multiple of the font's own single line, which for Garamond
   10pt is 246 twip — 1.23x the font size. So the old ladder was, in the unit
   that got reviewed:

     comfortable 1.28 -> 1.04     compact 1.17 -> 0.95   <- below single
     normal      1.23 -> 1.00     tight   1.11 -> 0.90   <- below single

   Line spacing below single is not allowed, so those two are gone and the range
   now runs upward from single instead of straddling it. SINGLE_LH is the
   conversion and is a measured font metric, not a preference: it is what
   `w:lineRule="auto"` resolves to for this font at this size.

   The steps are 0.025 apart, and that is not timidity — this is a one-page
   format, so the whole usable range is narrow. A round 1.1/1.2/1.3 ladder was
   tried first: on the light sample 1.2 and 1.3 both run to two pages, and even
   1.1 costs ~19mm, most of a full CV's headroom. Three increments of 0.025 keep
   every rung something a real CV can actually afford.

   Keys are the multiples themselves, normalised through Number() so a CV saved
   as "1.0" still resolves to "1". A CV saved under an old key (`normal`,
   `tight`, …) matches nothing and falls back to DENSITY_DEFAULT — single, which
   is what `normal` rendered, so the common case migrates unchanged. */
/* Word's single line for Garamond 10pt, as a CSS line-height. **Measured off
   Word's own rendering**, not computed: 4.47mm between consecutive bullet
   baselines at `w:lineRule="auto" w:line="240"`, against a 10pt em of 3.528mm.

   It is not the 1.23 this file used to carry. That number was read off the
   source document while the DOCX still wrote `lineRule="exact"`, where *we*
   chose the pitch and the two sides agreed by construction. Handing the
   decision to Word — which is what makes the dialog say "Single" — means taking
   Word's number instead, and Word sets this font 3% looser than 1.23.

   Re-measure the same way if the body font or size ever changes: export,
   render through Word to PDF, rasterise, and take the modal gap between bullet
   markers inside one group. dev/preview.html's `page used` against the table
   height in Word is the check that it is still right. */
const SINGLE_LH = 1.258;
export const DENSITY_DEFAULT = '1';
export const DENSITIES = Object.fromEntries([1, 1.025, 1.05, 1.075].map(mult => [
  String(mult),
  {
    label: mult === 1 ? 'Single (1.0)' : String(mult),
    mult,
    lh: Number((SINGLE_LH * mult).toFixed(4))
  }
]));
/** The key a CV resolves to, tolerating "1.0" and anything unrecognised. */
export const densityKey = cv => {
  const k = String(Number(cv?.theme?.density));
  return k in DENSITIES ? k : DENSITY_DEFAULT;
};
export const density = cv => DENSITIES[densityKey(cv)];

/* Rule thickness. Every border in the CV resolves from this one token, so the
   grid can never end up with mixed weights.

   Whole CSS pixels only, deliberately. Chrome snaps border widths to whole
   *device* pixels, so a fractional width renders 1px at DPR 1 but 1.67px at
   DPR 3 — the preview would under-predict the printed page height and the fit
   meter would lie. Integer px is identical at every DPR.

   `standard` (2px = 1.5pt) is exactly Word's tblBorders sz=12, which is what
   both reference documents use. */
export const BORDERS = {
  thin:      { label: 'Thin (0.75pt)',       w: '1px' },
  wordExact: { label: 'Word-exact (1.5pt)',  w: '2px' }
};

/* Adjustable column widths, in mm, against a 184.6mm content width.
   Defaults are the source proportions (tcW pct, 5000 = 100%). The education
   detail column is deliberately absent: it is flex:1 and absorbs whatever the
   others give up, which is what makes narrowing `institute` widen `detail`. */
export const COLUMNS = [
  { key: 'label',     cssVar: '--w-label',     label: 'Label',     min: 12, max: 46, default: 25.33 },
  { key: 'vconn',     cssVar: '--w-vconn',     label: 'Connector', min: 4,  max: 16, default: 6.70 },
  { key: 'eduInst',   cssVar: '--w-edu-inst',  label: 'School',    min: 20, max: 90, default: 64.94 },
  { key: 'eduScore',  cssVar: '--w-edu-score', label: 'Score',     min: 10, max: 40, default: 13.85 },
  { key: 'year',      cssVar: '--w-year',      label: 'Year',      min: 7,  max: 30, default: 14.40 }
];

export const COLUMN_STEP = 0.1;
export const defaultColumns = () => Object.fromEntries(COLUMNS.map(c => [c.key, c.default]));

export const THEMES = {
  ink:      { label: 'Ink',      note: 'Near-black heading bar, white text.' },
  slate:    { label: 'Slate',    note: 'Mid-grey heading bar, black text.' },
  charcoal: { label: 'Charcoal', note: 'Mid-grey heading bar, white text, lighter label column.' }
};

/* Section headings are capitals in every reference CV and in every theme, so
   the casing is applied to the *text*, not with CSS text-transform. That is the
   whole reason it lives here: a CSS transform is invisible to docx.js, so the
   preview showed PROFESSIONAL EXPERIENCE while the exported Word file said
   Professional Experience. Decided once, drawn twice — the same rule as
   textRuns() in metrics.js.
   Only the section's own title. An inline bar's org and dates are whatever the
   author typed and are left exactly alone. */
export const sectionTitle = t => String(t ?? '').toUpperCase();

/* ---------- the organisation bar ----------
   Two arrangements of the same three facts, chosen per section by
   `section.splitBar` — the sections that draw an org bar are the `experience`
   ones, i.e. work and internships.

     off (default)  ORGANISATION – ROLE ......................... dates
     on             ORGANISATION ....... ROLE ................... dates

   Split puts the role on the row's centre line, which in Word is a centre tab
   stop and in the CSS is an absolutely positioned span at the same x. Both are
   measured against the row's *text area* — the row less the left and right cell
   margins — rather than its box, so the two agree to within 0.01mm.

   The join lives here, and not in either renderer, for the same reason
   sectionTitle() does: decided once, drawn twice. It also makes the toggle
   non-destructive — turn split off and the role runs on after the organisation
   exactly as it would read had it been typed into one field. */
export const BAR_JOIN = ' – ';
export const barParts = (org, role, split) => split
  ? { main: org || '', role: role || '' }
  : { main: [org, role].filter(s => s && s.trim()).join(BAR_JOIN), role: '' };

/* ---------- the bullet marker ----------
   Symbol's F0B7 — Word's own bullet — at one of two sizes, for the whole CV.
   One setting, not a per-section or per-bullet one: a CV with two sizes of dot
   in it is a formatting error rather than a feature.

   **Never add a rung above body size.** The marker's inline box is
   `line-height x its own font-size`, so a marker larger than the text makes
   every bullet line taller than the rest of the CV — about 10mm on a full page
   — while Word ignores it completely, because its bullet paragraphs take their
   pitch from the paragraph. That is why 10pt is the top of this table and the
   only alternative is smaller. Below body size the line box is decided by the
   text, so 9.5 costs nothing in height.

   `sz` is Word's half-points, which is why the rungs are halves: 9.5pt is
   sz=19 exactly, and numbering.xml can state it without rounding. */
export const BULLET_DEFAULT = '10';
export const BULLET_SIZES = {
  '10':  { label: '10 pt (body size)', pt: 10,  em: 1,    sz: 20 },
  '9.5': { label: '9.5 pt (smaller)',  pt: 9.5, em: 0.95, sz: 19 }
};
/** The key a CV resolves to, tolerating "9.50" and anything unrecognised. */
export const bulletKey = cv => {
  const k = String(Number(cv?.theme?.bullet));
  return k in BULLET_SIZES ? k : BULLET_DEFAULT;
};
export const bulletSize = cv => BULLET_SIZES[bulletKey(cv)];

/* ---------- masthead band ----------
   The masthead is a band between the top margin and the table's top edge, and
   everything in it is **flush to that band's top-left corner**: the name's
   capitals start exactly on the left margin and rise exactly to the top one,
   and the logo's box fills the band's height with its right edge on the right
   margin. Nothing in the masthead is allowed outside the margin rectangle.

   That is a departure from both source CVs, which let the masthead hang into
   the margin — reference A's logo starts 1.98mm above it and her name's capitals
   1.84mm above it. Flush was asked for explicitly; it is the one number here
   not read off a reference.

   What stays a control is the band's *height*, and the two source CVs are
   still its ends:

     min   8.44mm  reference A (the tight masthead)   margin 12.70, table 21.14
     max  12.80mm  reference B (the airy masthead)      margin 12.70, table 25.48

   The default is 9.98mm, which is neither: it is reference A's logo size, chosen
   so the logo keeps the diameter it has always had while becoming flush. A
   taller band means a bigger logo and more air under the name; a shorter one
   is tighter and buys page height. */
export const MASTHEAD = { min: 8.44, max: 12.80, default: 9.98, step: 0.05 };

/** A4's 0.5in margin — pgMar 720 twip, and the frame the masthead sits in. */
export const PAGE_MARGIN_MM = 12.7;

export const mastheadMM = cv => {
  const h = Number(cv?.theme?.masthead);
  return Number.isFinite(h) ? Math.min(MASTHEAD.max, Math.max(MASTHEAD.min, h)) : MASTHEAD.default;
};
/** The table's top edge, in mm from the paper's edge. Shared with cv.css. */
export const tableTopMM = cv => PAGE_MARGIN_MM + mastheadMM(cv);
/** The logo is a square that fills the band exactly. */
export const logoMM = cv => mastheadMM(cv);

/* ---------- defaults ---------- */

export function blankCV() {
  return {
    version: 1,
    theme: { id: 'ink', autoMetrics: true, density: DENSITY_DEFAULT, border: 'thin',
             bullet: BULLET_DEFAULT, cols: defaultColumns(), masthead: MASTHEAD.default },
    layout: 'custom',
    header: { name: 'Your Name', program: 'PGP 25XXX', gender: '', age: '' },
    contact: { phone: '', address: '', email: '' },
    sections: SECTION_CATALOGUE.map(s => {
      const sec = mkSection(s.key, s.title, s.kind);
      sec.enabled = false;
      return sec;
    })
  };
}

/* Apply a preset order to a CV in place, preserving any section not named. */
export function applyLayout(cv, presetKey) {
  const preset = LAYOUT_PRESETS[presetKey];
  cv.layout = presetKey;
  if (!preset || !preset.order) return cv;
  const rank = new Map(preset.order.map((k, i) => [k, i]));
  cv.sections.sort((a, b) => {
    const ra = rank.has(a.key) ? rank.get(a.key) : 999;
    const rb = rank.has(b.key) ? rank.get(b.key) : 999;
    return ra - rb;
  });
  return cv;
}

/* Enabled sections, in order — what actually renders. */
export const visibleSections = cv => cv.sections.filter(s => s.enabled);
