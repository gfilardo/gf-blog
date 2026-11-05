// A small perspective scene: scrolling moves the camera, never the document.
// No textures, dependencies, or continuous animation when the reader is still.
const canvas = document.querySelector('.arcade-canvas');
const ctx = canvas?.getContext('2d');

if (ctx) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const BAY = 4.8;
  const FAR = 115;
  let width = 0, height = 0, frame = 0;
  let position = window.scrollY * .004;
  let target = position;
  let palette;

  function colors() {
    palette = dark.matches
      ? { stone: '#4c4548', shade: '#181419', recess: '#09070a', edge: '#645a5e', light: '#82736c', floor: '#242023' }
      : { stone: '#cfc6ba', shade: '#746c65', recess: '#615b56', edge: '#eee7dd', light: '#fffaf0', floor: '#e5ddd1' };
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const focal = Math.max(width * .72, height * .8);
    const horizon = height * .43;
    const vanishing = width * .42;
    // A gentle bend brings the far colonnade back into view.
    function project(x, y, z) {
      const depth = Math.max(.18, z - position);
      return [vanishing + (x + Math.min(depth * depth * .0008, 5)) * focal / depth,
        horizon + (2.3 - y) * focal / depth];
    }
    function path(points, close = true) {
      points.forEach(([x, y, z], i) => {
        const point = project(x, y, z);
        if (i === 0) ctx.moveTo(...point); else ctx.lineTo(...point);
      });
      if (close) ctx.closePath();
    }
    function polygon(points, fill) {
      ctx.beginPath(); path(points); ctx.fillStyle = fill; ctx.fill();
    }
    polygon([[-6, 0, position + .18], [6, 0, position + .18], [6, 0, position + FAR], [-6, 0, position + FAR]], palette.floor);

    const first = Math.floor(position / BAY);
    const last = first + Math.ceil(FAR / BAY);
    // Ground shadows cross the walkway diagonally, anchored to each pier.
    for (let i = last; i >= first; i--) {
      const z = i * BAY;
      if (z < position + .2) continue;
      polygon([[6, .005, z], [-6, .005, z + 7.5], [-6, .005, z + 8.6], [6, .005, z + 1.1]], palette.shade);
    }

    function arch(x, y, z) {
      const start = z + .65, end = z + BAY - .65;
      const spring = y + 3.1, radius = (end - start) / 2;
      const points = [[x, y, start], [x, spring, start]];
      for (let j = 1; j <= 24; j++) {
        const angle = Math.PI - j / 24 * Math.PI;
        points.push([x, spring + Math.sin(angle) * 1.65, (start + end) / 2 + Math.cos(angle) * radius]);
      }
      points.push([x, y, end]);
      return points;
    }

    // Each wall has three tiers; draw the opening and its recessed inner edge.
    for (let i = last; i >= first - 1; i--) {
      const z = i * BAY;
      if (z + BAY <= position + .25) continue;
      const near = Math.max(z, position + .25);
      for (const side of [-1, 1]) {
        const x = side * 6;
        const fade = Math.min(1, (position + FAR - z) / 35);
        ctx.globalAlpha = Math.max(0, fade);
        polygon([[x, 0, near], [x, 16.4, near], [x, 16.4, z + BAY], [x, 0, z + BAY]], side === 1 ? palette.stone : palette.shade);
        for (let tier = 0; tier < 3; tier++) {
          const y = tier * 5.35;
          // Skip openings intersecting the camera's near plane.
          if (z + .65 <= position + .25) continue;
          polygon(arch(x - side * .015, y, z), palette.recess);
          ctx.save();
          ctx.beginPath(); path(arch(x - side * .02, y, z)); ctx.clip();
          polygon(arch(x + side * .45, y + .05, z + .22), side === 1 ? palette.shade : palette.recess);
          ctx.restore();
          // Thin horizontal cornices catch the light between tiers.
          if (tier > 0) polygon([[x, y - .1, near], [x, y, near], [x, y, z + BAY], [x, y - .1, z + BAY]], side === 1 ? palette.edge : palette.stone);
        }
        // The illuminated front edge gives each column a little thickness.
        if (z > position + .25) polygon([[x, 0, z], [x, 16.4, z], [x - side * .11, 16.4, z], [x - side * .11, 0, z]], side === 1 ? palette.light : palette.stone);
      }
    }
    ctx.globalAlpha = 1;
  }

  function tick() {
    frame = 0;
    if (document.hidden) return;
    const delta = target - position;
    position = reduced.matches || Math.abs(delta) < .002 ? target : position + delta * .16;
    draw();
    if (!reduced.matches && Math.abs(target - position) >= .002) frame = requestAnimationFrame(tick);
  }
  function requestDraw() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function resize() {
    width = window.innerWidth; height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    requestDraw();
  }
  function scroll() {
    target = reduced.matches ? 0 : window.scrollY * .004;
    requestDraw();
  }
  colors();
  if (reduced.matches) position = target = 0;
  resize();
  window.addEventListener('scroll', scroll, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  dark.addEventListener('change', () => { colors(); requestDraw(); });
  reduced.addEventListener('change', () => { position = target = reduced.matches ? 0 : window.scrollY * .004; requestDraw(); });
  document.addEventListener('visibilitychange', requestDraw);
}
