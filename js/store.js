/* store.js — state, undo/redo, autosave, JSON import/export.
   Mutations go through update(); every call snapshots the previous state, so
   undo is free and the preview only ever re-renders from committed state. */

const KEY = 'iima-cv-builder:v1';
const HISTORY_CAP = 60;

const clone = obj => (typeof structuredClone === 'function'
  ? structuredClone(obj)
  : JSON.parse(JSON.stringify(obj)));

export function createStore(initial) {
  let state = clone(initial);
  let past = [];
  let future = [];
  const subs = new Set();
  let saveTimer = null;

  const notify = () => { for (const fn of subs) fn(state); };

  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch { /* quota or private mode — preview still works, just no autosave */ }
    }, 400);
  };

  return {
    get: () => state,
    subscribe(fn) { subs.add(fn); fn(state); return () => subs.delete(fn); },

    /** @param {(draft:any)=>void} fn mutate the draft in place */
    update(fn, { history = true } = {}) {
      const draft = clone(state);
      fn(draft);
      if (history) {
        past.push(state);
        if (past.length > HISTORY_CAP) past.shift();
        future = [];
      }
      state = draft;
      persist();
      notify();
    },

    /** Replace wholesale (sample load, JSON import). */
    replace(next) {
      past.push(state);
      future = [];
      state = clone(next);
      persist();
      notify();
    },

    undo() {
      if (!past.length) return false;
      future.push(state);
      state = past.pop();
      persist();
      notify();
      return true;
    },
    redo() {
      if (!future.length) return false;
      past.push(state);
      state = future.pop();
      persist();
      notify();
      return true;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0
  };
}

export function loadSaved() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.version ? data : null;
  } catch { return null; }
}

export function clearSaved() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to do */ }
}

/* ---------- files ---------- */

export function exportJSON(state, filename = 'cv.json') {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Reads and parses only. **Whether the contents are a usable CV is
   validate.js's question, not this one's** — a file can now be written by an
   LLM from IMPORT.md rather than by this app's own Export, and "does it have a
   version field" is nowhere near enough of a check. Anything beyond a parse
   error belongs in the report the caller shows. */
export function importJSON() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return reject(new Error('No file chosen'));
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result);
        try {
          resolve(JSON.parse(text));
        } catch (e) {
          /* The file's text is carried on the error so the caller can say
             *where* it went wrong — see explainParseError in validate.js.
             Doing that here would drag the gate's job into the reader. */
          e.text = text;
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };
    input.click();
  });
}
