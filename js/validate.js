/* validate.js — the import gate.

   Until now the only producer of a CV JSON was this app's own Export, so
   `data.version` was check enough. It no longer is: IMPORT.md hands an LLM the
   schema and asks it to convert a PDF, and what comes back is plausible JSON
   written by something that has never run the renderer. A field of the wrong
   type does not fail loudly there — `app.js:normalise()` assumes shapes, so a
   cluster without `groups` throws during import and a `bullets: ["text"]`
   renders as nothing at all, with no clue which of the two went wrong.

   So everything arriving from outside comes through here first. Two outcomes,
   and the split between them is the whole design:

     errors    the CV is not imported. Something is missing or the wrong type
               and guessing at it would put a silently wrong CV on screen.
     warnings  the CV *is* imported, repaired, and the repair is reported.
               Only for coercions with exactly one sensible reading — a bullet
               written as a bare string, a missing id, a boolean spelled "true".

   Both come out as plain lines naming a path, because the fix for an LLM's
   output is to paste the report back to the LLM. That is what the Copy button
   on the report dialog is for. Anything phrased as an internal assertion —
   "expected object" — is a line someone has to translate first, so the
   messages say what to do instead.

   This does not check whether the CV *fits*, at all. That is measured, not
   guessed, the render pass does it the moment the CV is on screen, and cutting
   is the author's job — the same rule that stops the renderer scaling type. */

import { SECTION_CATALOGUE, LAYOUT_PRESETS, THEMES, DENSITIES, BORDERS,
         BULLET_SIZES, COLUMNS, MASTHEAD, uid } from './schema.js';

const KINDS = ['experience', 'list', 'education', 'interests'];
const CATALOGUE = new Map(SECTION_CATALOGUE.map(c => [c.key, c]));

/* Which array a section's content lives in, per kind. The other three are
   ignored by that kind's renderer, so content in one of them is invisible —
   worth a warning, since it is the shape an LLM gets wrong most readily
   (bullets filed under `blocks` on an `experience` section). */
const CONTENT_KEY = { experience: 'entries', list: 'blocks', education: 'rows', interests: 'items' };

/* There is deliberately no bullet-length check here. An import is a *verbatim*
   copy of someone's CV — IMPORT.md forbids the model from rewriting a single
   word of it — so a bullet arriving too long is expected, and it is the
   author's to cut, not the importer's to flag on a guess. It is also already
   answered properly a moment later: `layoutPasses` measures every bullet at
   real type size and marks the ones that will not fit, and app.js reports that
   count back into this same dialog. A character count would be a worse copy of
   a measurement that already exists. */

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = v => JSON.parse(JSON.stringify(v));

/**
 * Check and repair a parsed CV.
 * @param {unknown} raw  the result of JSON.parse
 * @returns {{ok: boolean, data: object|null, errors: string[], warnings: string[]}}
 */
export function validateCV(raw) {
  const errors = [];
  const warnings = [];
  const seenIds = new Set();
  let mintedIds = 0;

  const err = (at, msg) => errors.push(`${at} — ${msg}`);
  const warn = (at, msg) => warnings.push(`${at} — ${msg}`);

  if (!isObj(raw)) {
    return {
      ok: false, data: null, warnings,
      errors: [Array.isArray(raw)
        ? 'the file is a JSON array — the CV must be a single JSON object, starting with { and ending with }'
        : 'the file is not a JSON object — the CV must start with { and end with }']
    };
  }

  const cv = clone(raw);

  /* ---------- small coercions, shared ---------- */

  /* A number where a string belongs is the commonest LLM slip — a year written
     2025 rather than "2025" — and it has exactly one reading, so it is a
     warning and not an error. Anything else in that slot is dropped. */
  const text = (obj, key, at, { required = false, blankOk = true } = {}) => {
    const v = obj[key];
    if (v == null || v === '') {
      if (required) err(at, `"${key}" is missing`);
      else if (!blankOk) warn(at, `"${key}" is empty`);
      obj[key] = '';
      return obj[key];
    }
    if (typeof v === 'string') return (obj[key] = v);
    if (typeof v === 'number' || typeof v === 'boolean') {
      warn(at, `"${key}" is a ${typeof v} — quote it as text ("${v}")`);
      return (obj[key] = String(v));
    }
    err(at, `"${key}" must be text`);
    obj[key] = '';
    return obj[key];
  };

  const bool = (obj, key, at, fallback) => {
    const v = obj[key];
    if (typeof v === 'boolean') return v;
    if (v == null) return (obj[key] = fallback);
    if (v === 'true' || v === 'false') {
      warn(at, `"${key}" is the text "${v}" — write it unquoted as ${v}`);
      return (obj[key] = v === 'true');
    }
    warn(at, `"${key}" must be true or false — using ${fallback}`);
    return (obj[key] = fallback);
  };

  /* An array is required wherever content lives, but an empty one is a real
     state (a section switched on before it has been filled in), so a missing
     array is repaired rather than rejected. */
  const list = (obj, key, at) => {
    const v = obj[key];
    if (Array.isArray(v)) return v;
    if (v == null) return (obj[key] = []);
    err(at, `"${key}" must be a list, written [ ... ]`);
    return (obj[key] = []);
  };

  /* Ids are the editor's handles: locate() finds a bullet by id, and the
     preview tags every row with one so a click can be traced back to the data.
     Two nodes sharing an id makes the second unreachable and the first
     unreliable, and an LLM asked for unique ids will happily write "b1" three
     times. Neither case is worth failing an import over — mint a fresh one and
     say how many were minted. */
  const takeId = node => {
    const id = node.id;
    if (typeof id === 'string' && id.trim() && !seenIds.has(id)) {
      seenIds.add(id);
      return id;
    }
    if (id != null) mintedIds++;
    let fresh = uid();
    while (seenIds.has(fresh)) fresh = uid();
    seenIds.add(fresh);
    node.id = fresh;
    return fresh;
  };

  /* ---------- version ---------- */

  if (cv.version == null) {
    err('top level', '"version" is missing — a CV file starts with "version": 1');
  } else if (typeof cv.version !== 'number') {
    warn('top level', `"version" should be the number 1, not ${JSON.stringify(cv.version)}`);
    cv.version = 1;
  } else if (cv.version > 1) {
    warn('top level', `this file says version ${cv.version}; this builder writes version 1`);
  }

  /* ---------- theme ----------
     Every one of these has a resolver in schema.js that already tolerates an
     unknown value, so none of them can fail an import. They are reported
     because silently swapping a theme is how an import comes out looking
     nothing like what was asked for. */

  if (cv.theme != null && !isObj(cv.theme)) {
    err('theme', 'must be an object, or left out entirely');
    cv.theme = {};
  }
  const theme = (cv.theme ??= {});

  const pick = (obj, key, table, fallback, at) => {
    const v = obj[key];
    if (v == null) return;
    const k = String(v);
    if (k in table) { obj[key] = k; return; }
    warn(at, `"${key}" is "${k}", which is not one of ${Object.keys(table).map(x => `"${x}"`).join(', ')} — using "${fallback}"`);
    obj[key] = fallback;
  };

  pick(theme, 'id', THEMES, 'ink', 'theme');
  pick(theme, 'border', BORDERS, 'thin', 'theme');
  /* density and bullet are keyed by their own numeric value, so "1.0" and 1
     both have to resolve — normalise them the way densityKey()/bulletKey() do
     before looking them up, or a perfectly good value reports as unknown. */
  if (theme.density != null) { theme.density = String(Number(theme.density)); pick(theme, 'density', DENSITIES, '1', 'theme'); }
  if (theme.bullet != null) { theme.bullet = String(Number(theme.bullet)); pick(theme, 'bullet', BULLET_SIZES, '10', 'theme'); }
  if (theme.autoMetrics != null) bool(theme, 'autoMetrics', 'theme', true);

  if (theme.masthead != null) {
    const h = Number(theme.masthead);
    if (!Number.isFinite(h)) {
      warn('theme', '"masthead" must be a number of mm — using the default');
      delete theme.masthead;
    } else if (h < MASTHEAD.min || h > MASTHEAD.max) {
      warn('theme', `"masthead" ${h}mm is outside ${MASTHEAD.min}–${MASTHEAD.max}mm and will be clamped`);
    }
  }

  if (theme.cols != null) {
    if (!isObj(theme.cols)) {
      warn('theme', '"cols" must be an object of column widths — using the defaults');
      delete theme.cols;
    } else {
      for (const col of COLUMNS) {
        const v = theme.cols[col.key];
        if (v == null) continue;
        const mm = Number(v);
        if (!Number.isFinite(mm)) {
          warn('theme.cols', `"${col.key}" must be a number of mm — using the default`);
          delete theme.cols[col.key];
        } else if (mm < col.min || mm > col.max) {
          warn('theme.cols', `"${col.key}" ${mm}mm is outside ${col.min}–${col.max}mm`);
        }
      }
      for (const key of Object.keys(theme.cols)) {
        if (!COLUMNS.some(c => c.key === key)) {
          warn('theme.cols', `"${key}" is not a column — ignored`);
          delete theme.cols[key];
        }
      }
    }
  }

  /* An embedded logo replaces the IIMA mark in the masthead and is handed
     straight to an <img> and to the DOCX packer, so a value that is not an
     image data URL breaks both. Drop it rather than ship a broken export. */
  if (theme.logoDataUrl != null) {
    if (typeof theme.logoDataUrl !== 'string' || !/^data:image\/(png|jpe?g);base64,/i.test(theme.logoDataUrl)) {
      warn('theme', '"logoDataUrl" must be a PNG or JPEG data URL — dropped, the CV will use the IIMA logo');
      delete theme.logoDataUrl;
    }
  }

  if (cv.layout != null && !(cv.layout in LAYOUT_PRESETS)) {
    warn('top level', `"layout" is "${cv.layout}" — using "custom", which keeps the section order exactly as written`);
    cv.layout = 'custom';
  }

  /* ---------- header and contact ---------- */

  for (const [key, fields, required] of [
    ['header', ['name', 'program', 'gender', 'age'], ['name']],
    ['contact', ['phone', 'address', 'email'], []]
  ]) {
    if (cv[key] != null && !isObj(cv[key])) {
      err(key, 'must be an object');
      cv[key] = {};
    }
    const obj = (cv[key] ??= {});
    for (const f of fields) {
      if (obj[f] == null && !required.includes(f)) continue;
      text(obj, f, key, { required: required.includes(f) });
    }
    for (const f of Object.keys(obj)) {
      if (!fields.includes(f)) {
        warn(key, `"${f}" is not a field of ${key} (${fields.join(', ')}) — ignored`);
        delete obj[f];
      }
    }
  }

  /* ---------- sections ---------- */

  if (!Array.isArray(cv.sections)) {
    err('top level', '"sections" is missing or is not a list — the CV has no content');
    cv.sections = [];
  }

  cv.sections.forEach((section, i) => {
    const label = `sections[${i}]`;
    if (!isObj(section)) {
      err(label, 'must be an object');
      return;
    }
    takeId(section);

    /* key and kind decide everything downstream, so they are settled first and
       each can borrow from the other through the catalogue. A section outside
       the catalogue is allowed — it renders — but it is nearly always a typo,
       and normalise() will then add the real catalogue section alongside it. */
    let key = typeof section.key === 'string' ? section.key.trim() : '';
    const cat = CATALOGUE.get(key);
    const title = typeof section.title === 'string' ? section.title.trim() : '';
    const at = `${label}${title ? ` "${title}"` : key ? ` "${key}"` : ''}`;

    if (!key) {
      if (!title) { err(at, '"key" and "title" are both missing'); return; }
      key = title.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20) || `section${i}`;
      warn(at, `"key" is missing — using "${key}". Prefer one of the catalogue keys so the section switch matches`);
    } else if (!cat) {
      warn(at, `"key" is "${key}", which is not in the catalogue (${SECTION_CATALOGUE.map(c => c.key).join(', ')}) — it will still render`);
    }
    section.key = key;

    if (!title) {
      if (!cat) { err(at, '"title" is missing — it is the text of the heading bar'); return; }
      section.title = cat.title;
      warn(at, `"title" is missing — using "${cat.title}"`);
    } else {
      section.title = title;
    }

    if (section.kind == null && cat) section.kind = cat.kind;
    if (!KINDS.includes(section.kind)) {
      err(at, `"kind" is ${JSON.stringify(section.kind ?? null)} — it must be one of ${KINDS.join(', ')}`);
      return;
    }

    bool(section, 'enabled', at, true);
    bool(section, 'showYear', at, section.kind === 'list');
    if (section.inlineBar != null) bool(section, 'inlineBar', at, false);
    if (section.splitBar != null) bool(section, 'splitBar', at, false);
    if (section.label != null) text(section, 'label', at);

    for (const k of ['entries', 'blocks', 'rows', 'items']) list(section, k, at);

    /* Content filed under the wrong array is invisible rather than wrong: the
       renderer reads one array per kind and never looks at the others. */
    const own = CONTENT_KEY[section.kind];
    for (const k of ['entries', 'blocks', 'rows', 'items']) {
      if (k !== own && section[k].length) {
        warn(at, `a "${section.kind}" section reads its content from "${own}", so the ${section[k].length} item(s) in "${k}" will not appear`);
      }
    }
    if (section.enabled && !section[own].length) {
      warn(at, `switched on but "${own}" is empty — it will render as a heading bar with nothing under it`);
    }
    if (section.inlineBar && section.kind !== 'experience') {
      warn(at, '"inlineBar" only applies to an "experience" section — ignored');
    }

    if (section.kind === 'experience') section.entries.forEach((e, j) => checkEntry(e, `${at} › entries[${j}]`, section));
    else if (section.kind === 'list') section.blocks.forEach((b, j) => checkBlock(b, `${at} › blocks[${j}]`, section));
    else if (section.kind === 'education') section.rows.forEach((r, j) => checkEduRow(r, `${at} › rows[${j}]`));
    else if (section.kind === 'interests') checkInterests(section, at);
  });

  if (!errors.length && !cv.sections.some(s => isObj(s) && s.enabled)) {
    warn('top level', 'no section has "enabled": true — the CV will render as an empty page');
  }

  /* ---------- the pieces ---------- */

  function checkEntry(entry, at, section) {
    if (!isObj(entry)) { err(at, 'must be an object'); return; }
    takeId(entry);
    for (const f of ['org', 'role', 'dates']) text(entry, f, at);
    if (!entry.org && !entry.role && !entry.dates) {
      warn(at, 'has no organisation, role or dates — it will draw no bar');
    }
    /* A role with `splitBar` off is not a fault and is not reported:
       barParts() joins it onto the organisation with " – ", which is the
       arrangement both reference CVs use. */
    list(entry, 'blocks', at).forEach((b, k) => checkBlock(b, `${at} › blocks[${k}]`, section));
  }

  function checkBlock(block, at, section, { inCluster = false } = {}) {
    if (!isObj(block)) { err(at, 'must be an object'); return; }
    takeId(block);

    if (block.type == null) {
      block.type = Array.isArray(block.groups) ? 'cluster' : 'group';
      warn(at, `"type" is missing — read as a "${block.type}"`);
    }
    if (block.type !== 'group' && block.type !== 'cluster') {
      err(at, `"type" is ${JSON.stringify(block.type)} — it must be "group" or "cluster"`);
      return;
    }

    if (block.type === 'cluster') {
      if (inCluster) { err(at, 'a cluster cannot contain another cluster'); return; }
      text(block, 'label', at);
      const groups = list(block, 'groups', at);
      if (groups.length < 2) {
        warn(at, `a cluster is the vertical connector welding 2+ sub-headings together; this one has ${groups.length}. A single labelled block should be a "group"`);
      }
      groups.forEach((g, k) => checkBlock(g, `${at} › groups[${k}]`, section, { inCluster: true }));
      return;
    }

    text(block, 'label', at);
    const bullets = list(block, 'bullets', at);
    bullets.forEach((b, k) => checkBullet(bullets, k, `${at} › bullets[${k}]`));

    /* Two ways to carry a year and they are exclusive: renderYears() takes the
       per-bullet list whenever any of it is filled in, and ignores `year`. */
    const years = list(block, 'years', at);
    years.forEach((y, k) => { if (y != null && typeof y !== 'string') { warn(`${at} › years[${k}]`, 'must be text'); years[k] = String(y); } });
    text(block, 'year', at);
    if (years.some(Boolean) && block.year) {
      warn(at, 'has both "year" and per-bullet "years" — the per-bullet list wins and "year" is ignored');
    }
    if (years.length > bullets.length) {
      warn(at, `"years" has ${years.length} entries for ${bullets.length} bullet(s) — the extra ones are ignored`);
    }
    if ((years.some(Boolean) || block.year) && !section.showYear) {
      warn(at, 'carries a year, but the section has "showYear": false, so no year column is drawn');
    }
  }

  function checkBullet(bullets, k, at) {
    let b = bullets[k];

    /* The single most likely shape an LLM returns: a list of strings. It has
       one reading, so take it rather than refuse the file. */
    if (typeof b === 'string') {
      b = bullets[k] = { id: uid(), text: b, mute: [] };
      warn(at, 'is a bare string — read as { "id": …, "text": …, "mute": [] }');
    }
    if (!isObj(b)) { err(at, 'must be an object with a "text" field'); return; }

    takeId(b);
    text(b, 'text', at, { required: true });
    if (b.text && !b.text.trim()) warn(at, 'is blank — it will not render');

    /* Unbalanced ** renders as literal asterisks in the CV and in the export;
       textRuns() only pairs them up, it does not repair them. */
    const stars = (b.text.match(/\*\*/g) || []).length;
    if (stars % 2) warn(at, 'has an odd number of ** markers — bold must be opened and closed, like **this**');
    if (/\*\*\*\*/.test(b.text)) warn(at, 'contains **** — an empty bold marker renders as four asterisks');

    if (b.mute == null) b.mute = [];
    else if (!Array.isArray(b.mute)) {
      warn(at, '"mute" must be a list of numbers — cleared');
      b.mute = [];
    } else {
      const clean = b.mute.filter(n => Number.isInteger(n) && n >= 0);
      if (clean.length !== b.mute.length) warn(at, '"mute" holds something other than whole numbers — those entries were dropped');
      b.mute = clean;
    }
  }

  function checkEduRow(row, at) {
    if (!isObj(row)) { err(at, 'must be an object'); return; }
    takeId(row);
    for (const f of ['degree', 'institute', 'score', 'detail', 'year']) text(row, f, at);
    if (!row.degree && !row.institute) warn(at, 'has neither a degree nor an institute — it will render as an empty row');
  }

  function checkInterests(section, at) {
    section.items = section.items.map((it, k) => {
      if (typeof it === 'string') return it;
      if (it == null) return '';
      /* A row of { name: … } objects is the other shape an LLM reaches for. */
      if (isObj(it) && typeof it.text === 'string') { warn(`${at} › items[${k}]`, 'is an object — took its "text"'); return it.text; }
      if (isObj(it) && typeof it.name === 'string') { warn(`${at} › items[${k}]`, 'is an object — took its "name"'); return it.name; }
      warn(`${at} › items[${k}]`, 'must be plain text — dropped');
      return '';
    }).filter(Boolean);
    if (!section.label) {
      section.label = 'Hobbies';
      warn(at, 'has no "label" — the row is labelled "Hobbies"');
    }
    /* The row is one line of equal cells across the content width, so its
       count is what decides whether each one still reads. Six is where the
       reference CVs stop. */
    if (section.items.length > 6) {
      warn(at, `${section.items.length} interests share one row; past about 6 the cells get too narrow to read`);
    }
  }

  if (mintedIds) {
    warnings.push(`ids — ${mintedIds} item(s) had a missing or duplicated "id" and were given fresh ones. Ids must be unique across the whole file`);
  }

  return { ok: errors.length === 0, data: errors.length ? null : cv, errors, warnings };
}

/* ---------- when it does not even parse ----------
   A file that fails `JSON.parse` never reaches validateCV, and the browser's
   own message is close to useless on its own: V8 dropped the character offset
   from most of them, so what comes back is a fragment of the line and nothing
   to find it by.

   One mistake accounts for nearly all of it, and it was found in the wild
   rather than guessed at. A model writing a bullet whose text begins with `**`
   drops the opening quote — `"text": **Saved Rs. 20L/yr** and …"` — and does
   it on 30 of 45 bullets while getting the first bullet of every group right.
   It is invisible at a glance, because every line still ends with `",`. So
   look for exactly that and name the lines. */
export function explainParseError(text, err) {
  const lines = [`this file is not valid JSON — ${err && err.message}`];
  if (!text) return lines;

  const unquoted = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (/"\w+"\s*:\s*\*\*/.test(line)) unquoted.push(i + 1);
  });

  if (unquoted.length) {
    const shown = unquoted.slice(0, 12).join(', ') + (unquoted.length > 12 ? `, …` : '');
    lines.push(
      `${unquoted.length} line(s) start a piece of text with ** but are missing the opening quote — line(s) ${shown}`,
      'Each of those needs to read  "text": "**Like this** …"  rather than  "text": **Like this** …"',
      'That is the whole fault: the text itself is fine, only the quote in front of it is missing.'
    );
  }
  return lines;
}

/** The report, as text — written to be pasted back to whatever produced the file. */
export function formatReport({ errors, warnings }, { cap = 40 } = {}) {
  const block = (heading, lines) => {
    if (!lines.length) return [];
    const shown = lines.slice(0, cap).map(l => `  • ${l}`);
    if (lines.length > cap) shown.push(`  … and ${lines.length - cap} more`);
    return [heading, ...shown, ''];
  };
  return [
    ...block(`${errors.length} problem(s) that stop this file being imported:`, errors),
    ...block(`${warnings.length} thing(s) that were adjusted or are worth checking:`, warnings)
  ].join('\n').trimEnd();
}
