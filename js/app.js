/* app.js — wiring: toolbar, preview, fit meter, print. */

import { SECTION_CATALOGUE, LAYOUT_PRESETS, THEMES, DENSITIES, BORDERS, BULLET_SIZES, COLUMNS, COLUMN_STEP, MASTHEAD, densityKey, bulletKey, defaultColumns, mastheadMM, applyLayout, mkSection, blankCV } from './schema.js';
import { SAMPLES } from './samples.js';
import { createStore, loadSaved, clearSaved, exportJSON, importJSON } from './store.js';
import { createEditor, locate } from './editor.js';
import { renderCV, measureFit, ensureFonts, measureNaturalWidths, tooLongBullets } from './render.js';
import { buildDocx, measureAtFullSize, loadLogo } from './docx.js';

const $ = sel => document.querySelector(sel);

/* A throw anywhere in module init leaves a blank editor and an empty preview
   with nothing on screen to say why. Surface it instead of failing silently. */
for (const [evt, pick] of [['error', e => e.error || e.message],
                           ['unhandledrejection', e => e.reason]]) {
  window.addEventListener(evt, e => {
    const err = pick(e);
    const banner = document.getElementById('crash') || (() => {
      const n = document.createElement('div');
      n.id = 'crash';
      document.body.prepend(n);
      return n;
    })();
    banner.textContent = `Something broke: ${err && err.message || err}. Your CV is still saved — reload, or use Reset saved data.`;
  });
}
const MM = 96 / 25.4;                 // css px per mm at 1x
const CONTENT_MM = 184.6;             // page width less both margins
const PAGE_H_MM = 297;

/* ---------- normalise ---------- */
/* Saved files and samples only carry the sections they use. Top the list up
   with the rest of the catalogue (disabled) so every section is toggleable. */

function normalise(cv) {
  const base = blankCV();
  const out = {
    ...base, ...cv,
    theme: { ...base.theme, ...(cv.theme || {}) },
    header: { ...base.header, ...(cv.header || {}) },
    contact: { ...base.contact, ...(cv.contact || {}) }
  };
  const have = new Set((out.sections || []).map(s => s.key));
  out.sections = [...(out.sections || [])];
  for (const c of SECTION_CATALOGUE) {
    if (have.has(c.key)) continue;
    const s = mkSection(c.key, c.title, c.kind);
    s.enabled = false;
    out.sections.push(s);
  }
  for (const s of out.sections) {
    s.entries ??= []; s.blocks ??= []; s.rows ??= []; s.items ??= [];
    // role postdates the first CVs written with this builder
    for (const e of s.entries) e.role ??= '';
    for (const b of [...s.blocks, ...s.entries.flatMap(e => e.blocks || [])]) {
      if (b.type === 'cluster') for (const g of b.groups) { g.bullets ??= []; g.years ??= []; }
      else { b.bullets ??= []; b.years ??= []; }
    }
  }
  return out;
}

/* ---------- boot ---------- */

const store = createStore(normalise(loadSaved() || SAMPLES.dark.data));

const previewMount = $('#preview');
const stage = $('#previewStage');
const printRoot = $('#printRoot');

let scale = 1;
let currentPage = null;

function layoutPreview() {
  if (!currentPage) return;
  const avail = $('#previewScroll').clientWidth - 48;
  scale = Math.min(1.4, Math.max(0.25, avail / (210 * MM)));
  printRoot.style.setProperty('--scale', scale);
  stage.style.width = `${210 * MM * scale}px`;
  stage.style.height = `${currentPage.offsetHeight * scale}px`;
  updateFit();
}

const LINE_MM = 4.3;   // one 10pt Garamond bullet line

function updateFit() {
  if (!currentPage) return;
  const { usedMM, overMM } = measureFit(currentPage);
  const meter = $('#fitMeter');
  const bar = $('#fitBar');
  const ratio = usedMM / PAGE_H_MM;

  bar.style.width = `${Math.min(100, ratio * 100)}%`;

  /* Type is never scaled, so there is no "shrunk to fit" state to report —
     overflow is the author's to fix, and the only honest thing to show is how
     much has to go. The meter says it in mm; the shaded band on the page says
     it in place, because the preview is one continuous sheet and a CV that
     runs long otherwise just looks like a slightly taller page. */
  currentPage.classList.toggle('is-over', overMM > 0);
  bar.className = overMM > 0 ? 'fit-bar is-over' : (ratio > 0.94 ? 'fit-bar is-tight' : 'fit-bar');
  meter.className = overMM > 0 ? 'fit-label is-over' : 'fit-label';
  meter.textContent = overMM > 0
    ? `Over by ${overMM.toFixed(1)} mm — trim ~${Math.ceil(overMM / LINE_MM)} line(s)`
    : `Fits on one page · ${(-overMM).toFixed(1)} mm to spare`;
}

function drawPreview() {
  currentPage = renderCV(store.get(), previewMount);
  layoutPreview();
  // marked in place rather than by re-rendering, so the caret never moves
  editor.markTooLong(tooLongBullets(currentPage));
}

const editor = createEditor({ mount: $('#editor'), store, onPreview: drawPreview });

/* ---------- toolbar ---------- */

/* Falls back to the first option when `value` names something that no longer
   exists — a saved CV can carry a key that has since been removed, and setting
   an unmatched value leaves the select blank. */
function fillSelect(sel, entries, value) {
  sel.innerHTML = '';
  for (const [key, meta] of entries) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = meta.label;
    sel.appendChild(opt);
  }
  sel.value = entries.some(([key]) => key === value) ? value : entries[0][0];
}

const layoutSel = $('#layoutSelect');
const themeSel = $('#themeSelect');
const densitySel = $('#densitySelect');
const borderSel = $('#borderSelect');
const bulletSel = $('#bulletSelect');

fillSelect(layoutSel, Object.entries(LAYOUT_PRESETS), store.get().layout || 'custom');
fillSelect(themeSel, Object.entries(THEMES), store.get().theme.id || 'ink');
fillSelect(densitySel, Object.entries(DENSITIES), densityKey(store.get()));
fillSelect(borderSel, Object.entries(BORDERS), store.get().theme.border || 'thin');
fillSelect(bulletSel, Object.entries(BULLET_SIZES), bulletKey(store.get()));

/* ---------- column-width sliders ---------- */

const colInputs = new Map();

(function buildColumnSliders() {
  const host = $('#colSliders');
  for (const col of COLUMNS) {
    const row = document.createElement('label');
    row.className = 'col-row';
    row.title = `${col.label} column width`;

    const name = document.createElement('span');
    name.className = 'col-name';
    name.textContent = col.label;

    const input = document.createElement('input');
    Object.assign(input, { type: 'range', min: col.min, max: col.max, step: COLUMN_STEP });

    const out = document.createElement('output');
    out.className = 'col-out';

    // dragging fires continuously — one undo step per gesture, not per pixel
    input.addEventListener('input', () => {
      out.textContent = `${Number(input.value).toFixed(1)}`;
      store.update(d => {
        d.theme.cols = { ...defaultColumns(), ...(d.theme.cols || {}) };
        d.theme.cols[col.key] = Number(input.value);
      }, { history: false });
      drawPreview();
    });

    row.append(name, input, out);
    host.appendChild(row);
    colInputs.set(col.key, { input, out });
  }
})();

/* ---------- masthead band ----------
   The height of the band between the top margin and the table, in mm. The name
   and the logo are always flush to that band's top-left corner, so this is the
   only masthead dimension left to choose: a taller band is a bigger logo and
   more air under the name, a shorter one buys page height. The ends are the two
   source CVs. See schema.js. */

const gapUI = (function buildGapSlider() {
  const row = document.createElement('label');
  row.className = 'col-row';
  row.title = 'Height of the masthead — the band above the table';

  const name = document.createElement('span');
  name.className = 'col-name';
  name.textContent = 'Height';

  const input = document.createElement('input');
  Object.assign(input, { type: 'range', min: MASTHEAD.min, max: MASTHEAD.max, step: MASTHEAD.step });

  const out = document.createElement('output');
  out.className = 'col-out';

  input.addEventListener('input', () => {
    out.textContent = Number(input.value).toFixed(2);
    // one undo step per gesture, not per pixel — same as the column sliders
    store.update(d => { d.theme.masthead = Number(input.value); }, { history: false });
    drawPreview();
  });

  row.append(name, input, out);
  $('#gapSlider').appendChild(row);
  return { input, out };
})();

function syncGap() {
  const g = mastheadMM(store.get());
  gapUI.input.value = g;
  gapUI.out.textContent = g.toFixed(2);
}

$('#gapReset').addEventListener('click', () => {
  store.update(d => { d.theme.masthead = MASTHEAD.default; });
  syncGap();
  drawPreview();
});

/* ---------- gridlines ----------
   A view aid, not CV data: it reproduces Word's own grid and the page-margin
   rectangle over the preview so the two can be compared edge for edge. Kept
   out of the CV entirely — it is a class on the preview root, drawn by
   pseudo-elements in app.css, so it cannot reach the PDF or the DOCX and does
   not survive an export. Remembered per browser rather than per CV. */
const GRID_KEY = 'cvbuilder.gridlines';
const gridBox = $('#tgGrid');

function syncGrid() {
  $('#printRoot').classList.toggle('show-grid', gridBox.checked);
}
gridBox.checked = localStorage.getItem(GRID_KEY) === '1';
gridBox.addEventListener('change', () => {
  localStorage.setItem(GRID_KEY, gridBox.checked ? '1' : '0');
  syncGrid();
});

function syncColumns() {
  const cols = { ...defaultColumns(), ...(store.get().theme.cols || {}) };
  for (const [key, { input, out }] of colInputs) {
    input.value = cols[key];
    out.textContent = `${Number(cols[key]).toFixed(1)}`;
  }
}

const setColumns = next => {
  store.update(d => { d.theme.cols = { ...defaultColumns(), ...(d.theme.cols || {}), ...next }; });
  syncColumns();
  drawPreview();
};

$('#colReset').addEventListener('click', () => setColumns(defaultColumns()));

/* Give every fixed column exactly what its widest cell needs, reserve the
   education detail column's requirement, and let School absorb the remainder.
   Detail is flex:1, so it is sized by subtraction rather than directly. */
$('#colFit').addEventListener('click', () => {
  if (!currentPage) return;
  const natural = measureNaturalWidths(currentPage);
  const cur = { ...defaultColumns(), ...(store.get().theme.cols || {}) };
  const byKey = Object.fromEntries(COLUMNS.map(c => [c.key, c]));
  const clamp = (key, mm) => Math.min(byKey[key].max, Math.max(byKey[key].min, Number(mm.toFixed(1))));

  const next = {};
  for (const key of ['label', 'eduScore', 'year']) {
    if (natural[key] != null) next[key] = clamp(key, natural[key]);
  }
  if (natural.eduDetail != null) {
    const taken = (next.label ?? cur.label) + (next.eduScore ?? cur.eduScore) + (next.year ?? cur.year);
    next.eduInst = clamp('eduInst', CONTENT_MM - taken - natural.eduDetail);
  }
  setColumns(next);
});

layoutSel.addEventListener('change', () => {
  store.update(d => applyLayout(d, layoutSel.value));
  editor.render();
});

themeSel.addEventListener('change', () => {
  store.update(d => { d.theme.id = themeSel.value; });
  drawPreview();
});

densitySel.addEventListener('change', () => {
  store.update(d => { d.theme.density = densitySel.value; });
  drawPreview();
});

borderSel.addEventListener('change', () => {
  store.update(d => { d.theme.border = borderSel.value; });
  drawPreview();
});

bulletSel.addEventListener('change', () => {
  store.update(d => { d.theme.bullet = bulletSel.value; });
  drawPreview();
});

const bindToggle = (id, path, after) => {
  const box = $(id);
  box.checked = !!path.split('.').reduce((o, k) => o?.[k], store.get());
  box.addEventListener('change', () => {
    store.update(d => {
      const keys = path.split('.');
      const last = keys.pop();
      keys.reduce((o, k) => o[k], d)[last] = box.checked;
    }, { history: false });
    (after || drawPreview)();
  });
};
bindToggle('#tgMetrics', 'theme.autoMetrics');

$('#sampleSelect').addEventListener('change', e => {
  const s = SAMPLES[e.target.value];
  if (!s) return;
  if (!confirm(`Replace the current CV with "${s.label}"? Your work is saved in this browser and can be undone with Ctrl+Z.`)) {
    e.target.value = '';
    return;
  }
  store.replace(normalise(s.data));
  syncToolbar();
  editor.render();
  e.target.value = '';
});

$('#btnNew').addEventListener('click', () => {
  if (!confirm('Start a blank CV? Undo (Ctrl+Z) will bring this one back.')) return;
  clearSaved();
  store.replace(normalise(blankCV()));
  syncToolbar();
  editor.render();
});

/* Escape hatch for a saved CV that predates a theme/schema change. Without
   this, loadSaved() keeps restoring the stale theme on every visit and the
   sample's own theme never gets a chance to apply. */
$('#btnReset').addEventListener('click', () => {
  if (!confirm('Discard the CV saved in this browser and reload from the dark sample?\n\nExport first if you want to keep it.')) return;
  clearSaved();
  store.replace(normalise(SAMPLES.dark.data));
  syncToolbar();
  editor.render();
});

$('#btnExport').addEventListener('click', () => {
  const name = (store.get().header.name || 'cv').toLowerCase().replace(/\s+/g, '-');
  exportJSON(store.get(), `${name}.cv.json`);
});

$('#btnImport').addEventListener('click', async () => {
  try {
    const data = await importJSON();
    store.replace(normalise(data));
    syncToolbar();
    editor.render();
  } catch (err) {
    if (err && err.message !== 'No file chosen') alert(`Could not import: ${err.message}`);
  }
});

$('#btnExpand').addEventListener('click', () => editor.expandAll());
$('#btnCollapse').addEventListener('click', () => editor.collapseAll());

/* ---------- DOCX ----------
   Measured at a fixed 10pt rather than read off the preview, because the
   preview may be scaled and the DOCX never is. */

const download = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

async function writeDocx(cv, measured) {
  const { bytes, ext } = await loadLogo(cv);
  const name = (cv.header.name || 'cv').toLowerCase().replace(/\s+/g, '-');
  download(buildDocx(cv, measured, bytes, ext), `${name}.docx`);
}

$('#btnDocx').addEventListener('click', async () => {
  const btn = $('#btnDocx');
  btn.disabled = true;
  try {
    const cv = store.get();
    const measured = measureAtFullSize(cv);

    if (measured.overMM > 0) {
      $('#docxWarnBody').textContent =
        `At 10 pt this CV is ${measured.usedMM.toFixed(1)} mm tall — ` +
        `${measured.overMM.toFixed(1)} mm past the page. That is about ` +
        `${Math.ceil(measured.overMM / LINE_MM)} line(s) to cut.`;
      $('#docxWarn').showModal();
      return;   // the dialog's buttons take it from here
    }
    await writeDocx(cv, measured);
  } finally {
    btn.disabled = false;
  }
});

$('#docxWarnCancel').addEventListener('click', () => $('#docxWarn').close());
$('#docxWarnGo').addEventListener('click', async () => {
  $('#docxWarn').close();
  const cv = store.get();
  await writeDocx(cv, measureAtFullSize(cv));
});

$('#btnPrint').addEventListener('click', () => {
  if (!localStorage.getItem('iima-cv-builder:print-hint')) {
    $('#printHint').showModal();
  } else {
    window.print();
  }
});
$('#printHintGo').addEventListener('click', () => {
  if ($('#printHintSkip').checked) localStorage.setItem('iima-cv-builder:print-hint', '1');
  $('#printHint').close();
  setTimeout(() => window.print(), 100);
});

function syncToolbar() {
  const cv = store.get();
  layoutSel.value = cv.layout || 'custom';
  themeSel.value = cv.theme.id || 'ink';
  densitySel.value = densityKey(cv);
  borderSel.value = cv.theme.border || 'thin';
  bulletSel.value = bulletKey(cv);
  $('#tgMetrics').checked = !!cv.theme.autoMetrics;
  syncColumns();
  syncGap();
}

/* ---------- click a metric in the preview to mute/unmute it ---------- */

previewMount.addEventListener('click', e => {
  const token = e.target.closest('.cv-metric');
  if (!token) return;
  const bulletEl = token.closest('[data-bullet]');
  if (!bulletEl) return;

  const bulletId = bulletEl.dataset.bullet;
  const index = Number(token.dataset.metric);

  store.update(d => {
    const b = locate(d, bulletId);
    if (!b) return;
    const mute = new Set(b.node.mute || []);
    mute.has(index) ? mute.delete(index) : mute.add(index);
    b.node.mute = [...mute].sort((x, y) => x - y);
  }, { history: false });
  drawPreview();
});

/* ---------- keyboard ---------- */

document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  if (e.key === 'z' && !e.shiftKey) {
    if (document.activeElement?.matches('input, textarea')) return;
    e.preventDefault(); store.undo(); editor.render(); syncToolbar();
  } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
    if (document.activeElement?.matches('input, textarea')) return;
    e.preventDefault(); store.redo(); editor.render(); syncToolbar();
  }
});

window.addEventListener('resize', layoutPreview);
window.addEventListener('beforeprint', () => { printRoot.style.setProperty('--scale', 1); });
window.addEventListener('afterprint', layoutPreview);

syncColumns();
syncGap();
syncGrid();
editor.render();

/* First paint uses whatever metrics are available; once the real faces are in,
   re-render so the fit meter and auto-fit reflect actual Garamond widths. */
ensureFonts().then(drawPreview);
