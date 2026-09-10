/**
 * Materials list: hovering (or focusing) a category grows its green hairline and
 * echoes the name in the sticky panel beside the list.
 *
 * Two listeners on the container rather than twelve on the rows, and the panel
 * text is the only thing written per interaction — no layout reads, no GSAP.
 */

const RESTING = 'Seis categorías, un mismo proveedor.';

export function initMaterials() {
  const list = document.querySelector('[data-materials]');
  if (!list) return () => {};

  const indexOut = document.querySelector('[data-material-display-index]');
  const nameOut = document.querySelector('[data-material-display-name]');

  let active = null;

  function setActive(row) {
    if (row === active) return;
    active?.classList.remove('is-active');
    active = row;

    if (!row) {
      list.classList.remove('is-engaged');
      if (indexOut) indexOut.textContent = '—';
      if (nameOut) nameOut.textContent = RESTING;
      return;
    }

    row.classList.add('is-active');
    list.classList.add('is-engaged');
    if (indexOut) indexOut.textContent = row.dataset.index ?? '';
    if (nameOut) nameOut.textContent = row.querySelector('.material__name')?.textContent.trim() ?? '';
  }

  const onOver = (event) => setActive(event.target.closest('[data-material]'));
  const onLeave = () => setActive(null);

  list.addEventListener('pointerover', onOver);
  list.addEventListener('pointerleave', onLeave);
  // keyboard users tabbing through the section get the same feedback
  list.addEventListener('focusin', onOver);
  list.addEventListener('focusout', onLeave);

  return () => {
    list.removeEventListener('pointerover', onOver);
    list.removeEventListener('pointerleave', onLeave);
    list.removeEventListener('focusin', onOver);
    list.removeEventListener('focusout', onLeave);
    setActive(null);
  };
}
