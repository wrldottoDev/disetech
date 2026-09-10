/** A single scroll timeline owns this scene; the shared depth effect is untouched. */
export function initInstallation(root = document.querySelector('[data-installation]')) {
  if (!root) return () => {};
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) return () => {};
  gsap.registerPlugin(ScrollTrigger);
  const stage = root.querySelector('.installation__stage');
  const img = root.querySelector('img');
  const svg = root.querySelector('.installation__drawing');
  const copy = root.querySelector('.depth__content');
  const first = root.querySelector('[data-installation-first]');
  const last = root.querySelector('[data-installation-last]');
  const media = gsap.matchMedia();
  const ns = 'http://www.w3.org/2000/svg';
  let disposed = false;
  function add(tag, attrs, parent = svg) {
    const el = document.createElementNS(ns, tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    parent.append(el);
    return el;
  }

  media.add({
    desktop: '(min-width: 1100px)',
    tablet: '(min-width: 600px) and (max-width: 1099px)',
    mobile: '(max-width: 599px)',
    reduced: '(prefers-reduced-motion: reduce)',
  }, ({ conditions: { desktop, mobile, reduced } }) => {
    let context;
    root.classList.toggle('installation--animated', !reduced);
    // Refresh geometry only on resize/font/image settlement, never on scroll.
    const build = () => {
      context?.revert();
      svg.replaceChildren();
      const { width: w, height: h } = stage.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const positions = mobile
        ? [[0.67, 0.39], [0.72, 0.56], [0.61, 0.76]]
        : [[0.82, 0.30], [0.75, 0.58], [0.55, 0.76]];
      const points = positions.map(([x, y]) => [x * w, y * h]);
      const paths = points.slice(1).map(([x, y], i) => {
        const [px, py] = points[i];
        const bend = mobile ? (py + y) / 2 : py + (y - py) * 0.7;
        return add('path', { d: `M${px} ${py} V${bend} H${x} V${y}`, class: 'installation__wire' });
      });
      const nodes = points.map(([x, y], i) => {
        const group = add('g', { class: 'installation__node' });
        if (!mobile) add('path', {
          d: `M${x - 13} ${y} h6 M${x + 7} ${y} h6 M${x} ${y - 13} v6 M${x} ${y + 7} v6`,
          class: 'installation__crosshair',
        }, group);
        add('circle', { cx: x, cy: y, r: mobile ? 3 : 4 }, group);
        add('text', {
          x: x - 17, y: y - 17, 'text-anchor': 'end', class: 'installation__label',
        }, group).textContent = ['01 COMPONENTE', '02 MONTAJE', '03 INSTALACIÓN'][i];
        if (desktop) add('text', {
          x: x - 17, y: y + 1, 'text-anchor': 'end', class: 'installation__note',
        }, group).textContent = ['PANEL / 120/240V', 'FEED / CTRL', 'INSTALL / SYSTEM'][i];
        return group;
      });
      const [x, y] = points[2];
      const pulse = add('circle', { cx: x, cy: y, r: 13, class: 'installation__pulse' });
      context = gsap.context(() => {
        if (reduced) return; // CSS is the complete, readable resting composition.
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            id: 'installation-scene', trigger: root, start: 'top top',
            end: 'bottom bottom', scrub: true, invalidateOnRefresh: true,
          },
        });
        tl.fromTo(img, { opacity: 0.64, scale: 1.045, y: mobile ? 4 : 12 },
          { opacity: 0.92, scale: 1.01, y: mobile ? -4 : -12, duration: 0.9 }, 0);
        tl.fromTo(svg, { y: mobile ? 2 : 6 }, { y: mobile ? -2 : -6, duration: 1 }, 0);
        tl.fromTo(copy, { y: 3 }, { y: -3, duration: 1 }, 0);
        tl.fromTo(first, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.18 }, 0.02);
        [0.2, 0.55, 0.8].forEach((at, i) => {
          tl.fromTo(nodes[i], { opacity: 0 }, { opacity: 1, duration: 0.1 }, at);
        });
        paths.forEach((path, i) => {
          const length = path.getTotalLength();
          tl.fromTo(path, { strokeDasharray: length, strokeDashoffset: length },
            { strokeDashoffset: 0, duration: i ? 0.15 : 0.2 }, i ? 0.65 : 0.35);
        });
        tl.fromTo(last, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.13 }, 0.75);
        tl.fromTo(pulse, { opacity: 0, scale: 0.65, svgOrigin: `${x} ${y}` },
          { opacity: 0.25, scale: 1, duration: 0.025 }, 0.875);
        tl.to(pulse, { opacity: 0, scale: 1.5, duration: 0.05 }, 0.9);
        // Hold the complete composition, then soften only this scene's layers.
        tl.to(svg, { opacity: 0.55, duration: 0.04 }, 0.96);
        tl.to(img, { opacity: 0.64, duration: 0.04 }, 0.96);
      }, root);
    };
    build();
    ScrollTrigger.addEventListener('refreshInit', build);
    return () => {
      ScrollTrigger.removeEventListener('refreshInit', build);
      context?.revert();
      svg.replaceChildren();
      root.classList.remove('installation--animated');
    };
  });
  const refresh = () => { if (!disposed) ScrollTrigger.refresh(); };
  const settled = () => {
    img.removeEventListener('load', settled);
    img.removeEventListener('error', settled);
    refresh();
  };
  if (!img.complete) {
    img.addEventListener('load', settled, { once: true });
    img.addEventListener('error', settled, { once: true });
  }
  document.fonts?.ready.then(refresh);
  return () => {
    if (disposed) return;
    disposed = true;
    img.removeEventListener('load', settled);
    img.removeEventListener('error', settled);
    media.revert();
  };
}
