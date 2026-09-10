const FINE_POINTER = '(hover: hover) and (pointer: fine)';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Native links own keyboard navigation; the schematics are decorative. */
export function initServices(root = document.querySelector('[data-services]')) {
  const { gsap, ScrollTrigger } = window;
  if (!root || !gsap || !ScrollTrigger) return () => {};

  const rows = [...root.querySelectorAll('[data-service]')];
  if (!rows.length) return () => {};
  gsap.registerPlugin(ScrollTrigger);

  const list = root.querySelector('.services__list');
  const heading = root.querySelector('.services__heading');
  const media = gsap.matchMedia();
  let disposed = false;

  // matchMedia is also the GSAP context: every timeline, quickTo tween and
  // ScrollTrigger below is created here, once per mode, and reverted together.
  media.add({
    all: '(min-width: 0px)',
    fine: FINE_POINTER,
    compact: '(max-width: 599px)',
    reduced: REDUCED_MOTION,
  }, ({ conditions: { fine, compact, reduced } }) => {
    const listeners = [];
    const played = new Set();
    const entrances = [];
    const scenes = reduced ? [] : rows.map((row) => createScene(row, gsap, !fine || compact));
    let active = -1;
    let hovered = -1;

    root.classList.toggle('services--animated', !reduced);

    function listen(element, type, handler) {
      element.addEventListener(type, handler);
      listeners.push(() => element.removeEventListener(type, handler));
    }

    function indexOf(element) {
      return rows.findIndex((row) => element && row.contains(element));
    }

    function deactivateService(index) {
      if (index < 0) return;
      rows[index].classList.remove('is-active');
      if (!reduced && fine) {
        scenes[index].sequence.pause();
        scenes[index].visibility.reverse();
      }
    }

    function activateService(index) {
      if (index < 0 || index === active) return;
      deactivateService(active);
      active = index;
      rows[index].classList.add('is-active');
      if (reduced) return;

      // Touch diagrams stay complete after their single pass. Hover sequences
      // can replay, using the same timelines even under rapid pointer changes.
      if (fine || !played.has(index)) {
        scenes[index].sequence.restart();
        scenes[index].visibility.play();
        played.add(index);
      }
    }

    function syncInteraction(focused = indexOf(document.activeElement)) {
      const next = focused >= 0 ? focused : hovered;
      root.classList.toggle('services--engaged', fine && next >= 0);
      if (next >= 0) activateService(next);
    }

    listen(list, 'focusin', (event) => {
      const index = indexOf(event.target);
      // A focus jump must never leave the link behind an unfinished entrance.
      entrances.forEach((entrance) => entrance.progress(1));
      if (index >= 0) activateService(index);
      syncInteraction(index);
    });
    listen(list, 'focusout', (event) => syncInteraction(indexOf(event.relatedTarget)));

    if (fine) {
      rows.forEach((row, index) => {
        const cursor = row.querySelector('.service__cursor');
        const moveCursor = reduced ? null : gsap.quickTo(cursor, 'x', {
          duration: 0.28, ease: 'power2.out',
        });
        let bounds;

        listen(row, 'pointerenter', (event) => {
          if (event.pointerType === 'touch') return;
          hovered = index;
          syncInteraction();
          if (!moveCursor) return;
          bounds = row.getBoundingClientRect();
          const x = Math.max(2, Math.min(bounds.width - 5, event.clientX - bounds.left));
          moveCursor(x, x); // place it before fading in; no sweep from the edge
          row.classList.add('is-tracking');
        });

        listen(row, 'pointerleave', () => {
          if (hovered === index) hovered = -1;
          row.classList.remove('is-tracking');
          syncInteraction();
        });

        if (moveCursor) listen(row, 'pointermove', (event) => {
          if (event.pointerType === 'touch' || !bounds) return;
          moveCursor(Math.max(2, Math.min(bounds.width - 5, event.clientX - bounds.left)));
        });
      });
    }

    if (reduced) {
      // Every diagram is already complete in the HTML/CSS. No scroll triggers,
      // progressive strokes, entrance transforms or pointer tracking are made.
      activateService(Math.max(0, indexOf(document.activeElement)));
    } else if (fine) {
      const entrance = gsap.timeline({ paused: true })
        .fromTo(heading, { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' })
        .fromTo(rows, { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.35, stagger: 0.06, ease: 'power2.out' }, 0.08);
      entrances.push(entrance);
      ScrollTrigger.create({
        id: 'services-entrance', trigger: root, start: 'top 85%', once: true,
        onEnter: () => {
          entrance.play();
          if (active < 0) activateService(0);
        },
      });
    } else {
      // Three finite triggers for touch, with no pin, scrub or repeated work.
      rows.forEach((row, index) => {
        const entrance = gsap.timeline({ paused: true });
        if (index === 0) entrance.fromTo(heading, { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0);
        entrance.fromTo(row, { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0);
        entrances.push(entrance);
        ScrollTrigger.create({
          id: `services-touch-${index}`, trigger: row, start: 'top 78%', once: true,
          onEnter: () => {
            entrance.play();
            activateService(index);
          },
        });
      });
    }

    // A mode switch can happen while the keyboard is still inside a row.
    const focused = indexOf(document.activeElement);
    if (focused >= 0) {
      entrances.forEach((entrance) => entrance.progress(1));
      syncInteraction(focused);
    }

    return () => {
      listeners.forEach((remove) => remove());
      root.classList.remove('services--animated', 'services--engaged');
      rows.forEach((row) => row.classList.remove('is-active', 'is-tracking'));
    };
  });

  return () => {
    if (disposed) return;
    disposed = true;
    media.revert();
  };
}

function createScene(row, gsap, compact) {
  const live = row.querySelector('[data-service-live]');
  const elements = {
    paths: [...row.querySelectorAll('[data-service-path]')],
    nodes: [...row.querySelectorAll('[data-service-node]')],
    labels: [...row.querySelectorAll('[data-service-label]')],
  };
  const builders = {
    installation: animateInstallation,
    maintenance: animateMaintenance,
    custom: animateCustom,
  };
  const sequence = builders[row.dataset.service](gsap, row, elements);
  if (compact) sequence.timeScale(1.5);
  const visibility = gsap.fromTo(live, { opacity: 0 }, {
    opacity: 1, duration: 0.2, ease: 'power1.out', paused: true,
    onReverseComplete: () => sequence.pause(0),
  });
  return { sequence, visibility };
}

function drawPath(timeline, path, at, duration) {
  const length = path.getTotalLength();
  timeline.fromTo(path, { strokeDasharray: length, strokeDashoffset: length },
    { strokeDashoffset: 0, duration, ease: 'power1.inOut' }, at);
}

/** Feed, panel, branches and terminals: construct the distribution in order. */
function animateInstallation(gsap, row, { paths, nodes, labels }) {
  const timeline = gsap.timeline({ paused: true });
  timeline.fromTo(nodes[0], { opacity: 0 }, { opacity: 1, duration: 0.12 }, 0);
  drawPath(timeline, paths[0], 0.06, 0.24);
  timeline.fromTo(nodes[1], { opacity: 0 }, { opacity: 1, duration: 0.12 }, 0.24);
  paths.slice(1).forEach((path, index) => drawPath(timeline, path, 0.28 + index * 0.06, 0.24));
  timeline.fromTo(nodes.slice(2), { opacity: 0 },
    { opacity: 1, duration: 0.14, stagger: 0.06 }, 0.47);
  timeline.fromTo(labels, { opacity: 0, y: 2 },
    { opacity: 1, y: 0, duration: 0.16, stagger: 0.07, ease: 'power2.out' }, 0.12);
  return timeline;
}

/** Inspect at each stop; CHECK becomes OK only after the final visit. */
function animateMaintenance(gsap, row, { paths, nodes, labels }) {
  const scanner = row.querySelector('[data-service-scanner]');
  const pending = row.querySelector('[data-service-pending]');
  const checks = [...row.querySelectorAll('[data-service-check]')];
  const timeline = gsap.timeline({ paused: true });
  drawPath(timeline, paths[0], 0, 0.22);
  timeline.fromTo(nodes, { opacity: 0 }, { opacity: 1, duration: 0.14, stagger: 0.05 }, 0.06);
  timeline.fromTo(labels, { opacity: 0 }, { opacity: 1, duration: 0.14, stagger: 0.05 }, 0.1);
  timeline.fromTo(pending, { opacity: 0 }, { opacity: 1, duration: 0.14 }, 0.1);
  timeline.fromTo(scanner, { opacity: 0, x: 0 }, { opacity: 1, x: 36, duration: 0.22, ease: 'none' }, 0.16);
  timeline.fromTo(checks[0], { opacity: 0 }, { opacity: 1, duration: 0.12 }, 0.38);
  timeline.to(scanner, { x: 152, duration: 0.34, ease: 'power1.inOut' }, 0.46);
  timeline.fromTo(checks[1], { opacity: 0 }, { opacity: 1, duration: 0.12 }, 0.8);
  timeline.to(scanner, { x: 264, duration: 0.34, ease: 'power1.inOut' }, 0.88);
  timeline.to(pending, { opacity: 0, duration: 0.1 }, 1.2);
  timeline.fromTo(checks[2], { opacity: 0 }, { opacity: 1, duration: 0.12 }, 1.3);
  timeline.to(scanner, { opacity: 0, duration: 0.16 }, 1.34);
  return timeline;
}

/** Independent modules assemble, then connect into a single designed system. */
function animateCustom(gsap, row, { paths, nodes, labels }) {
  const timeline = gsap.timeline({ paused: true });
  timeline.fromTo(nodes.slice(0, 4), { opacity: 0, y: 4 },
    { opacity: 1, y: 0, duration: 0.18, stagger: 0.055, ease: 'power2.out' }, 0);
  paths.forEach((path, index) => drawPath(timeline, path, 0.2 + index * 0.075, 0.22));
  timeline.fromTo(nodes[4], { opacity: 0 }, { opacity: 1, duration: 0.16 }, 0.66);
  timeline.fromTo(labels.slice(0, 4), { opacity: 0 },
    { opacity: 1, duration: 0.15, stagger: 0.06 }, 0.14);
  timeline.fromTo(labels[4], { opacity: 0 }, { opacity: 1, duration: 0.16 }, 0.68);
  return timeline;
}
