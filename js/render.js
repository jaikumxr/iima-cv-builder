/* render.js — CV data -> DOM. Pure: no state, no listeners.
   The DOM it produces is exactly what prints, so nothing editor-only may
   leak in here; interaction affordances live in app.css under :not(print). */

import { renderText, fitBulletsToOneLine, fitSingleLine, measureNaturalWidths } from './metrics.js';
import { visibleSections, DENSITIES, BORDERS, COLUMNS, defaultColumns } from './schema.js';

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
  const faces = ['400 10pt "CV Body"', '700 10pt "CV Body"', '700 23pt "CV Name"'];
  await Promise.all(faces.map(f => document.fonts.load(f).catch(() => {})));
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

function renderExperience(section, cv, sheet) {
  for (const entry of section.entries) {
    // with inlineBar the first entry's org/dates were folded into the section
    // heading row, so it must not draw a bar of its own
    if (entry.__barInHeading) {
      for (const block of entry.blocks) sheet.appendChild(renderBlock(block, cv, { showYear: section.showYear }));
      continue;
    }
    if (entry.org || entry.dates) {
      const bar = el('div', 'cv-row cv-row--bar');
      bar.dataset.entry = entry.id;
      bar.appendChild(cell('cv-bar__main', escapeText(entry.org || '')));
      bar.appendChild(cell('cv-bar__dates', escapeText(entry.dates || '')));
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
  page.style.setProperty('--lh-body', (DENSITIES[cv.theme.density] || DENSITIES.normal).lh);
  page.style.setProperty('--rule-w', (BORDERS[cv.theme.border] || BORDERS.thin).w);
  const cols = { ...defaultColumns(), ...(cv.theme.cols || {}) };
  for (const c of COLUMNS) page.style.setProperty(c.cssVar, `${cols[c.key]}mm`);
  page.appendChild(renderHead(cv));

  const sheet = el('div', 'cv-sheet');
  for (const section of visibleSections(cv)) {
    const bar = el('div', 'cv-row cv-row--section');
    bar.dataset.section = section.id;

    // "inline bar": fold the first entry's org + dates into the heading row,
    // so the section reads as one continuous bar (see the light sample)
    const inline = section.inlineBar && section.kind === 'experience' && section.entries[0];
    const title = `<span class="cv-section__title">${escapeText(section.title)}</span>`;

    if (inline) {
      const e = section.entries[0];
      bar.appendChild(cell('cv-bar__main', e.org ? `${title} <span class="cv-section__org">${escapeText(e.org)}</span>` : title));
      bar.appendChild(cell('cv-bar__dates', escapeText(e.dates || '')));
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

  fitToOnePage(page, cv);   // owns the relayout passes, incl. bullet fitting
  return page;
}

/* ---------- the one-page guarantee ----------
   A CV that spills onto page 2 is a failed CV, so overflow is corrected rather
   than merely reported. Order matters: letter-spacing first (free, invisible),
   then a uniform type scale, which is the only lever that always converges.

   Binary search rather than stepping down: each probe costs a full reflow, and
   7 probes resolve the scale to ~0.2%, which is below the threshold where a
   reader would notice. MIN_SCALE is the point where 10pt Garamond stops being
   comfortably legible in print — past it we stop and tell the truth instead of
   shrinking into unreadability. */

const MIN_SCALE = 0.78;
const PROBES = 7;

function fitToOnePage(page, cv) {
  page.style.setProperty('--fs-scale', 1);
  page.dataset.fitScale = '1';
  page.dataset.fitFailed = '';


  /* Every probe must reproduce the *final* layout exactly, alignYears included:
     pinning each year to its bullet's height can grow a row, so measuring
     without it lets the search accept a scale that then overflows. */
  let tooLong = [];
  const relayout = () => {
    fitSingleLine(page);
    tooLong = fitBulletsToOneLine(page);
    alignYears(page);
  };
  const fits = () => { relayout(); return measureFit(page).overMM <= 0; };
  const finish = () => { page.dataset.tooLong = tooLong.join(' '); };

  if (fits()) { finish(); return; }   // fits() relayouts, not just measures

  let lo = MIN_SCALE, hi = 1, best = null;
  for (let i = 0; i < PROBES; i++) {
    const mid = (lo + hi) / 2;
    page.style.setProperty('--fs-scale', mid);
    if (fits()) { best = mid; lo = mid; } else { hi = mid; }
  }

  // `best` stays null only when even MIN_SCALE overflows — genuinely too much
  // content. Hold at the floor so the output is at least readable, and let the
  // fit meter say so rather than silently clipping.
  const scale = best ?? MIN_SCALE;
  page.style.setProperty('--fs-scale', scale);
  page.dataset.fitScale = String(scale);
  page.dataset.fitFailed = best === null ? '1' : '';
  relayout();
  finish();
}

/* Per-bullet years sit in their own column, so a bullet that wraps to two
   lines would push every year below it out of step. Match each year's height
   to its bullet's actual height instead of trusting a shared line-height. */
function alignYears(page) {
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
