/* metrics.js — automatic metric highlighting + manual bold + one-line auto-fit.

   Text authoring rules:
     **like this**   -> forced bold, always wins
     numbers/units   -> auto-bolded when theme.autoMetrics is on
     click a token   -> mutes/unmutes that specific auto match (stored per bullet)

   Bare 4-digit years are deliberately NOT treated as metrics: both reference
   CVs leave "EquiLead 2025" and "from 2022 to 2024" unbolded. */

const PATTERNS = [
  // currency: INR 50 Cr+, Rs. 87 lakhs/yr, Rs. 11.42 /vehicle, ₹1.2 Cr
  String.raw`(?:INR|Rs\.?|₹|\$|USD)\s?\d[\d,]*(?:\.\d+)?\s*\+?(?:\s*(?:Cr|crore|Crore|lakhs?|Lakhs?|L|K|M|Bn|bn|million|billion))?(?:\s*\/\s*(?:yr|year|month|mo|vehicle|unit|day))?`,
  // percentage / percentile: 99.70 %ile, 89.33 %, 60%
  String.raw`\d+(?:\.\d+)?\s?%(?:ile)?`,
  // ratios and scores: 1/23, 8.67/10, 30/55, 3/666
  String.raw`\d+(?:\.\d+)?\s?\/\s?\d+(?:\.\d+)?`,
  // durations: 24 Months, 6 months, 4 yrs
  String.raw`\d+\+?\s?(?:Months?|months?|Years?|years?|yrs?|Yrs?|weeks?|Weeks?)`,
  // explicit counts: 5000+, 11,000+, 190+
  String.raw`\d[\d,]*\+`,
  // ordinals: 2nd, 9th, 4th
  String.raw`\d+(?:st|nd|rd|th)\b`,
  // bare numbers, incl. grouped and decimal
  String.raw`\d[\d,]*(?:\.\d+)?`
];

const METRIC_RE = new RegExp(PATTERNS.join('|'), 'g');
const YEAR_RE = /^(?:19|20)\d{2}$/;

const escapeHTML = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Is this match a real metric, or just a year we should leave alone? */
function isMetric(match) {
  const t = match.trim();
  if (YEAR_RE.test(t)) return false;
  return true;
}

/**
 * Split authored text into styled runs. This is where "what is bold" is
 * decided, once — renderText draws them as HTML and docx.js writes the same
 * runs as OOXML, so the preview and the Word export can never disagree about
 * emphasis. Splitting the metric regex across two implementations is exactly
 * the drift this avoids.
 *
 * @param {string} text   raw text, may contain **manual bold**
 * @param {number[]} mute indices of auto-matches to leave unbolded
 * @param {boolean} auto  whether auto metric detection is on
 * @returns {Array<{text: string, bold: boolean, metric: number|null, muted: boolean}>}
 */
export function textRuns(text, mute = [], auto = true) {
  const muted = new Set(mute);
  const runs = [];
  let autoIndex = 0;

  const add = (t, extra) => {
    if (t) runs.push({ text: t, bold: false, metric: null, muted: false, ...extra });
  };

  // split on **manual bold** first; manual always wins over auto
  const parts = String(text ?? '').split(/(\*\*[^*]+\*\*)/g);

  for (const part of parts) {
    if (!part) continue;

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      add(part.slice(2, -2), { bold: true });
      continue;
    }

    if (!auto) {
      add(part);
      continue;
    }

    let last = 0;
    METRIC_RE.lastIndex = 0;
    let m;
    while ((m = METRIC_RE.exec(part)) !== null) {
      if (!isMetric(m[0])) continue;
      const i = autoIndex++;
      add(part.slice(last, m.index));
      const off = muted.has(i);
      add(m[0], { bold: !off, metric: i, muted: off });
      last = m.index + m[0].length;
    }
    add(part.slice(last));
  }

  return runs;
}

/**
 * Turn authored text into HTML.
 * @returns {string} HTML
 */
export function renderText(text, mute = [], auto = true) {
  return textRuns(text, mute, auto).map(r => {
    const body = escapeHTML(r.text);
    if (r.metric == null) return r.bold ? `<strong>${body}</strong>` : body;
    const cls = r.muted ? 'cv-metric cv-metric--off' : 'cv-metric';
    const tag = r.muted ? 'span' : 'strong';
    return `<${tag} class="${cls}" data-metric="${r.metric}">${body}</${tag}>`;
  }).join('');
}

/** How many auto-metrics does this text contain? Used by the editor UI. */
export function countMetrics(text) {
  let n = 0, m;
  const stripped = String(text ?? '').replace(/\*\*[^*]+\*\*/g, '');
  METRIC_RE.lastIndex = 0;
  while ((m = METRIC_RE.exec(stripped)) !== null) if (isMetric(m[0])) n++;
  return n;
}

/* ---------- bullets: one line, always ----------
   A bullet that spills onto a second line breaks the row rhythm the whole grid
   depends on, so this is a hard rule rather than a preference. Two levers, in
   order of what they cost visually:

   1. word-spacing. Because bullets are `text-align-last: justify`, a line that
      fits gets stretched back out to full width, and justification works by
      adjusting word spaces. So negative word-spacing changes only the *wrap
      decision* and is then absorbed — visually free.
   2. letter-spacing. This one shows: letters genuinely tighten and the word
      gaps widen to compensate. It is what the source document does by hand
      with <w:spacing w:val="-8..9"/>, so it is in keeping, but it is spent
      second and sparingly.

   Past both floors the text is simply too long. Rather than crush it further,
   the bullet is handed its space back and flagged, and the editor asks for it
   to be shortened.

   The order is right for the screen and wrong for Word, which is why the word
   floor is a parameter. Word has no word-spacing control, so docx.js can only
   carry the letter-spacing — and on a real CV lever 1 does nearly all the work
   (41 of 45 bullets fitted on word-spacing alone), which the export then throws
   away. The bullet arrives in Word at its natural width and wraps. So the DOCX
   passes wordFloor = 0 and buys the whole fit in the currency it can actually
   spend. See docx.js. */

const WORD_FLOOR = -1.0;    // pt, absorbed by justification
const TRACK_FLOOR = -0.40;  // pt, visible
const WORD_STEP = 0.1;
const TRACK_STEP = 0.02;

/* Fitting to the last available pixel is not the same as fitting. The print
   rasteriser positions glyphs on a different subpixel grid from the screen, so
   a bullet accepted with nothing to spare can come back as two lines in the
   PDF while the preview still shows one — the preview and the export disagree,
   which is the one thing the one-line rule exists to prevent.

   Because bullets are `text-align-last: justify` a fitting line is always
   stretched to full width, so the box cannot tell us how much room is left.
   Ask the question that matters instead: would this still be one line in a
   column a pixel narrower? If not, keep compressing.

   The margin is a parameter because the DOCX needs a much bigger one: Word sets
   the same string a little wider than Chrome does, so a bullet fitted to the
   pixel here still wraps there — and with `jc="distribute"` a wrapped line gets
   its last word stretched across the whole column. See docx.js. */
const SAFETY_PX = 1;

/**
 * @param {Element} root
 * @param {number} safetyPx  headroom to leave; bigger for the DOCX than the DOM
 * @param {number} wordFloor how much word-spacing may be spent, in pt. 0 turns
 *                           the lever off entirely, so letter-spacing — the only
 *                           one Word understands — has to buy the whole fit.
 * @returns {string[]} ids of bullets that still need shortening
 */
export function fitBulletsToOneLine(root, safetyPx = SAFETY_PX, wordFloor = WORD_FLOOR) {
  const tooLong = [];

  for (const el of root.querySelectorAll('.cv-bullet')) {
    el.style.letterSpacing = '';
    el.style.wordSpacing = '';

    const lineH = parseFloat(getComputedStyle(el).lineHeight);
    if (!lineH) continue;
    const wraps = () => Math.round(el.scrollHeight / lineH) > 1;
    /* margin-right shortens the line box, so this is the same measurement the
       print path would make against a hair less room. */
    const tight = () => {
      el.style.marginRight = `${safetyPx}px`;
      const bad = wraps();
      el.style.marginRight = '';
      return bad;
    };

    if (tight()) {
      for (let w = -WORD_STEP; w >= wordFloor && tight(); w -= WORD_STEP) {
        el.style.wordSpacing = `${w.toFixed(2)}pt`;
      }
      for (let t = -TRACK_STEP; t >= TRACK_FLOOR && tight(); t -= TRACK_STEP) {
        el.style.letterSpacing = `${t.toFixed(2)}pt`;
      }
    }

    /* Flagged on the real width, not the safety width: a bullet that fits with
       less than a pixel to spare is a risk worth compressing for, but it is not
       something to ask the author to rewrite. */
    if (wraps()) {
      el.style.letterSpacing = '';
      el.style.wordSpacing = '';
      el.dataset.tooLong = '1';
      if (el.dataset.bullet) tooLong.push(el.dataset.bullet);
    } else {
      delete el.dataset.tooLong;
    }
  }
  return tooLong;
}

/* ---------- cells that must not overflow their column ----------
   Two cases, one remedy. Education and interests rows are one line each in both
   reference CVs and a wrapped one throws the row's rhythm out, so those cells
   are `nowrap`. Label cells may wrap freely, but a word longer than the column
   still spills into the bullets. Either way: tighten tracking first (invisible
   at these amounts), then shrink type in that cell alone. Column widths are
   fixed proportions from the source, so over-long content has to give. */

/* Type size is uniform across the CV and must stay that way — the fix for a
   cell that does not fit is a wider column, not smaller text. So these cells
   only ever get tracking, which is a hair of letter-spacing and reads as the
   same size. If tracking is not enough the cell is reported as bleeding, and
   the column sliders are the remedy. */
const SINGLE_LINE_SEL = [
  '.cv-row--edu .cv-cell__in',
  '.cv-row--interests .cv-cell__in',
  '.cv-cell--label .cv-cell__in',
  '.cv-cell--vconn .cv-cell__in'
].join(', ');

const LINE_MIN_TRACK = -0.2;   // pt

export function fitSingleLine(root) {
  for (const cell of root.querySelectorAll(SINGLE_LINE_SEL)) {
    cell.style.letterSpacing = '';
    const over = () => cell.scrollWidth > cell.clientWidth + 0.5;
    if (!over()) continue;
    for (let t = -0.02; t >= LINE_MIN_TRACK; t -= 0.02) {
      cell.style.letterSpacing = `${t.toFixed(2)}pt`;
      if (!over()) break;
    }
  }
}

/* Natural width of each adjustable column's widest cell, in mm — what the
   "Fit to content" button proposes. Measured at full type size with tracking
   cleared, so the answer is what the column needs, not what it can survive. */
export function measureNaturalWidths(root) {
  const PX_PER_MM = 96 / 25.4;
  const PADDING_MM = 2.0;

  const measure = (sel, mode, extra = () => 0) => {
    let max = 0;
    for (const cell of root.querySelectorAll(sel)) {
      const { letterSpacing, width } = cell.style;
      cell.style.letterSpacing = '';
      cell.style.width = mode;
      max = Math.max(max, cell.scrollWidth + extra(cell) * PX_PER_MM);
      cell.style.width = width;
      cell.style.letterSpacing = letterSpacing;
    }
    return max ? max / PX_PER_MM + PADDING_MM : null;
  };

  /* Nowrap cells need their whole string, so max-content. Label cells wrap, so
     what they actually need is the longest single word — min-content. A label
     inside a connector only gets the column minus the connector strip, so it
     has to ask for that much more. */
  const vconnMM = parseFloat(getComputedStyle(root).getPropertyValue('--w-vconn')) || 0;

  return {
    label:     measure('.cv-cell--label .cv-cell__in', 'min-content',
                       c => (c.closest('.cv-cell--sublabel') ? vconnMM : 0)),
    eduInst:   measure('.cv-cell--edu-inst .cv-cell__in', 'max-content'),
    eduScore:  measure('.cv-cell--edu-score .cv-cell__in', 'max-content'),
    year:      measure('.cv-cell--year .cv-cell__in', 'max-content'),
    eduDetail: measure('.cv-cell--edu-detail .cv-cell__in', 'max-content')
  };
}
