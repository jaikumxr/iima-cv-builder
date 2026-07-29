/* sortable.js — drag-to-reorder for a flat list of sibling elements.
   Deliberately tiny: HTML5 drag events, no dependency, works with the
   keyboard fallback (the ↑/↓ buttons the editor renders alongside).

   A drag can also cross containers: give a container `onAdopt` and it will
   accept an item dragged in from a different one, which is how a sub-heading
   is dropped into a vertical connector and back out again. */

/* Chrome reports a *Text* node as the target of a drag event whenever the
   pointer happens to be over text, and Text has no .closest(). Every target
   goes through here. */
const asEl = t => (t && t.nodeType === 1 ? t : (t && t.parentElement) || null);

/* The drag in flight, module-wide so a container that did not start it can
   still decide whether to take it. */
let dragging = null;   // { item, container }

/* dragend only fires on the element the drag started from, so a container the
   pointer merely passed through never hears about it. Clean up globally. */
document.addEventListener('dragend', () => {
  dragging = null;
  for (const n of document.querySelectorAll('.is-dragging, .is-over-top, .is-over-bottom, .is-adopting')) {
    n.classList.remove('is-dragging', 'is-over-top', 'is-over-bottom', 'is-adopting');
  }
});

export function makeSortable(container, { itemSel, handleSel, onMove, canMove, canAdopt, onAdopt }) {
  let fromIndex = -1;

  const items = () => Array.from(container.querySelectorAll(`:scope > ${itemSel}`));

  /* This container's own child that the event landed on. Null for anything
     nested deeper — a group inside a connector belongs to the connector's
     list, not to the block list the connector itself sits in. */
  const ownItem = target => {
    const item = asEl(target)?.closest(itemSel);
    return item && item.parentElement === container ? item : null;
  };

  /* An item dragged in from elsewhere that this container will take. The
     itemSel check is what stops a section card from being dropped into a
     bullet list — every container on the page sees every drag. */
  const incoming = () => {
    if (!onAdopt || !dragging || dragging.container === container) return null;
    if (!dragging.item.matches(itemSel)) return null;
    return !canAdopt || canAdopt(dragging.item) ? dragging.item : null;
  };

  container.addEventListener('dragstart', e => {
    const el = asEl(e.target);
    if (!el) return;
    const handle = handleSel ? el.closest(handleSel) : el;
    if (!handle) return;
    const item = ownItem(e.target);
    if (!item) return;

    fromIndex = items().indexOf(item);
    if (canMove && !canMove(fromIndex)) { e.preventDefault(); return; }

    /* Sortable containers nest — a bullet list sits inside a block list inside
       an entry list inside the section list — and every one of them finds an
       item of its own on the way up from the grip. Without this the outermost
       claims the drag, and dropping a sub-heading reorders whole sections. */
    e.stopPropagation();
    dragging = { item, container };
    item.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    // Firefox refuses to start a drag without payload
    e.dataTransfer.setData('text/plain', String(fromIndex));
  });

  container.addEventListener('dragend', () => { fromIndex = -1; });

  container.addEventListener('dragleave', e => {
    if (!container.contains(asEl(e.relatedTarget))) container.classList.remove('is-adopting');
  });

  container.addEventListener('dragover', e => {
    const adopt = fromIndex < 0 ? incoming() : null;
    if (fromIndex < 0 && !adopt) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    /* Containers nest, so this container and the one it sits in would both
       claim the same drop — reordering inside a connector while the block list
       above simultaneously adopted the group straight back out. Innermost wins. */
    e.stopPropagation();

    const list = items();
    for (const n of list) n.classList.remove('is-over-top', 'is-over-bottom');
    container.classList.toggle('is-adopting', !!adopt);

    const over = ownItem(e.target);
    if (!over) return;
    const box = over.getBoundingClientRect();
    const after = e.clientY > box.top + box.height / 2;
    over.classList.add(after ? 'is-over-bottom' : 'is-over-top');
  });

  container.addEventListener('drop', e => {
    const adopt = fromIndex < 0 ? incoming() : null;
    if (fromIndex < 0 && !adopt) return;
    e.preventDefault();
    e.stopPropagation();

    const list = items();
    for (const n of list) n.classList.remove('is-over-top', 'is-over-bottom');
    container.classList.remove('is-adopting');

    const over = ownItem(e.target);
    /* Where the pointer sits, as an index into the list *before* anything
       moves. Dropped past the last item — on a connector's own header, say —
       it lands at the end. */
    let at = list.length;
    if (over) {
      const box = over.getBoundingClientRect();
      at = list.indexOf(over) + (e.clientY > box.top + box.height / 2 ? 1 : 0);
    }

    if (adopt) { onAdopt(adopt, at); return; }

    if (!over || over.parentElement !== container) return;
    let to = at;
    if (to > fromIndex) to -= 1;                 // account for the item leaving
    if (to === fromIndex) return;
    if (canMove && !canMove(fromIndex, to)) return;

    onMove(fromIndex, to);
  });
}

/** Move an item within an array, in place. */
export function moveItem(arr, from, to) {
  if (from === to || from < 0 || from >= arr.length) return arr;
  const clamped = Math.max(0, Math.min(arr.length - 1, to));
  arr.splice(clamped, 0, arr.splice(from, 1)[0]);
  return arr;
}
