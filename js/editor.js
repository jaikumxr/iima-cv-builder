/* editor.js — the left-hand authoring pane.

   Re-render policy: structural edits (add/remove/reorder/toggle) rebuild the
   pane; typing does not, so the caret never jumps. Text edits still push to
   the store, they just don't trigger an editor rebuild. */

import { mkBullet, mkGroup, mkCluster, mkEntry, mkEduRow } from './schema.js';
import { makeSortable, moveItem } from './sortable.js';
import { countMetrics } from './metrics.js';

/* ---------- tiny DOM helper ---------- */

function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return n;
}

const btn = (label, cls, onClick, title) =>
  h('button', { type: 'button', class: cls, onClick, title: title || label }, label);

/* ---------- locate a node (and its parent array) by id ---------- */

export function locate(cv, id) {
  let found = null;
  const scan = arr => {
    if (!Array.isArray(arr)) return;
    const i = arr.findIndex(x => x && x.id === id);
    if (i >= 0) found = { arr, index: i, node: arr[i] };
  };

  scan(cv.sections);
  for (const s of cv.sections) {
    scan(s.entries); scan(s.blocks); scan(s.rows);
    const blocks = [...(s.blocks || [])];
    for (const e of s.entries || []) { scan(e.blocks); blocks.push(...(e.blocks || [])); }
    for (const b of blocks) {
      if (b.type === 'cluster') {
        scan(b.groups);
        for (const g of b.groups) scan(g.bullets);
      } else {
        scan(b.bullets);
      }
    }
  }
  return found;
}

/* ---------- moving a block between containers ---------- */

/* A connector labels two or more sub-headings. One left is just a sub-heading
   and none is nothing, so either state is folded back into plain blocks —
   dragging the second-to-last group out of a connector must not leave the CV
   with something it cannot render. */
function tidyClusters(cv) {
  for (const s of cv.sections) {
    for (const arr of [s.blocks, ...(s.entries || []).map(e => e.blocks)]) {
      if (!Array.isArray(arr)) continue;
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i].type !== 'cluster') continue;
        const { groups } = arr[i];
        if (groups.length === 0) arr.splice(i, 1);
        else if (groups.length === 1) arr.splice(i, 1, groups[0]);
      }
    }
  }
}

/* Pull the block with this id out of wherever it lives and drop it into `dest`
   at `at`. Backs every cross-container drag: a sub-heading into a connector,
   out of one, or across organisations. */
function transfer(cv, id, dest, at) {
  const from = locate(cv, id);
  if (!from || !Array.isArray(dest) || from.arr === dest) return;
  from.arr.splice(from.index, 1);
  dest.splice(Math.max(0, Math.min(at, dest.length)), 0, from.node);
  tidyClusters(cv);
}

/* ---------- the editor ---------- */

export function createEditor({ mount, store, onPreview }) {
  let open = new Set();          // expanded section ids survive re-renders
  let tooLong = new Set();       // bullet ids that could not be fitted to one line

  /** Structural change: mutate, then rebuild the pane. */
  const commit = fn => { store.update(fn); render(); };
  /** Text change: mutate and refresh the preview only. */
  const commitText = fn => { store.update(fn, { history: false }); onPreview(); };

  const setField = (id, key) => e => commitText(d => { const f = locate(d, id); if (f) f.node[key] = e.target.value; });

  /* ---- reusable controls ---- */

  const dragHandle = (title = 'Drag to reorder') => h('span', { class: 'grip', draggable: 'true', title }, '⠿');

  const moveBtns = (id, delta) => [
    btn('↑', 'icon', () => commit(d => { const f = locate(d, id); if (f) moveItem(f.arr, f.index, f.index - 1); }), 'Move up'),
    btn('↓', 'icon', () => commit(d => { const f = locate(d, id); if (f) moveItem(f.arr, f.index, f.index + 1); }), 'Move down')
  ];

  const delBtn = (id, label) => btn('✕', 'icon icon--danger', () => {
    if (!confirm(`Delete this ${label}?`)) return;
    commit(d => { const f = locate(d, id); if (f) f.arr.splice(f.index, 1); });
  }, `Delete ${label}`);

  function textarea(value, onInput, placeholder) {
    const ta = h('textarea', { class: 'ta', rows: '1', placeholder: placeholder || '', onInput });
    ta.value = value || '';
    const grow = () => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; };
    ta.addEventListener('input', grow);
    // Ctrl/Cmd+B wraps the selection in ** ** — forced bold beyond auto-metrics
    ta.addEventListener('keydown', e => {
      if (!(e.key === 'b' || e.key === 'B') || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const { selectionStart: s, selectionEnd: t, value: v } = ta;
      if (s === t) return;
      const sel = v.slice(s, t);
      const wrapped = sel.startsWith('**') && sel.endsWith('**');
      const next = wrapped ? sel.slice(2, -2) : `**${sel}**`;
      ta.value = v.slice(0, s) + next + v.slice(t);
      ta.setSelectionRange(s, s + next.length);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    requestAnimationFrame(grow);
    return ta;
  }

  /* ---- bullets ---- */

  function bulletList(group) {
    const list = h('div', { class: 'bullets' });

    for (const b of group.bullets) {
      const ta = textarea(b.text, e => commitText(d => { const f = locate(d, b.id); if (f) f.node.text = e.target.value; }),
        'Bullet text — Ctrl+B to bold a selection');

      const n = countMetrics(b.text);
      const warn = h('span', {
        class: 'warn',
        title: 'Reduce text — this point will not fit on one line'
      }, '⚠');
      warn.hidden = !tooLong.has(b.id);

      list.appendChild(h('div', { class: 'bullet-row', dataset: { id: b.id } },
        dragHandle(),
        ta,
        warn,
        h('span', { class: 'metric-count', title: `${n} auto-detected metric${n === 1 ? '' : 's'}` }, n ? `${n}◆` : ''),
        h('span', { class: 'row-tools' }, ...moveBtns(b.id), delBtn(b.id, 'bullet'))
      ));
    }

    makeSortable(list, {
      itemSel: '.bullet-row',
      handleSel: '.grip',
      onMove: (from, to) => commit(d => { const g = locate(d, group.id); if (g) moveItem(g.node.bullets, from, to); })
    });

    list.appendChild(btn('+ Bullet', 'add', () =>
      commit(d => { const g = locate(d, group.id); if (g) g.node.bullets.push(mkBullet('')); })));
    return list;
  }

  /* ---- a group (label + bullets + optional year) ---- */

  function groupCard(group, section, { inCluster = false } = {}) {
    const perBullet = (group.years || []).some(Boolean);

    /* Grouped sub-headings are draggable too — that is how one is taken back
       out of a connector. */
    const head = h('div', { class: 'grp-head' },
      dragHandle(inCluster ? 'Drag to reorder, or out of this connector' : 'Drag to reorder'),
      h('input', { class: 'in in--label', value: group.label || '', placeholder: 'Sub-heading (e.g. Business Impact)', onInput: setField(group.id, 'label') }),
      section.showYear && !perBullet
        ? h('input', { class: 'in in--year', value: group.year || '', placeholder: 'Year', onInput: setField(group.id, 'year') })
        : null,
      section.showYear
        ? h('label', { class: 'chk', title: 'One year per bullet instead of one for the whole group' },
            h('input', {
              type: 'checkbox', checked: perBullet,
              onChange: e => commit(d => {
                const g = locate(d, group.id).node;
                g.years = e.target.checked ? g.bullets.map(() => g.year || '') : [];
              })
            }), 'per-bullet')
        : null,
      h('span', { class: 'row-tools' }, ...moveBtns(group.id), delBtn(group.id, 'group'))
    );

    const card = h('div', { class: 'grp', dataset: { id: group.id } }, head, bulletList(group));

    if (perBullet) {
      const years = h('div', { class: 'years' },
        h('span', { class: 'hint' }, 'Years, one per bullet:'),
        ...group.bullets.map((b, i) =>
          h('input', {
            class: 'in in--year', value: (group.years || [])[i] || '', placeholder: '—',
            onInput: e => commitText(d => { const g = locate(d, group.id).node; g.years[i] = e.target.value; })
          }))
      );
      card.appendChild(years);
    }
    return card;
  }

  /* ---- a cluster (vertical connector spanning 2+ groups) ---- */

  function clusterCard(cluster, section) {
    const inner = h('div', { class: 'cluster-groups' },
      ...cluster.groups.map(g => groupCard(g, section, { inCluster: true })));

    makeSortable(inner, {
      itemSel: '.grp',
      handleSel: '.grip',
      onMove: (from, to) => commit(d => { const c = locate(d, cluster.id); if (c) moveItem(c.node.groups, from, to); }),
      /* Drop a sub-heading in here to put it under this connector. Connectors
         do not nest, so one dragged onto another is refused. */
      canAdopt: item => !item.classList.contains('grp--cluster'),
      onAdopt: (item, at) => commit(d => {
        const c = locate(d, cluster.id);
        if (c) transfer(d, item.dataset.id, c.node.groups, at);
      })
    });

    return h('div', { class: 'grp grp--cluster', dataset: { id: cluster.id } },
      h('div', { class: 'grp-head' },
        dragHandle(),
        h('span', { class: 'tag' }, 'connector'),
        h('input', { class: 'in in--label', value: cluster.label || '', placeholder: 'Connector label (e.g. Responsibilities)', onInput: setField(cluster.id, 'label') }),
        h('span', { class: 'row-tools' },
          btn('⇤', 'icon', () => commit(d => {
            // ungroup: splice the cluster's groups back in where it sat
            const f = locate(d, cluster.id);
            if (f) f.arr.splice(f.index, 1, ...f.node.groups);
          }), 'Ungroup — split back into separate sub-headings'),
          ...moveBtns(cluster.id), delBtn(cluster.id, 'connector group'))
      ),
      inner,
      h('div', { class: 'add-row' },
        btn('+ Sub-heading', 'add', () =>
          commit(d => { const c = locate(d, cluster.id); if (c) c.node.groups.push(mkGroup('New sub-heading')); })),
        h('span', { class: 'hint' }, 'or drag an existing sub-heading in'))
    );
  }

  const blockCard = (block, section) =>
    block.type === 'cluster' ? clusterCard(block, section) : groupCard(block, section);

  /* Both list-sections and experience entries hold their blocks in `.blocks`,
     so ownerId is enough to find the array either way. */
  function blockList(blocks, section, ownerId) {
    const list = h('div', { class: 'blocks' }, ...blocks.map(b => blockCard(b, section)));

    makeSortable(list, {
      itemSel: '.grp',
      handleSel: '.grip',
      onMove: (from, to) => commit(d => moveItem(locate(d, ownerId).node.blocks, from, to)),
      /* The inverse: drag a sub-heading off a connector to stand on its own
         again, or move one between organisations. */
      onAdopt: (item, at) => commit(d => {
        const owner = locate(d, ownerId);
        if (owner) transfer(d, item.dataset.id, owner.node.blocks, at);
      })
    });

    /* Weld the trailing plain sub-headings together under one vertical label —
       how the light sample's "Responsibilities" connector is built. */
    const plainTail = () => {
      let n = 0;
      for (let i = blocks.length - 1; i >= 0 && blocks[i].type !== 'cluster'; i--) n++;
      return n;
    };

    list.appendChild(h('div', { class: 'add-row' },
      btn('+ Sub-heading', 'add', () =>
        commit(d => { locate(d, ownerId).node.blocks.push(mkGroup('New sub-heading')); })),
      btn('+ Vertical connector', 'add add--alt', () =>
        commit(d => { locate(d, ownerId).node.blocks.push(mkCluster()); }),
        'A vertical label spanning two or more sub-headings'),
      plainTail() >= 2
        ? btn('⇥ Weld last 2', 'add add--alt', () => commit(d => {
            const arr = locate(d, ownerId).node.blocks;
            const taken = arr.splice(arr.length - 2, 2);
            arr.push(mkCluster('Responsibilities', taken));
          }), 'Group the last two sub-headings under one vertical connector')
        : null
    ));
    return list;
  }

  /* ---- section bodies by kind ---- */

  function experienceBody(section) {
    const wrap = h('div', { class: 'entries' });

    for (const entry of section.entries) {
      wrap.appendChild(h('div', { class: 'entry', dataset: { id: entry.id } },
        h('div', { class: 'entry-head' },
          dragHandle(),
          h('input', { class: 'in', value: entry.org || '', placeholder: 'Organisation (Duration) – Role', onInput: setField(entry.id, 'org') }),
          h('input', { class: 'in in--dates', value: entry.dates || '', placeholder: '(Mon YYYY – Mon YYYY)', onInput: setField(entry.id, 'dates') }),
          h('span', { class: 'row-tools' }, ...moveBtns(entry.id), delBtn(entry.id, 'entry'))
        ),
        blockList(entry.blocks, section, entry.id)
      ));
    }

    makeSortable(wrap, {
      itemSel: '.entry',
      handleSel: '.grip',
      onMove: (from, to) => commit(d => moveItem(locate(d, section.id).node.entries, from, to))
    });

    wrap.appendChild(btn('+ Organisation', 'add', () =>
      commit(d => { locate(d, section.id).node.entries.push(mkEntry('', '', [mkGroup('')])); })));
    return wrap;
  }

  const listBody = section => blockList(section.blocks, section, section.id);

  function educationBody(section) {
    const wrap = h('div', { class: 'edu' });
    for (const r of section.rows) {
      wrap.appendChild(h('div', { class: 'edu-row', dataset: { id: r.id } },
        dragHandle(),
        h('input', { class: 'in in--deg', value: r.degree, placeholder: 'Degree', onInput: setField(r.id, 'degree') }),
        h('input', { class: 'in', value: r.institute, placeholder: 'Institute', onInput: setField(r.id, 'institute') }),
        h('input', { class: 'in in--score', value: r.score, placeholder: 'Score', onInput: setField(r.id, 'score') }),
        h('input', { class: 'in', value: r.detail, placeholder: 'Detail', onInput: setField(r.id, 'detail') }),
        h('input', { class: 'in in--year', value: r.year, placeholder: 'Year', onInput: setField(r.id, 'year') }),
        h('span', { class: 'row-tools' }, ...moveBtns(r.id), delBtn(r.id, 'row'))
      ));
    }
    makeSortable(wrap, {
      itemSel: '.edu-row',
      handleSel: '.grip',
      onMove: (from, to) => commit(d => moveItem(locate(d, section.id).node.rows, from, to))
    });
    wrap.appendChild(btn('+ Row', 'add', () =>
      commit(d => { locate(d, section.id).node.rows.push(mkEduRow()); })));
    return wrap;
  }

  function interestsBody(section) {
    return h('div', { class: 'interests' },
      h('div', { class: 'edu-row' },
        h('input', { class: 'in in--deg', value: section.label || '', placeholder: 'Label (Hobbies)', onInput: setField(section.id, 'label') }),
        h('input', {
          class: 'in', value: (section.items || []).join(', '), placeholder: 'Comma-separated: Guitar, Drums, Chess',
          onInput: e => commitText(d => {
            locate(d, section.id).node.items = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
          })
        })
      ),
      h('p', { class: 'hint' }, 'Each item becomes an equal-width cell across the row.'));
  }

  const BODIES = { experience: experienceBody, list: listBody, education: educationBody, interests: interestsBody };

  /* ---- section card ---- */

  function sectionCard(section, cv, index) {
    const isOpen = open.has(section.id);

    const head = h('div', { class: 'sec-head' },
      dragHandle(),
      h('label', { class: 'sw', title: section.enabled ? 'Shown on the CV' : 'Hidden' },
        h('input', {
          type: 'checkbox', checked: section.enabled,
          onChange: e => commit(d => { locate(d, section.id).node.enabled = e.target.checked; })
        }), h('span', {})),
      h('input', { class: 'in in--sec', value: section.title, onInput: setField(section.id, 'title') }),
      section.kind === 'list' || section.kind === 'experience'
        ? h('label', { class: 'chk', title: 'Show the right-hand year column' },
            h('input', {
              type: 'checkbox', checked: !!section.showYear,
              onChange: e => commit(d => { locate(d, section.id).node.showYear = e.target.checked; })
            }), 'year')
        : null,
      section.kind === 'experience'
        ? h('label', { class: 'chk', title: 'Fold the first organisation into the heading bar' },
            h('input', {
              type: 'checkbox', checked: !!section.inlineBar,
              onChange: e => commit(d => { locate(d, section.id).node.inlineBar = e.target.checked; })
            }), 'inline bar')
        : null,
      h('span', { class: 'sec-warn warn', hidden: true, title: 'Points in this section need shortening' }, ''),
      h('span', { class: 'row-tools' },
        ...moveBtns(section.id),
        btn(isOpen ? '▾' : '▸', 'icon', () => {
          isOpen ? open.delete(section.id) : open.add(section.id);
          render();
        }, isOpen ? 'Collapse' : 'Expand'))
    );

    const card = h('div', {
      class: `sec-card${section.enabled ? '' : ' is-off'}`,
      dataset: { id: section.id }
    }, head);

    if (isOpen) card.appendChild(h('div', { class: 'sec-body' }, (BODIES[section.kind] || listBody)(section)));
    return card;
  }

  /* ---- header + contact ---- */

  function identityBlock(cv) {
    const f = (label, path, value, placeholder) =>
      h('label', { class: 'field' }, h('span', {}, label),
        h('input', {
          class: 'in', value: value || '', placeholder: placeholder || '',
          onInput: e => commitText(d => { const [a, b] = path.split('.'); d[a][b] = e.target.value; })
        }));

    return h('div', { class: 'pane-block' },
      h('h2', {}, 'Identity'),
      h('div', { class: 'grid grid--4' },
        f('Name', 'header.name', cv.header.name, 'Your Name'),
        f('Programme', 'header.program', cv.header.program, 'PGP 25331'),
        f('Gender', 'header.gender', cv.header.gender, 'Male'),
        f('Age', 'header.age', cv.header.age, '24')
      ),
      h('h2', {}, 'Contact bar'),
      h('div', { class: 'grid grid--3' },
        f('Phone', 'contact.phone', cv.contact.phone, '+91 …'),
        f('Address', 'contact.address', cv.contact.address, 'Dorm …, IIM Ahmedabad'),
        f('Email', 'contact.email', cv.contact.email, 'p26…@iima.ac.in')
      )
    );
  }

  /* ---- render ---- */

  function render() {
    const cv = store.get();
    const scrollTop = mount.scrollTop;
    mount.innerHTML = '';

    mount.appendChild(identityBlock(cv));

    const secWrap = h('div', { class: 'sections' },
      ...cv.sections.map((s, i) => sectionCard(s, cv, i)));

    /* Layout presets set a starting order and nothing more - every section
       stays draggable afterwards. */
    makeSortable(secWrap, {
      itemSel: '.sec-card',
      handleSel: '.grip',
      onMove: (from, to) => commit(d => moveItem(d.sections, from, to))
    });

    mount.appendChild(h('div', { class: 'pane-block' },
      h('h2', {}, 'Sections',
        h('span', { class: 'hint hint--inline' }, ' — toggle to show/hide, drag to reorder')),
      secWrap));

    mount.scrollTop = scrollTop;
    onPreview();
  }

  /* Which section owns a bullet? Needed because sections start collapsed, so a
     per-bullet icon alone would be invisible until you went looking. */
  function sectionOf(cv, bulletId) {
    for (const s of cv.sections) {
      const blocks = [...(s.blocks || []), ...(s.entries || []).flatMap(e => e.blocks || [])];
      for (const block of blocks) {
        const groups = block.type === 'cluster' ? block.groups : [block];
        for (const g of groups) {
          if ((g.bullets || []).some(b => b.id === bulletId)) return s.id;
        }
      }
    }
    return null;
  }

  /* Updated in place, never by re-rendering: this runs after every preview
     redraw, including on each keystroke, and a rebuild would move the caret. */
  function markTooLong(ids) {
    tooLong = new Set(ids);

    for (const row of mount.querySelectorAll('.bullet-row')) {
      const icon = row.querySelector('.warn');
      if (icon) icon.hidden = !tooLong.has(row.dataset.id);
    }

    const cv = store.get();
    const counts = new Map();
    for (const id of tooLong) {
      const sid = sectionOf(cv, id);
      if (sid) counts.set(sid, (counts.get(sid) || 0) + 1);
    }
    for (const card of mount.querySelectorAll('.sec-card')) {
      const badge = card.querySelector('.sec-warn');
      if (!badge) continue;
      const n = counts.get(card.dataset.id) || 0;
      badge.hidden = n === 0;
      badge.textContent = n ? `⚠ ${n}` : '';
    }
  }

  return { render, markTooLong, expandAll: () => { store.get().sections.forEach(s => open.add(s.id)); render(); }, collapseAll: () => { open = new Set(); render(); } };
}
