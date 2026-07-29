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

export const mkEntry = (org = '', dates = '', blocks = []) => ({
  id: uid(),
  org,
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

export const DENSITIES = {
  comfortable: { label: 'Comfortable', lh: 1.28 },
  normal:      { label: 'Normal',      lh: 1.23 },
  compact:     { label: 'Compact',     lh: 1.17 },
  tight:       { label: 'Tight',       lh: 1.11 }
};

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
  slate:    { label: 'Slate',    note: 'Mid-grey heading bar, black small-caps.' },
  charcoal: { label: 'Charcoal', note: 'Mid-grey heading bar, white text, lighter label column.' }
};

/* ---------- defaults ---------- */

export function blankCV() {
  return {
    version: 1,
    theme: { id: 'ink', autoMetrics: true, density: 'normal', border: 'thin', cols: defaultColumns() },
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
