/** Measured only on refresh: no scroll listeners or per-frame layout reads. */
export function initCircuit() {
  const intro = document.querySelector('#nosotros');
  const materials = document.querySelector('#materiales');
  const { gsap, ScrollTrigger } = window;
  if (!intro || !materials || !gsap || !ScrollTrigger) return () => {};
  gsap.registerPlugin(ScrollTrigger);
  const ns = 'http://www.w3.org/2000/svg';
  const words = [...intro.querySelectorAll('.intro__title .line-mask > *')];
  const rows = [...materials.querySelectorAll('[data-material]')];
  const svgs = [intro, materials].map(section => {
    const svg = document.createElementNS(ns, 'svg');
    svg.classList.add('circuit');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    section.prepend(svg);
    section.classList.add('has-circuit');
    return svg;
  });
  function element(parent, tag, attrs) {
    const el = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    parent.append(el);
    return el;
  }
  const path = (svg, d) => element(svg, 'path', { d, class: 'circuit__line' });
  const node = (svg, x, y, main = false) => element(svg, 'circle', {
    cx: x, cy: y, r: main ? 5 : 3, class: 'circuit__node',
  });
  const label = (svg, x, y, text) => {
    element(svg, 'text', { x, y, class: 'circuit__label' }).textContent = text;
  };
  let context;
  let disposed = false;
  const media = gsap.matchMedia();

  function build(reduced) {
    context?.revert();
    svgs.forEach(svg => svg.replaceChildren());
    const a = intro.getBoundingClientRect();
    const b = materials.getBoundingClientRect();
    const title = intro.querySelector('.intro__title').getBoundingClientRect();
    const list = materials.querySelector('[data-materials]').getBoundingClientRect();
    // Line masks do not move when their words are emphasized.
    const ys = words.map(word => {
      const box = word.parentElement.getBoundingClientRect();
      return box.top - a.top + box.height / 2;
    });
    const rail = title.left - a.left - 12;
    const join = title.bottom - a.top + 22;
    const listRail = list.left - b.left - 12;
    const listTop = list.top - b.top - 24;
    const mobile = a.width < 600;
    const desktop = a.width >= 1100;
    svgs.forEach((svg, i) => {
      const box = i ? b : a;
      svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    });
    const stages = [
      [path(svgs[0], `M${rail} ${ys[0] - 48} V${ys[0]}`)],
      [path(svgs[0], `M${rail} ${ys[0]} V${ys[1]}`)],
      [path(svgs[0], `M${rail} ${ys[1]} V${join}`)],
    ];
    const nodes = ys.map((y, i) => node(svgs[0], rail, i === 2 ? join : y, i === 2));
    if (mobile || a.width < 900) {
      stages[2].push(path(svgs[0], `M${rail + (mobile ? 72 : 140)} ${join - 12} V${join} H${rail}`));
    } else {
      const right = title.right - a.left - 8;
      const branch = right - (desktop ? 150 : 72);
      stages[0].push(path(svgs[0], `M${branch} ${ys[0] - 32} H${right} V${ys[0]}`));
      stages[1].push(path(svgs[0], `M${right} ${ys[0]} V${ys[1]} H${branch} V${join}`));
      stages[2].push(path(svgs[0], `M${branch} ${join} H${rail}`));
      if (desktop) stages[2].push(path(svgs[0], `M${right} ${ys[1]} V${join} H${branch}`));
      node(svgs[0], right, ys[0]);
      label(svgs[0], branch, ys[0] - 44, 'CIRCUIT 01');
      label(svgs[0], branch + 10, ys[1] + 20, 'CTRL / SERVICE');
      if (desktop) label(svgs[0], branch + 10, join - 12, '120/240V');
    }
    const halo = element(svgs[0], 'circle', {
      cx: rail, cy: join, r: 12, class: 'circuit__pulse',
    });
    const exit = path(svgs[0], `M${rail} ${join} V${a.height}`);
    const entry = path(svgs[1], `M${rail} 0 V${listTop} H${listRail}`);
    // Layout offsets exclude the existing reveal/hover transforms on each row.
    const terminals = rows.map(row => {
      const index = row.querySelector('.material__index');
      let y = index.offsetHeight / 2;
      for (let el = index; el && el !== materials; el = el.offsetParent) y += el.offsetTop;
      return y;
    });
    const feeds = rows.map((row, i) => {
      const y = terminals[i];
      const from = i ? terminals[i - 1] : listTop;
      const group = element(svgs[1], 'g', { 'data-circuit-category': row.dataset.index });
      const wire = path(group, `M${listRail} ${from} V${y} H${listRail + 6}`);
      const terminal = node(group, listRail, y);
      return { wire, terminal, row };
    });
    context = gsap.context(() => {
      if (reduced) return;
      const draw = (tl, lines, at, duration) => {
        lines.forEach(line => {
          const length = line.getTotalLength();
          gsap.set(line, { strokeDasharray: length, strokeDashoffset: length });
          tl.to(line, { strokeDashoffset: 0, duration, ease: 'none' }, at);
        });
      };
      const start = a.top + window.scrollY - window.innerHeight * 0.75;
      const end = list.top + window.scrollY - window.innerHeight * 0.72;
      const span = Math.max(1, end - start);
      const times = ys.map(y => Math.min(0.7, Math.max(0.08,
        (a.top + window.scrollY + y - window.innerHeight * 0.55 - start) / span)));
      const tl = gsap.timeline({ scrollTrigger: {
        id: 'solutions-circuit', trigger: intro, start: 'top 75%',
        endTrigger: materials.querySelector('[data-materials]'), end: 'top 72%', scrub: true,
      } });
      stages.forEach((lines, i) => {
        const begin = i ? times[i - 1] : 0;
        draw(tl, lines, begin, times[i] - begin);
        tl.fromTo(nodes[i], { opacity: 0.2 }, { opacity: 1, duration: 0.025 }, times[i]);
        tl.fromTo(words[i], { opacity: 0.45, y: 6 },
          { opacity: 1, y: 0, duration: 0.045, ease: 'power1.out' }, times[i]);
      });
      tl.fromTo(halo, { opacity: 0, scale: 0.6, svgOrigin: `${rail} ${join}` },
        { opacity: 0.35, scale: 1, duration: 0.035 }, times[2]);
      tl.to(halo, { opacity: 0, scale: 1.6, duration: 0.07 }, times[2] + 0.035);
      const onward = times[2] + 0.045;
      const split = onward + (1 - onward) * (a.height - join) / (a.height - join + listTop + Math.abs(listRail - rail));
      draw(tl, [exit], onward, split - onward);
      draw(tl, [entry], split, 1 - split);
      feeds.forEach(({ wire, terminal, row }, i) => {
        const feed = gsap.timeline({ scrollTrigger: {
          id: `materials-circuit-${i}`, trigger: row, start: 'top 78%', end: 'center 65%', scrub: true,
        } });
        draw(feed, [wire], 0, 1);
        feed.fromTo(terminal, { opacity: 0.2 }, { opacity: 1, duration: 0.15 }, 0.85);
      });
    });
  }
  media.add({ reduced: '(prefers-reduced-motion: reduce)', all: '(min-width: 0px)' }, ({ conditions }) => {
    const refresh = () => build(conditions.reduced);
    refresh();
    ScrollTrigger.addEventListener('refreshInit', refresh);
    return () => {
      ScrollTrigger.removeEventListener('refreshInit', refresh);
      context?.revert();
    };
  });
  // Refresh after late font metrics settle; GSAP handles viewport resizing.
  document.fonts?.ready.then(() => { if (!disposed) ScrollTrigger.refresh(); });
  return () => {
    disposed = true;
    media.revert();
    svgs.forEach(svg => svg.remove());
    intro.classList.remove('has-circuit');
    materials.classList.remove('has-circuit');
  };
}
