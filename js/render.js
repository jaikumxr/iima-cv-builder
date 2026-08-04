/* render.js — CV data -> DOM. Pure: no state, no listeners.
   The DOM it produces is exactly what prints, so nothing editor-only may
   leak in here; interaction affordances live in app.css under :not(print). */

import { renderText, fitBulletsToOneLine, fitSingleLine, measureNaturalWidths } from './metrics.js';
import { visibleSections, density, bulletSize, barParts, BORDERS, COLUMNS, defaultColumns, sectionTitle, mastheadMM, PAGE_MARGIN_MM } from './schema.js';

const PX_PER_MM = 96 / 25.4;

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/* Every cell wraps its content in a block. Without it, inline runs (<strong>,
   bare text) become individual flex items and stack vertically instead of
   flowing as one paragraph. `.body` is where callers append. */
const cell = (cls, html) => {
  const c = el('div', `cv-cell ${cls || ''}`.trim());
  const inner = el('div', 'cv-cell__in', html);
  c.appendChild(inner);
  c.body = inner;
  return c;
};

/* Resolved against this module, so the CV renders correctly from any page
   depth (the app at /, the fidelity harness at /dev/). */
const LOGO_URL = new URL('../assets/img/iima-logo.png', import.meta.url).href;

/* Fonts must be resolved before anything is rendered or measured.
   `document.fonts.ready` alone is not enough: with font-display:block nothing
   requests a face until an element uses it, so ready resolves instantly and
   every measurement lands on fallback metrics. Ask for each face explicitly. */
export async function ensureFonts() {
  if (!document.fonts) return;
  const faces = ['400 10pt "CV Body"', '700 10pt "CV Body"', '700 20pt "CV Body"'];
  await Promise.all(faces.map(f => document.fonts.load(f).catch(() => {})));
  /* The bullet marker. Its @font-face has a unicode-range of exactly F0B7, so
     load() has to be given a string containing that character or it matches
     nothing and resolves without requesting the face. */
  await document.fonts.load('10pt "CV Bullet"', '').catch(() => {});
  await document.fonts.ready;
}

/* ---------- masthead ---------- */

function renderHead(cv) {
  const h = el('header', 'cv-head');
  const bits = [cv.header.program, cv.header.gender, cv.header.age].filter(Boolean);
  const meta = bits.length ? ` | ${bits.join(' | ')}` : '';

  const id = el('div', 'cv-head__id');
  id.appendChild(el('span', 'cv-head__name', escapeText(cv.header.name || '')));
  if (meta) id.appendChild(el('span', 'cv-head__meta', escapeText(meta)));
  h.appendChild(id);

  const logo = el('img', 'cv-head__logo');
  logo.src = cv.theme.logoDataUrl || LOGO_URL;
  logo.alt = '';
  h.appendChild(logo);
  return h;
}

const escapeText = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/* One canvas, reused: measureText runs on every render. */
let ctx2d = null;
const measureCtx = () => (ctx2d ||= document.createElement('canvas').getContext('2d'));

/* Sit the masthead's *ink* flush in the page's top-left margin corner.

   Both corrections are properties of the string, not of the font, which is why
   they are measured here every render instead of being tabulated as constants:
   actualBoundingBoxAscent is how far this particular name's tallest ink rises
   above its baseline (an accented capital rises further than a plain one), and
   actualBoundingBoxLeft is how far its first glyph's ink hangs left of its own
   origin — in the Word export Garamond's "J" put the name 0.25mm outside the
   margin that way.

   The line-height falls out of the baseline. `.cv-head__id` is absolutely
   positioned at the band's top with a single line in it, and every inline box
   on that line is `lh` tall and centred on its own font's content area, so

     baseline − elementTop = lh/2 + max_i( ascent_i − (ascent_i+descent_i)/2 )

   over the boxes on the line, the tallest winning. We want the ink top at the
   element top, i.e. baseline − elementTop = inkAscent, so lh = 2(inkAscent − h).
   That factor of two is the trap the old hard-coded constant documented at
   length; deriving it keeps it right now that the masthead's font and size have
   both changed. */
function mastheadFlush(page) {
  const id = page.querySelector('.cv-head__id');
  if (!id) return { ascentMM: 0, shiftMM: 0 };
  const nameEl = page.querySelector('.cv-head__name');
  const metaEl = page.querySelector('.cv-head__meta');
  const c = measureCtx();

  let inkAscent = 0, halfLead = 0, inkLeft = 0;
  for (const node of [id, nameEl, metaEl]) {
    if (!node) continue;
    const cs = getComputedStyle(node);
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    // the strut (id itself) contributes its leading but carries no ink of its own
    const m = c.measureText(node === id ? '' : node.textContent || '');
    const { fontBoundingBoxAscent: fa, fontBoundingBoxDescent: fd } = m;
    halfLead = Math.max(halfLead, fa - (fa + fd) / 2);
    if (node !== id) inkAscent = Math.max(inkAscent, m.actualBoundingBoxAscent);
    if (node === nameEl) inkLeft = m.actualBoundingBoxLeft;
  }

  page.style.setProperty('--name-lh', `${(2 * (inkAscent - halfLead) / PX_PER_MM).toFixed(3)}mm`);
  page.style.setProperty('--name-shift', `${(inkLeft / PX_PER_MM).toFixed(3)}mm`);
  return { ascentMM: inkAscent / PX_PER_MM, shiftMM: inkLeft / PX_PER_MM };
}

/* ---------- bullets ---------- */

function renderBullets(bullets, cv) {
  const frag = document.createDocumentFragment();
  for (const b of bullets) {
    if (!b.text || !b.text.trim()) continue;
    const p = el('p', 'cv-bullet', renderText(b.text, b.mute, cv.theme.autoMetrics));
    p.dataset.bullet = b.id;
    frag.appendChild(p);
  }
  return frag;
}

function renderYears(group) {
  // per-bullet years take priority over a single year for the whole group
  const perBullet = (group.years || []).some(Boolean);
  if (perBullet) {
    const list = el('div', 'cv-year__list');
    group.bullets.forEach((b, i) => {
      if (!b.text || !b.text.trim()) return;
      list.appendChild(el('span', null, escapeText(group.years[i] || '')));
    });
    return list;
  }
  return document.createTextNode(group.year || '');
}

/* ---------- blocks: a labelled group, or a vertical-connector cluster ---------- */

function renderGroupRow(group, cv, { showYear, labelClass = 'cv-cell--label' } = {}) {
  const row = el('div', 'cv-row cv-row--body');
  row.dataset.block = group.id;

  const label = cell(labelClass, escapeText(group.label || ''));
  row.appendChild(label);

  const content = cell('cv-cell--content');
  content.body.appendChild(renderBullets(group.bullets, cv));
  row.appendChild(content);

  if (showYear) {
    const y = cell('cv-cell--year');
    y.body.appendChild(renderYears(group));
    row.appendChild(y);
  }
  return row;
}

/* 2+ groups welded under one vertical label — see the light sample. */
function renderClusterRow(cluster, cv, { showYear } = {}) {
  const row = el('div', 'cv-row cv-row--cluster');
  row.dataset.block = cluster.id;

  const conn = cell('cv-cell--vconn');
  conn.body.appendChild(el('span', null, escapeText(cluster.label || '')));
  row.appendChild(conn);

  const stack = el('div', 'cv-stack');
  for (const g of cluster.groups) {
    stack.appendChild(renderGroupRow(g, cv, { showYear, labelClass: 'cv-cell--label cv-cell--sublabel' }));
  }
  row.appendChild(stack);
  return row;
}

const renderBlock = (block, cv, opts) =>
  block.type === 'cluster' ? renderClusterRow(block, cv, opts) : renderGroupRow(block, cv, opts);

/* ---------- section bodies ---------- */

/* The centred role of a split bar. Appended to the *row*, not to a cell, so it
   is positioned against the whole row's text area — the centre Word's tab stop
   uses. See barParts in schema.js and .cv-bar__role in cv.css. */
function addRole(row, role) {
  if (role && role.trim()) row.appendChild(el('span', 'cv-bar__role', escapeText(role)));
}

function renderExperience(section, cv, sheet) {
  for (const entry of section.entries) {
    // with inlineBar the first entry's org/dates were folded into the section
    // heading row, so it must not draw a bar of its own
    if (entry.__barInHeading) {
      for (const block of entry.blocks) sheet.appendChild(renderBlock(block, cv, { showYear: section.showYear }));
      continue;
    }
    if (entry.org || entry.role || entry.dates) {
      const { main, role } = barParts(entry.org, entry.role, section.splitBar);
      const bar = el('div', 'cv-row cv-row--bar');
      bar.dataset.entry = entry.id;
      bar.appendChild(cell('cv-bar__main', escapeText(main)));
      bar.appendChild(cell('cv-bar__dates', escapeText(entry.dates || '')));
      addRole(bar, role);
      sheet.appendChild(bar);
    }
    for (const block of entry.blocks) {
      sheet.appendChild(renderBlock(block, cv, { showYear: section.showYear }));
    }
  }
}

function renderList(section, cv, sheet) {
  for (const block of section.blocks) {
    sheet.appendChild(renderBlock(block, cv, { showYear: section.showYear }));
  }
}

function renderEducation(section, cv, sheet) {
  for (const r of section.rows) {
    const row = el('div', 'cv-row cv-row--edu');
    row.dataset.row = r.id;
    row.appendChild(cell('cv-cell--label', escapeText(r.degree || '')));
    row.appendChild(cell('cv-cell--edu-inst', escapeText(r.institute || '')));
    row.appendChild(cell('cv-cell--edu-score', renderText(r.score || '', [], false)));
    row.appendChild(cell('cv-cell--edu-detail', renderText(r.detail || '', [], cv.theme.autoMetrics)));
    row.appendChild(cell('cv-cell--year', escapeText(r.year || '')));
    sheet.appendChild(row);
  }
}

function renderInterests(section, cv, sheet) {
  const items = (section.items || []).filter(i => i && i.trim());
  if (!items.length) return;
  const row = el('div', 'cv-row cv-row--interests');
  row.appendChild(cell('cv-cell--label', escapeText(section.label || 'Hobbies')));
  for (const i of items) row.appendChild(cell('cv-cell--interest', escapeText(i)));
  sheet.appendChild(row);
}

const BODIES = {
  experience: renderExperience,
  list: renderList,
  education: renderEducation,
  interests: renderInterests
};

/* ---------- footer ---------- */

function renderFooter(cv, sheet) {
  const { phone, address, email } = cv.contact;
  if (!phone && !address && !email) return;

  const row = el('div', 'cv-row cv-row--footer');
  const c = cell('cv-cell--content');
  const f = el('div', 'cv-footer');
  if (phone)   f.appendChild(el('span', 'cv-footer__item', `✆ ${escapeText(phone)}`));
  f.appendChild(el('span', 'cv-footer__item cv-footer__item--addr', escapeText(address || '')));
  if (email)   f.appendChild(el('span', 'cv-footer__item', `✉ ${escapeText(email)}`));
  c.body.appendChild(f);
  row.appendChild(c);
  sheet.appendChild(row);
}

/* ---------- entry point ---------- */

export function renderCV(cv, mount) {
  mount.innerHTML = '';

  const page = el('div', `cv-page theme-${cv.theme.id || 'ink'}`);
  page.id = 'cvPage';
  page.style.setProperty('--lh-body', density(cv).lh);
  page.style.setProperty('--rule-w', (BORDERS[cv.theme.border] || BORDERS.thin).w);
  /* One marker size for the whole CV. docx.js spends the same rung as
     numbering.xml's w:sz, so the dot cannot differ between the two. */
  page.style.setProperty('--bullet-fs', bulletSize(cv).em);
  const cols = { ...defaultColumns(), ...(cv.theme.cols || {}) };
  for (const c of COLUMNS) page.style.setProperty(c.cssVar, `${cols[c.key]}mm`);
  /* The band between the top margin and the table. The logo is sized from it
     in CSS; docx.js spends the same number as tblpY. */
  page.style.setProperty('--header-h', `${mastheadMM(cv)}mm`);
  page.appendChild(renderHead(cv));

  const sheet = el('div', 'cv-sheet');
  for (const section of visibleSections(cv)) {
    const bar = el('div', 'cv-row cv-row--section');
    bar.dataset.section = section.id;

    // "inline bar": fold the first entry's org + dates into the heading row,
    // so the section reads as one continuous bar (see the light sample)
    const inline = section.inlineBar && section.kind === 'experience' && section.entries[0];
    const title = `<span class="cv-section__title">${escapeText(sectionTitle(section.title))}</span>`;

    if (inline) {
      const e = section.entries[0];
      const { main, role } = barParts(e.org, e.role, section.splitBar);
      bar.appendChild(cell('cv-bar__main', main ? `${title} <span class="cv-section__org">${escapeText(main)}</span>` : title));
      bar.appendChild(cell('cv-bar__dates', escapeText(e.dates || '')));
      addRole(bar, role);
    } else {
      bar.appendChild(cell('cv-cell--content', title));
    }

    sheet.appendChild(bar);
    section.entries.forEach((e, i) => { e.__barInHeading = !!(inline && i === 0); });
    (BODIES[section.kind] || renderList)(section, cv, sheet);
  }
  renderFooter(cv, sheet);

  page.appendChild(sheet);
  mount.appendChild(page);

  /* Needs the page in the document: it reads computed fonts off the masthead's
     own spans rather than restating --fs-name/--fs-meta here, so the two can
     never disagree. Stashed for docx.js, which spends the same two numbers as
     w:header and the header paragraph's w:ind. */
  const flush = mastheadFlush(page);
  page.dataset.nameAscentMM = flush.ascentMM.toFixed(3);
  page.dataset.nameShiftMM = flush.shiftMM.toFixed(3);

  layoutPasses(page);       // tracking and year alignment — never type size
  return page;
}

/* ---------- layout passes ----------
   **Type size is fixed and is never scaled.** The CV is Garamond 10pt in the
   body and 20pt/14pt in the masthead, and one that arrives at 9.5pt has failed
   the format even if it fits on one page.

   This used to binary-search a uniform `--fs-scale` down to 0.78 whenever the
   page overflowed, which is why the fit meter could say "type scaled to 95% to
   make room". That is gone: overflow is now *reported*, not silently absorbed,
   and the only automatic remedy is tracking, which does not change type size.
   `--fs-scale` stays pinned at 1 — see cv.css, where the token remains only so
   the mm constants derived from it keep their shape.

   The passes still have to run in this order, and alignYears still has to run:
   pinning each year to its bullet's height can grow a row, so a measurement
   taken without it under-reports the page. */

function layoutPasses(page) {
  page.style.setProperty('--fs-scale', 1);
  page.dataset.fitScale = '1';

  fitSingleLine(page);
  const tooLong = fitBulletsToOneLine(page);
  alignYears(page);
  placeBarRoles(page);

  page.dataset.tooLong = tooLong.join(' ');
  page.dataset.fitFailed = measureFit(page).overMM > 0 ? '1' : '';
}

/* A split bar's role sits on the row's centre line, because in Word it sits on
   a centre tab stop there. But a tab cannot move the pen backwards: when the
   organisation already runs past that stop, Word does not shift the role to the
   next stop — it butts it straight onto the end of the organisation with no gap
   at all. Measured, in Word, on both samples with ?split=1: "Zeptonic Systems
   Private Limited (30 Months)Product Analyst II (PPO-UG)".

   So the preview does the same. It looks wrong, and it is meant to: the export
   looks exactly as wrong, and the fix is a shorter organisation or role, which
   the author can only make if the preview stops hiding the collision behind a
   centred overprint. */
function placeBarRoles(page) {
  for (const role of page.querySelectorAll('.cv-bar__role')) {
    role.style.left = '';
    role.style.transform = '';
    delete role.dataset.butted;

    const row = role.parentElement;
    const inner = row.querySelector('.cv-bar__main .cv-cell__in');
    if (!inner || !inner.textContent.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(inner);
    const orgRight = range.getBoundingClientRect().right;
    if (orgRight <= role.getBoundingClientRect().left) continue;

    role.style.left = `${orgRight - row.getBoundingClientRect().left}px`;
    role.style.transform = 'none';
    role.dataset.butted = '1';
  }
}

/* Per-bullet years sit in their own column, so a bullet that wraps to two
   lines would push every year below it out of step. Match each year's height
   to its bullet's actual height instead of trusting a shared line-height. */
export function alignYears(page) {
  for (const list of page.querySelectorAll('.cv-year__list')) {
    const row = list.closest('.cv-row');
    const bullets = row?.querySelectorAll(':scope > .cv-cell--content .cv-bullet');
    if (!bullets) continue;
    [...list.children].forEach((span, i) => {
      if (bullets[i]) span.style.height = `${bullets[i].offsetHeight}px`;
    });
  }
}

/* How much of the page is used? Measured from the masthead and sheet directly:
   .cv-page carries min-height:297mm, so its own box always reads a full page
   and would report every CV as exactly full. */
export { measureNaturalWidths };

/** Ids of bullets that could not be squeezed onto one line. */
export const tooLongBullets = page => (page.dataset.tooLong || '').split(' ').filter(Boolean);

export function measureFit(page) {
  const PX_PER_MM = 96 / 25.4;
  const MARGINS_MM = 2 * 12.7;
  const head = page.querySelector('.cv-head');
  const sheet = page.querySelector('.cv-sheet');
  const usedMM = ((head?.offsetHeight || 0) + (sheet?.offsetHeight || 0)) / PX_PER_MM + MARGINS_MM;
  return { usedMM, capacityMM: 297, overMM: usedMM - 297 };
}
