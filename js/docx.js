/* docx.js — the same CV, written as OOXML.

   Every number here comes from the source .docx's own units, recorded in
   css/cv.css and the README table: pgSz/pgMar in twips, the logo in EMU, column
   widths as tcW percentages of 10466 twip. This file turns that record back
   into Word, so the export is a reconstruction of the source document rather
   than a screenshot of the preview.

   Two deliberate departures from the preview:

   1. Type is fixed — as it now is everywhere. The body is sz=20 (10pt) and the
      masthead sz=40/sz=28, always. Nothing scales type to make a CV fit; if it
      overflows, the caller warns before writing the file.
   2. word-spacing is dropped — Word has no such control. That is not just a
      transcription gap: word-spacing is the *first* lever the screen fit spends
      (metrics.js), so a bullet can be one line in Chrome purely because of
      compression Word never receives. Bullets are therefore re-fitted here with
      the word lever switched off, and the letter-spacing that results goes out
      as <w:spacing> — precisely the hand tuning the source document did to keep
      its own bullets on one line. See measureAtFullSize.

   Word's table model differs from the CSS one in two places. The org bar is a
   single cell with a right tab stop rather than two cells (the source sets
   tcBorders nil between them so they read as one bar), and a vertical connector
   is a real vMerge rather than the nested markup the CSS needs. */

import { density, bulletSize, barParts, BORDERS, defaultColumns, sectionTitle, mastheadMM, logoMM, tableTopMM, PAGE_MARGIN_MM } from './schema.js';
import { textRuns, fitBulletsToOneLine } from './metrics.js';
import { renderCV, measureFit } from './render.js';
import { zip, dataUrlToBytes } from './zip.js';

/* ---------- units ---------- */

const TWIP_PER_MM = 1440 / 25.4;
const mm = v => Math.round(v * TWIP_PER_MM);
const PX_TO_PT = 72 / 96;

const CONTENT_MM = 184.6;          // 10466 twip
const PAGE = { w: 11906, h: 16838, margin: 720 };   // A4, 0.5in all round

/* Masthead geometry, read off reference B.

   The table is **page-anchored, not flowed**:

     <w:tblpPr w:vertAnchor="page" w:horzAnchor="margin" w:tblpY="1445"/>

   so it sits 1445 twip from the paper's edge no matter what the header does.
   That is the real mechanism behind the gap under the name, and it is worth
   being explicit about because the obvious alternative is wrong: making the
   table flow after the header ties its position to the header's height, so the
   gap drifts with the name's font metrics and collapses entirely if w:header
   is 0. The source never relies on that.

   The header therefore only has to place the name, and must stay shorter than
   tableTop − headerTop or it will overlap the floating table.

   The table's edge is the one number here NOT taken from reference B. It is the top
   margin plus the masthead band, and the band is a control — schema.js owns its
   range (8.44mm reference A, 12.80mm reference B) and cv.css spends the same number through
   --header-h, so the DOCX and the preview cannot drift apart. */
const FOOTER_TOP = 340;              // w:footer=340 — not the margin

/* Everything in the masthead is stated as **mm from the paper's top edge**,
   because that is what all three of them physically are and it is the only
   frame in which they can be checked against a ruler on a rendered page.
   Deriving one from another is what let the name drift onto the table.

   The masthead is flush to the margin rectangle: the name's ink starts on the
   12.7mm margin in both axes and the logo's box fills the band. Measured in
   the export this replaces, the name's capitals sat 1.84mm above the top
   margin, its "J" 0.25mm outside the left one, and the logo 1.98mm above the
   top — all three inherited from the source CVs, all three now gone.

   Word gives a single-spaced line its own first-baseline offset and we do not
   get to pick it, so w:header is the lever for where the name sits, and the
   ONLY one. Do not reach for `w:line` + lineRule="exact" instead: with an exact
   line shorter than the glyphs Word crops the type, and a 20pt name in the
   ~2mm line-height the CSS uses would be shaved to nothing. The CSS can do that
   because a browser overflows its line box; Word clips.

   NAME_FIRST_BASELINE_MM is that offset for Garamond Bold at sz=40, measured
   off Word's own rendering. It was 6.98mm for Centaur at sz=46. If the
   masthead font or size changes again, re-measure it — dev/docx.html asserts
   the resulting flush and will fail loudly if this is stale.

   How to re-measure: export, render through Word to PDF, rasterise, and read
   the name's topmost ink. Subtract however far that lands above the 12.7mm
   margin from this constant. It was calibrated that way at 400dpi, and the
   raster's antialiasing biases the reading ~0.1mm high, so the result sits a
   hair *inside* the margin rather than a hair outside — the safe direction. */
const NAME_FIRST_BASELINE_MM = 5.96;

/** Everything the masthead needs, for one CV. `ink` comes from the rendered
    page (render.js's mastheadFlush) and is what makes the name flush. */
function masthead(cv, ink) {
  /* Where the name's baseline has to land for its ink top to sit exactly on
     the margin — the same equation the preview solves with --name-lh. */
  const baselineMM = PAGE_MARGIN_MM + ink.ascentMM;
  const headerTopMM = baselineMM - NAME_FIRST_BASELINE_MM;
  return {
    headerTop: mm(headerTopMM),          // w:header — the lever
    tableTop: mm(tableTopMM(cv)),        // w:tblpY — page-anchored
    nameInd: mm(ink.shiftMM),            // w:ind — pushes the ink onto the margin
    logoEmu: emu(logoMM(cv)),
    logoX: emu(CONTENT_MM - logoMM(cv)), // right edge flush to the margin
    /* positionV is relative to the header paragraph, so the logo's offset has
       to absorb wherever that paragraph now starts. That is what pins the logo
       to the top margin however far the name moves. */
    logoY: emu(PAGE_MARGIN_MM - headerTopMM)
  };
}

/* EMU: 914400 per inch, so 36000 per mm. positionH is relative to the text
   column, which starts at the left margin. */
const EMU_PER_MM = 914400 / 25.4;
const emu = v => Math.round(v * EMU_PER_MM);

/* tblCellMar, straight from the source. Tab stops inside a cell are measured
   from the cell's *text area*, not its border, so the rightmost usable position
   is the cell width less both margins. Putting a right tab at the full cell
   width pushes the run past the border — which is what clipped the email
   address off the end of the contact row. */
/* Headroom left when fitting bullets for Word, in CSS px (~4mm). Chrome needs
   1px; Word needs far more, because it sets the same string a little wider and
   because our tracking is quantised to whole twentieths of a point. Raise it if
   bullets still wrap in Word. */
const DOCX_SAFETY_PX = 15;

/* Word has no word-spacing, so the DOCX fit may not spend any: see
   measureAtFullSize and metrics.js. */
const DOCX_WORD_FLOOR = 0;

const CELL_MAR_L = 57;
const CELL_MAR_R = 28;
const textW = w => w - CELL_MAR_L - CELL_MAR_R;

/* Bullets, straight off the source's w:ind — but drawn by numbering.xml rather
   than typed into the text. See bulletParas.

   The marker is Word's own bullet: Symbol's F0B7, at whichever of BULLET_SIZES'
   two rungs the CV is set to (ctx.bulletSz). Only the marker — the bullet's
   *text* is Garamond 10pt like the rest of the document. Garamond's own U+2022
   is a much smaller dot and read as undersized. cv.css draws the identical
   glyph from `local("Symbol")` at the same rung. */
const BULLET_NUM_ID = 1;
const BULLET_IND = 176;
const BULLET_HANG = 153;
const BULLET_FONT = 'Symbol';
const BULLET_CHAR = '&#xF0B7;';

/* ---------- XML ---------- */

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  /* Word rejects the whole document on a stray control character, and pasted
     CV text is a reliable source of them. */
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const REL_NS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/* ---------- runs and paragraphs ---------- */

/**
 * @param {object} run  from textRuns(): { text, bold }
 * @param {object} opts { font, size (half-points), track (twentieths of a pt) }
 */
function xmlRun(run, { font = 'Garamond', size = 20, track = 0 } = {}) {
  const props = [
    `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>`,
    run.bold ? '<w:b/>' : '',
    `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`,
    track ? `<w:spacing w:val="${track}"/>` : ''
  ].join('');
  // xml:space=preserve or Word eats the spaces between runs
  return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${esc(run.text)}</w:t></w:r>`;
}

const plainRuns = (text, opts) => xmlRun({ text, bold: false }, opts);

/**
 * @param {string} content  already-built <w:r> XML
 * @param {object} opts     jc, line (twips), ind, tabs, keepNext
 */
function xmlPara(content, { jc = '', line = 0, rule = 'auto', ind = '', tabs = '', numId = 0, extra = '' } = {}) {
  const pPr = [
    // CT_PPr is a sequence: numPr precedes tabs, spacing, ind and jc
    numId ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>` : '',
    tabs,
    ind,
    line ? `<w:spacing w:before="0" w:after="0" w:line="${line}" w:lineRule="${rule}"/>`
         : '<w:spacing w:before="0" w:after="0"/>',
    jc ? `<w:jc w:val="${jc}"/>` : '',
    extra
  ].join('');
  return `<w:p><w:pPr>${pPr}</w:pPr>${content}</w:p>`;
}

/* ---------- cells ---------- */

/**
 * @param {object} o
 *   w        cell width in twips
 *   span     gridSpan
 *   fill     shading hex without '#', or null
 *   vMerge   'restart' | 'continue' | null
 *   dir      'btLr' for the vertical connector
 *   body     paragraph XML
 */
function xmlCell({ w, span = 1, fill = null, vMerge = null, dir = null, vAlign = 'center', body }) {
  const pr = [
    `<w:tcW w:w="${w}" w:type="dxa"/>`,
    span > 1 ? `<w:gridSpan w:val="${span}"/>` : '',
    vMerge === 'restart' ? '<w:vMerge w:val="restart"/>' : vMerge ? '<w:vMerge/>' : '',
    fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : '',
    dir ? `<w:textDirection w:val="${dir}"/>` : '',
    `<w:vAlign w:val="${vAlign}"/>`
  ].join('');
  return `<w:tc><w:tcPr>${pr}</w:tcPr>${body || xmlPara('')}</w:tc>`;
}

const xmlRow = (cells, { height = 0 } = {}) => {
  const pr = height ? `<w:trPr><w:trHeight w:val="${height}" w:hRule="atLeast"/></w:trPr>` : '';
  return `<w:tr>${pr}${cells.join('')}</w:tr>`;
};

/* ---------- the grid ----------
   A Word table carries one w:tblGrid, and every row must divide it exactly:
   the gridSpans in a row have to add up to the column count, or consumers are
   entitled to lay the row out however they like.

   Our rows do not share a column structure. Six columns cover most of them —
   the year column's left edge and the education detail column's right edge are
   the same x, which is what lets one grid serve body, education and bar rows —
   but the interests row cuts the remaining width into N equal cells for
   whatever N the author typed, and N rarely lands on those lines.

   So the grid is built from the *union of every boundary any row actually
   uses*. Each cell then spans a whole number of columns by construction, for
   any N, and cell widths are sums of grid columns rather than independent
   roundings — so a row can never fail to total the table width. Widths come
   from cv.theme.cols, so the app's sliders carry through. */

function grid(cv) {
  const cols = { ...defaultColumns(), ...(cv.theme.cols || {}) };
  const end = mm(CONTENT_MM);

  const x = {
    zero: 0,
    vconn: mm(cols.vconn),
    label: mm(cols.label),
    inst: mm(cols.label + cols.eduInst),
    score: mm(cols.label + cols.eduInst + cols.eduScore),
    // the detail column is flex:1 in the CSS — sized by subtraction, so its
    // right edge is exactly where the year column starts
    detail: end - mm(cols.year),
    end
  };

  const boundaries = new Set(Object.values(x));

  /* Interests rows: N equal cells across whatever the label column leaves. */
  const interestCuts = new Map();
  for (const s of (cv.sections || [])) {
    if (!s.enabled || s.kind !== 'interests') continue;
    const items = (s.items || []).filter(i => i && i.trim());
    if (!items.length) continue;
    const cuts = [x.label];
    for (let k = 1; k <= items.length; k++) {
      cuts.push(x.label + Math.round(k * (end - x.label) / items.length));
    }
    cuts[cuts.length - 1] = end;
    for (const c of cuts) boundaries.add(c);
    interestCuts.set(s.id, cuts);
  }

  const lines = [...boundaries].sort((a, b) => a - b);
  const index = new Map(lines.map((v, i) => [v, i]));
  const widths = lines.slice(1).map((v, i) => v - lines[i]);

  return {
    x, widths, interestCuts,
    total: end,
    span: (from, to) => index.get(to) - index.get(from),
    width: (from, to) => to - from
  };
}

/** A cell defined by the boundaries it sits between, rather than by width. */
const spanCell = (g, from, to, opts = {}) =>
  xmlCell({ w: g.width(from, to), span: g.span(from, to), ...opts });

/* ---------- rows ---------- */

function bulletParas(bullets, cv, ctx) {
  const line = ctx.line;
  return bullets.map(b => {
    /* Tracking measured off the real layout at full size, in twentieths of a
       point — the same units and roughly the same range (-8..9) as the source
       document's hand-tuned w:spacing.

       Quantised *away from zero*, never to nearest. A twentieth of a point
       across a ~100-character bullet is 5pt ≈ 1.8mm of line, so rounding -3.6
       to -3 would hand back more room than the safety margin has to give.
       Rounding to -4 overspends by less than the margin absorbs, and only ever
       in the safe direction. */
    const px = ctx.tracking.get(b.id) || 0;
    const track = Math.floor(px * PX_TO_PT * 20);   // px is never positive here
    const runs = textRuns(b.text, b.mute, cv.theme.autoMetrics)
      .map(r => xmlRun(r, { track }))
      .join('');
    /* The bullet is a real list marker, not a literal "•" + tab in the text.
       It has to be: with jc="distribute" Word stretches the line's own
       whitespace to fill the column, and on a bullet with slack to spare that
       swallowed the tab and carried the dot several mm to the right — so the
       first bullet of a group sat out of line with the rest of it. A numPr
       marker is drawn by the list machinery at the indent, outside the text
       being justified, so it cannot move whatever the line does.

       The marker's font and size are numbering.xml's, and cv.css draws the
       same glyph at the same size, so the preview and Word agree on the dot. */
    return xmlPara(runs, {
      jc: 'distribute',
      line,
      numId: BULLET_NUM_ID,
      // ind left=176 hanging=153 twip, straight off the source
      ind: `<w:ind w:left="${BULLET_IND}" w:hanging="${BULLET_HANG}"/>`
    });
  }).join('') || xmlPara('');
}

const cellText = (text, ctx, { jc = '', bold = false } = {}) =>
  xmlPara(xmlRun({ text, bold }, {}), { jc, line: ctx.line });

function groupRows(group, cv, ctx, { showYear, inCluster = false }) {
  const g = ctx.grid, x = g.x;
  const years = (group.years || []).some(Boolean) ? group.years : null;

  const label = spanCell(g, inCluster ? x.vconn : x.zero, x.label, {
    fill: ctx.fills.label,
    body: cellText(group.label || '', ctx, { jc: 'center', bold: true })
  });

  const content = spanCell(g, x.label, showYear ? x.detail : x.end, {
    body: bulletParas(group.bullets || [], cv, ctx)
  });

  const cells = [label, content];
  if (showYear) {
    const list = years
      ? years.map(y => cellText(y || '', ctx, { jc: 'center' })).join('')
      : cellText(group.year || '', ctx, { jc: 'center' });
    cells.push(spanCell(g, x.detail, x.end, { body: list }));
  }
  return { cells };
}

function clusterRows(cluster, cv, ctx, { showYear }) {
  const g = ctx.grid, x = g.x;
  return cluster.groups.map((group, i) => {
    const conn = spanCell(g, x.zero, x.vconn, {
      fill: ctx.fills.label,
      vMerge: i === 0 ? 'restart' : 'continue',
      dir: 'btLr',
      body: i === 0 ? cellText(cluster.label || '', ctx, { jc: 'center', bold: true }) : xmlPara('')
    });
    const { cells } = groupRows(group, cv, ctx, { showYear, inCluster: true });
    return xmlRow([conn, ...cells]);
  }).join('');
}

const blockRows = (block, cv, ctx, opts) =>
  block.type === 'cluster'
    ? clusterRows(block, cv, ctx, opts)
    : xmlRow(groupRows(block, cv, ctx, opts).cells);

/* A full-width bar: one cell, with the dates pushed to a right tab stop. The
   source sets tcBorders nil between its two cells so they read as one bar —
   a tab reproduces that without a seam to suppress.

   A split bar (schema.js barParts) adds a centre stop for the role. Both stops
   are measured from the cell's *text area* — textW, i.e. the cell less both
   cell margins — which is also where cv.css centres its .cv-bar__role, so the
   preview and Word put the role on the same x. Word's own w:jc plays no part:
   the tab stops decide, exactly as they do for the contact row. */
function barRow(main, dates, cv, ctx, fill, role = '') {
  const g = ctx.grid, x = g.x;
  const tabAt = textW(g.total);
  const mid = Math.round(tabAt / 2);
  const stops = [
    role ? `<w:tab w:val="center" w:pos="${mid}"/>` : '',
    dates ? `<w:tab w:val="right" w:pos="${tabAt}"/>` : ''
  ].join('');
  const body = xmlPara(
    xmlRun({ text: main, bold: true }, {}) +
    (role ? `<w:r><w:tab/></w:r>${xmlRun({ text: role, bold: true }, {})}` : '') +
    (dates ? `<w:r><w:tab/></w:r>${xmlRun({ text: dates, bold: false }, {})}` : ''),
    {
      line: ctx.barLine,
      tabs: stops ? `<w:tabs>${stops}</w:tabs>` : ''
    }
  );
  return xmlRow([spanCell(g, x.zero, x.end, { fill, body })], { height: ctx.barHeight });
}

function educationRows(section, cv, ctx) {
  const g = ctx.grid, x = g.x;
  return section.rows.map(r => xmlRow([
    spanCell(g, x.zero, x.label, { fill: ctx.fills.label, body: cellText(r.degree || '', ctx, { jc: 'center', bold: true }) }),
    spanCell(g, x.label, x.inst, { body: cellText(r.institute || '', ctx, { jc: 'center' }) }),
    spanCell(g, x.inst, x.score, { body: cellText(r.score || '', ctx, { jc: 'center' }) }),
    spanCell(g, x.score, x.detail, {
      body: xmlPara(textRuns(r.detail || '', [], cv.theme.autoMetrics).map(t => xmlRun(t, {})).join(''),
                    { jc: 'center', line: ctx.line })
    }),
    spanCell(g, x.detail, x.end, { body: cellText(r.year || '', ctx, { jc: 'center' }) })
  ])).join('');
}

/* N equal cells across whatever the label column leaves. The cut positions were
   folded into the table grid (see grid()), so each one lands on a grid line and
   the row divides the table exactly like every other row. */
function interestsRow(section, cv, ctx) {
  const items = (section.items || []).filter(i => i && i.trim());
  if (!items.length) return '';
  const g = ctx.grid, x = g.x;
  const cuts = g.interestCuts.get(section.id);
  if (!cuts) return '';

  const cells = [spanCell(g, x.zero, x.label, {
    fill: ctx.fills.label,
    body: cellText(section.label || 'Hobbies', ctx, { jc: 'center', bold: true })
  })];
  items.forEach((item, i) => {
    cells.push(spanCell(g, cuts[i], cuts[i + 1], { body: cellText(item, ctx, { jc: 'center' }) }));
  });
  return xmlRow(cells);
}

function footerRow(cv, ctx) {
  const { phone, address, email } = cv.contact;
  if (!phone && !address && !email) return '';
  const g = ctx.grid, x = g.x;
  const parts = [phone && `✆ ${phone}`, address, email && `✉ ${email}`].filter(Boolean);
  const tabAt = textW(g.total);
  const mid = Math.round(textW(g.total) / 2);
  const body = xmlPara(
    xmlRun({ text: parts[0] || '', bold: false }, {}) +
    (parts[1] ? `<w:r><w:tab/></w:r>${xmlRun({ text: parts[1], bold: false }, {})}` : '') +
    (parts[2] ? `<w:r><w:tab/></w:r>${xmlRun({ text: parts[2], bold: false }, {})}` : ''),
    {
      // the contact bar is a fixed-height row too — see ctx.barLine
      line: ctx.barLine,
      tabs: `<w:tabs><w:tab w:val="center" w:pos="${mid}"/><w:tab w:val="right" w:pos="${tabAt}"/></w:tabs>`
    }
  );
  return xmlRow([spanCell(g, x.zero, x.end, { body })]);
}

/* ---------- document.xml ---------- */

const visibleSections = cv => (cv.sections || []).filter(s => s.enabled);

function documentXml(cv, ctx) {
  const g = ctx.grid;
  const rows = [];

  for (const section of visibleSections(cv)) {
    /* sectionTitle() capitalises; the inline org and dates are left exactly as
       the author typed them. Same call the preview makes, so the two cannot
       disagree about casing the way they used to. */
    const heading = sectionTitle(section.title);
    const inline = section.inlineBar && section.kind === 'experience' && section.entries[0];
    if (inline) {
      const e = section.entries[0];
      const { main, role } = barParts(e.org, e.role, section.splitBar);
      rows.push(barRow(main ? `${heading}   ${main}` : heading,
                       e.dates || '', cv, ctx, ctx.fills.section, role));
    } else {
      rows.push(barRow(heading, '', cv, ctx, ctx.fills.section));
    }

    if (section.kind === 'experience') {
      section.entries.forEach((entry, i) => {
        if (!(inline && i === 0) && (entry.org || entry.role || entry.dates)) {
          const { main, role } = barParts(entry.org, entry.role, section.splitBar);
          rows.push(barRow(main, entry.dates || '', cv, ctx, ctx.fills.bar, role));
        }
        for (const block of entry.blocks || []) {
          rows.push(blockRows(block, cv, ctx, { showYear: section.showYear }));
        }
      });
    } else if (section.kind === 'education') {
      rows.push(educationRows(section, cv, ctx));
    } else if (section.kind === 'interests') {
      rows.push(interestsRow(section, cv, ctx));
    } else {
      for (const block of section.blocks || []) {
        rows.push(blockRows(block, cv, ctx, { showYear: section.showYear }));
      }
    }
  }
  rows.push(footerRow(cv, ctx));

  const edge = `w:val="single" w:sz="${ctx.ruleSz}" w:space="0" w:color="000000"`;
  const tblPr = `<w:tblPr>` +
    // page-anchored, exactly as the source — see TABLE_TOP
    `<w:tblpPr w:leftFromText="180" w:rightFromText="180" ` +
      `w:vertAnchor="page" w:horzAnchor="margin" w:tblpY="${ctx.mast.tableTop}"/>` +
    `<w:tblW w:w="${g.total}" w:type="dxa"/>` +
    /* tblInd is measured to the leading edge of the first cell's *text*, not to
       its border, so at 0 Word hangs the whole table CELL_MAR_L (plus half a
       border) into the left margin — measured at 1.14mm outside it. Setting it
       to the left cell margin puts the border itself on the margin, which is
       where the preview has always drawn it. */
    `<w:tblInd w:w="${CELL_MAR_L}" w:type="dxa"/>` +
    `<w:tblLayout w:type="fixed"/>` +
    `<w:tblBorders>` +
      `<w:top ${edge}/><w:left ${edge}/><w:bottom ${edge}/><w:right ${edge}/>` +
      `<w:insideH ${edge}/><w:insideV ${edge}/>` +
    `</w:tblBorders>` +
    // tblCellMar left=57 right=28, top/bottom 0 — straight off the source
    `<w:tblCellMar>` +
      `<w:top w:w="0" w:type="dxa"/><w:left w:w="${CELL_MAR_L}" w:type="dxa"/>` +
      `<w:bottom w:w="0" w:type="dxa"/><w:right w:w="${CELL_MAR_R}" w:type="dxa"/>` +
    `</w:tblCellMar>` +
    `</w:tblPr>`;

  const tblGrid = `<w:tblGrid>${g.widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;

  const sectPr = `<w:sectPr>` +
    `<w:headerReference r:id="rId1" w:type="default"/>` +
    // w:code=9 is Word's paper code for A4, as the source has it
    `<w:pgSz w:w="${PAGE.w}" w:h="${PAGE.h}" w:code="9"/>` +
    `<w:pgMar w:top="${PAGE.margin}" w:right="${PAGE.margin}" w:bottom="${PAGE.margin}" ` +
      `w:left="${PAGE.margin}" w:header="${ctx.mast.headerTop}" w:footer="${FOOTER_TOP}" w:gutter="0"/>` +
    `<w:cols w:space="708"/>` +
    `<w:docGrid w:linePitch="360"/>` +
    `</w:sectPr>`;

  return `${DECL}<w:document ${W_NS} ${REL_NS}><w:body>` +
    `<w:tbl>${tblPr}${tblGrid}${rows.join('')}</w:tbl>` +
    /* Word requires a paragraph after a table at the end of the body, and this
       is the one paragraph in the document that is not single-spaced. It has to
       be: the table floats with wrapSquare, so Word pushes this empty paragraph
       below it, and at single spacing its 12pt line lands past the bottom
       margin on a full CV and takes the whole thing onto a second page —
       measured, on the dark sample at the loosest setting. Pinned to 1pt it
       costs nothing. It carries no text, so there is no line spacing here for a
       reader to judge. */
    `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>` +
    sectPr +
    `</w:body></w:document>`;
}

/* ---------- header1.xml — the masthead ----------
   The source keeps the name, meta and logo in the header part, with the body
   table page-anchored below it (tblpY=1445 twip). The logo is exactly 0.5in
   square (457200 EMU) with its right edge flush to the margin. */

function headerXml(cv, ctx) {
  const bits = [cv.header.program, cv.header.gender, cv.header.age].filter(Boolean);
  const meta = bits.length ? ` | ${bits.join(' | ')}` : '';
  const NAME_SZ = 40;   // 20pt — --fs-name
  const META_SZ = 28;   // 14pt — --fs-meta
  const EMU = ctx.mast.logoEmu;

  const name =
    xmlRun({ text: cv.header.name || '', bold: true }, { size: NAME_SZ }) +
    (meta ? xmlRun({ text: meta, bold: true }, { size: META_SZ }) : '');

  const logo = ctx.logo ? `<w:r><w:drawing>` +
    `<wp:anchor xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ` +
      `distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="1" ` +
      `behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">` +
      `<wp:simplePos x="0" y="0"/>` +
      /* Absolute offsets, as the source has them, rather than align=right:
         the logo's right edge then lands flush to the right margin. */
      `<wp:positionH relativeFrom="column"><wp:posOffset>${ctx.mast.logoX}</wp:posOffset></wp:positionH>` +
      `<wp:positionV relativeFrom="paragraph"><wp:posOffset>${ctx.mast.logoY}</wp:posOffset></wp:positionV>` +
      `<wp:extent cx="${EMU}" cy="${EMU}"/>` +
      `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
      `<wp:wrapSquare wrapText="bothSides"/>` +
      `<wp:docPr id="1" name="IIMA logo"/>` +
      `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
        `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
          `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
            `<pic:nvPicPr><pic:cNvPr id="1" name="IIMA logo"/><pic:cNvPicPr/></pic:nvPicPr>` +
            `<pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
            `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${EMU}" cy="${EMU}"/></a:xfrm>` +
              `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
          `</pic:pic>` +
        `</a:graphicData>` +
      `</a:graphic>` +
    `</wp:anchor></w:drawing></w:r>` : '';

  /* One paragraph, and deliberately **no w:line** — exactly as the source's
     header has it. Word's natural single spacing for the 20pt run is what puts
     the baseline NAME_FIRST_BASELINE_MM below the header's start; w:header then
     places that whole line on the page. Setting an explicit exact line here is
     what the CSS does and it does not translate: Word would clip the type.

     The indent is the other half of being flush: it pushes the paragraph right
     by however far the first capital's ink hangs left of its own origin, which
     is what put the name outside the left margin before. Measured off the
     rendered page, so the preview and Word correct by the same amount.

     It only has to place the name — the table's position comes from tblpY, not
     from how tall this is. */
  return `${DECL}<w:hdr ${W_NS} ${REL_NS}>` +
    xmlPara(name + logo, {
      ind: ctx.mast.nameInd ? `<w:ind w:left="${ctx.mast.nameInd}"/>` : ''
    }) +
    `</w:hdr>`;
}

/* ---------- numbering.xml — the bullet ----------
   One level, one list, used by every bullet in the document. The indent
   duplicates the paragraph's so Word has no reason to disagree with it, and
   the marker's own rPr is what sets the dot's size and face. */
function numberingXml(ctx) {
  return `${DECL}<w:numbering ${W_NS}>` +
    `<w:abstractNum w:abstractNumId="0">` +
      `<w:multiLevelType w:val="singleLevel"/>` +
      `<w:lvl w:ilvl="0">` +
        `<w:start w:val="1"/>` +
        `<w:numFmt w:val="bullet"/>` +
        `<w:lvlText w:val="${BULLET_CHAR}"/>` +
        `<w:lvlJc w:val="left"/>` +
        `<w:pPr><w:ind w:left="${BULLET_IND}" w:hanging="${BULLET_HANG}"/></w:pPr>` +
        /* Symbol applies to the marker only. Word takes the rest of the run's
           properties from the paragraph, so the bullet's text stays Garamond. */
        `<w:rPr>` +
          `<w:rFonts w:ascii="${BULLET_FONT}" w:hAnsi="${BULLET_FONT}" w:hint="default"/>` +
          `<w:sz w:val="${ctx.bulletSz}"/><w:szCs w:val="${ctx.bulletSz}"/>` +
        `</w:rPr>` +
      `</w:lvl>` +
    `</w:abstractNum>` +
    `<w:num w:numId="${BULLET_NUM_ID}"><w:abstractNumId w:val="0"/></w:num>` +
    `</w:numbering>`;
}

/* ---------- static parts ---------- */

function stylesXml() {
  return `${DECL}<w:styles ${W_NS}><w:docDefaults><w:rPrDefault><w:rPr>` +
    `<w:rFonts w:ascii="Garamond" w:hAnsi="Garamond" w:cs="Garamond"/>` +
    `<w:sz w:val="20"/><w:szCs w:val="20"/>` +
    `</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>` +
    `<w:spacing w:before="0" w:after="0"/>` +
    `</w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
    `</w:styles>`;
}

const CT_NS = 'xmlns="http://schemas.openxmlformats.org/package/2006/content-types"';
const contentTypesXml = ext => `${DECL}<Types ${CT_NS}>` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  (ext ? `<Default Extension="${ext}" ContentType="image/${ext === 'jpg' ? 'jpeg' : ext}"/>` : '') +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
  `<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>` +
  `<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>` +
  `</Types>`;

const PKG_REL_NS = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const rootRelsXml = () => `${DECL}<Relationships ${PKG_REL_NS}>` +
  `<Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/>` +
  `</Relationships>`;

const docRelsXml = () => `${DECL}<Relationships ${PKG_REL_NS}>` +
  `<Relationship Id="rId1" Type="${R}/header" Target="header1.xml"/>` +
  `<Relationship Id="rId2" Type="${R}/styles" Target="styles.xml"/>` +
  `<Relationship Id="rId3" Type="${R}/numbering" Target="numbering.xml"/>` +
  `</Relationships>`;

const headerRelsXml = ext => `${DECL}<Relationships ${PKG_REL_NS}>` +
  (ext ? `<Relationship Id="rId1" Type="${R}/image" Target="media/image1.${ext}"/>` : '') +
  `</Relationships>`;

/* ---------- measurement ----------
   Rendered detached rather than read off the live preview, because the preview
   is scaled to the pane by a CSS transform and carries whatever inline tracking
   the last layout left on it. A clean render gives the tracking and the true
   height for this CV at 10pt.

   Theme fills come from the same node rather than being duplicated here: the
   stylesheet stays the one place a theme's colours are defined. */

export function measureAtFullSize(cv) {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-10000px;top:0;width:210mm;visibility:hidden';
  document.body.appendChild(host);
  try {
    // renderCV runs the layout passes itself, and never scales type
    const page = renderCV(cv, host);

    /* Refit the bullets for Word rather than for the screen. Two changes:

       No word-spacing (DOCX_WORD_FLOOR). This is the one that matters. The
       screen fit spends word-spacing first because jc="distribute" absorbs it
       — visually free — and on a real CV that lever alone fits nearly every
       bullet. But Word has no word-spacing, so all of that compression is
       dropped on export and the bullet arrives at its natural width. Any
       bullet whose natural width exceeds the column then wraps, and because it
       is jc="distribute" Word stretches the orphaned tail across the full
       column: `C a n n o n`. Refitting with the lever off converts the whole
       requirement into letter-spacing, which the export can actually carry.

       And far more headroom than the screen needs (DOCX_SAFETY_PX), because
       Word sets the same string a little wider than Chrome does and because
       the tracking is quantised on the way out.

       Together these cost a few twentieths of a point — measured at -4 worst
       case on a full CV, inside the -8..+11 the source document uses by hand.
       Flagging is unaffected: fitBulletsToOneLine still flags on the real
       width, not the safety width. */
    const tooLong = fitBulletsToOneLine(page, DOCX_SAFETY_PX, DOCX_WORD_FLOOR);

    const tracking = new Map();
    for (const b of page.querySelectorAll('.cv-bullet')) {
      const ls = parseFloat(getComputedStyle(b).letterSpacing);
      if (b.dataset.bullet && ls) tracking.set(b.dataset.bullet, ls);
    }

    const cs = getComputedStyle(page);
    const hex = name => (cs.getPropertyValue(name).trim().replace('#', '').toUpperCase()) || null;
    const fills = { section: hex('--fill-section'), bar: hex('--fill-bar'), label: hex('--fill-label') };

    /* The masthead's flush corrections, measured by render.js off this very
       node. Read back rather than recomputed so the DOCX cannot correct by a
       different amount than the preview did. */
    const ink = {
      ascentMM: Number(page.dataset.nameAscentMM) || 0,
      shiftMM: Number(page.dataset.nameShiftMM) || 0
    };

    return { ...measureFit(page), tracking, tooLong, fills, ink };
  } finally {
    host.remove();
  }
}

/* ---------- entry point ---------- */

/**
 * @param {object} cv       the CV state
 * @param {object} measured from measureAtFullSize()
 * @param {Uint8Array|null} logoBytes
 * @param {string} logoExt  'png' | 'jpg'
 * @returns {Blob} a .docx
 */
export function buildDocx(cv, measured, logoBytes = null, logoExt = 'png') {
  const ctx = {
    grid: grid(cv),
    mast: masthead(cv, measured.ink || { ascentMM: 0, shiftMM: 0 }),
    tracking: measured.tracking,
    fills: measured.fills,
    logo: !!logoBytes,
    /* Line spacing as Word states it: `auto` with w:line in 240ths of the
       font's own single line, so the paragraph dialog reads "Multiple 1.1" —
       the number a reader checks — instead of "Exactly 13.5pt". 240 is single.

       This is also the *only* way the two sides can agree on what "1" means.
       Word's multiple is of the font's natural line (246 twip for Garamond
       10pt); CSS's line-height is of the font *size*. schema.js holds the
       conversion, so cv.css gets 1.23 x mult and Word gets 240 x mult, and both
       come out at the same millimetre. */
    line: Math.round(240 * density(cv).mult),
    /* Bars are fixed-height rows, and cv.css gives them line-height:1 rather
       than the body's spacing. Without pinning them here, raising the line
       spacing grew them in Word but not in the preview — 1mm a bar, ~14 bars,
       all of it invisible to the fit meter.

       Pinned at single rather than at an exact 10pt, even though 10pt is what
       cv.css draws: **no paragraph in this document may report below single**,
       which is the whole point of the change, and an exact 10pt line reads as
       0.81 in Word's dialog. It costs nothing — single is 246 twip against the
       row's 252, so trHeight still decides the height at every setting. */
    barLine: 240,
    barHeight: mm(4.45),
    /* The bullet marker's half-points, straight off the CV's own setting, so
       numbering.xml and cv.css's --bullet-fs draw the same dot. */
    bulletSz: bulletSize(cv).sz,
    ruleSz: (BORDERS[cv.theme.border] || BORDERS.thin).w === '2px' ? 12 : 6
  };

  const files = [
    { name: '[Content_Types].xml', data: contentTypesXml(logoBytes ? logoExt : null) },
    { name: '_rels/.rels', data: rootRelsXml() },
    { name: 'word/document.xml', data: documentXml(cv, ctx) },
    { name: 'word/styles.xml', data: stylesXml() },
    { name: 'word/numbering.xml', data: numberingXml(ctx) },
    { name: 'word/header1.xml', data: headerXml(cv, ctx) },
    { name: 'word/_rels/document.xml.rels', data: docRelsXml() },
    { name: 'word/_rels/header1.xml.rels', data: headerRelsXml(logoBytes ? logoExt : null) }
  ];
  if (logoBytes) files.push({ name: `word/media/image1.${logoExt}`, data: logoBytes });

  return zip(files);
}

/** Fetch the logo as bytes — either the user's uploaded data URL or the asset. */
export async function loadLogo(cv) {
  try {
    if (cv.theme.logoDataUrl) {
      const ext = /^data:image\/jpe?g/i.test(cv.theme.logoDataUrl) ? 'jpg' : 'png';
      return { bytes: dataUrlToBytes(cv.theme.logoDataUrl), ext };
    }
    const res = await fetch(new URL('../assets/img/iima-logo.png', import.meta.url));
    if (!res.ok) return { bytes: null, ext: 'png' };
    return { bytes: new Uint8Array(await res.arrayBuffer()), ext: 'png' };
  } catch {
    return { bytes: null, ext: 'png' };   // a CV without the logo beats no CV
  }
}
