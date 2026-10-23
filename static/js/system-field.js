import { createFlock, stepFlock, visitorAt, WIDTH, HEIGHT } from './flock.mjs';

const field = document.querySelector('.system-field');
const canvas = field?.querySelector('canvas');
const ctx = canvas?.getContext('2d');
if (ctx) {
  const button = field.querySelector('button');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dark = matchMedia('(prefers-color-scheme: dark)');
  let birds = createFlock(), time = 0, previous = 0, frame = 0;
  let paused = reduced.matches, visible = true, pointer = null;
  let tap = null, visitor = null;
  let visitorTrail = [];
  let trails = birds.map(() => []);
  let palette;
  function colors() {
    palette = dark.matches ? ['#a8929e', '#f43f5e', '#fb7185'] : ['#4d3935', '#98122d', '#b91c32'];
  }
  function paint() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    birds.forEach((bird, i) => {
      const trail = trails[i];
      ctx.strokeStyle = palette[bird.color];
      ctx.lineWidth = .7;
      for (let j = 1; j < trail.length; j++) {
        ctx.globalAlpha = .075 * j / trail.length;
        ctx.beginPath(); ctx.moveTo(trail[j - 1].x, trail[j - 1].y); ctx.lineTo(trail[j].x, trail[j].y); ctx.stroke();
      }
      ctx.save(); ctx.translate(bird.x, bird.y); ctx.rotate(Math.atan2(bird.vy, bird.vx));
      ctx.scale(bird.size, bird.size); ctx.fillStyle = palette[bird.color];
      ctx.globalAlpha = bird.color === 1 ? .9 : .55 + bird.sociability * .2;
      ctx.beginPath(); ctx.moveTo(1.2, 0); ctx.lineTo(-1.8, -1.1); ctx.lineTo(-.8, 0); ctx.lineTo(-1.8, 1.1); ctx.closePath(); ctx.fill(); ctx.restore();
    });
    if (visitor) {
      ctx.strokeStyle = palette[1]; ctx.lineWidth = 1;
      for (let j = 1; j < visitorTrail.length; j++) {
        ctx.globalAlpha = .25 * j / visitorTrail.length;
        ctx.beginPath(); ctx.moveTo(visitorTrail[j - 1].x, visitorTrail[j - 1].y);
        ctx.lineTo(visitorTrail[j].x, visitorTrail[j].y); ctx.stroke();
      }
      // The visitor is a larger open shape, distinct from the solid flock.
      ctx.save(); ctx.translate(visitor.x, visitor.y); ctx.rotate(visitor.angle);
      ctx.globalAlpha = .9; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -5); ctx.lineTo(-3, 0);
      ctx.lineTo(-6, 5); ctx.closePath(); ctx.stroke(); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(WIDTH * ratio); canvas.height = Math.round(HEIGHT * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); paint();
  }
  function animate(now) {
    frame = 0;
    if (paused || !visible || document.hidden) { previous = 0; return; }
    const dt = previous ? Math.min((now - previous) / (1000 / 60), 2) : 1;
    previous = now; time += dt / 60;
    visitor = visitorAt(time);
    if (visitor) {
      visitorTrail.push({ x: visitor.x, y: visitor.y });
      if (visitorTrail.length > 32) visitorTrail.shift();
    } else visitorTrail = [];
    if (tap && now >= tap.expires) tap = null;
    // Substeps preserve steering at the faster pace, including on slower screens.
    const elapsed = dt * 1.1;
    const steps = Math.ceil(elapsed);
    for (let i = 0; i < steps; i++) birds = stepFlock(birds, elapsed / steps, time, tap || pointer, visitor);
    birds.forEach((bird, i) => { trails[i].push({ x: bird.x, y: bird.y }); if (trails[i].length > 12) trails[i].shift(); });
    paint(); frame = requestAnimationFrame(animate);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    tap = null; pointer = null;
    button.textContent = paused ? 'Play flock' : 'Pause flock';
    button.setAttribute('aria-label', paused ? 'Play flock animation' : 'Pause flock animation');
    if (!paused && visible && !document.hidden) frame = requestAnimationFrame(animate);
  }
  colors(); resize();
  field.classList.add('flock-ready'); button.hidden = false;
  button.addEventListener('click', () => { paused = !paused; sync(); });
  reduced.addEventListener('change', () => { paused = reduced.matches; sync(); });
  dark.addEventListener('change', () => { colors(); paint(); });
  document.addEventListener('visibilitychange', sync);
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
  observer.observe(field);
  window.addEventListener('resize', resize, { passive: true });
  function position(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * WIDTH, y: (event.clientY - rect.top) / rect.height * HEIGHT };
  }
  canvas.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    pointer = position(event);
  }, { passive: true });
  canvas.addEventListener('pointerdown', event => {
    if (paused || event.pointerType !== 'touch') return;
    tap = { ...position(event), expires: performance.now() + 900 };
  }, { passive: true });
  // Touch release/leave must not erase the pulse before the flock can respond.
  canvas.addEventListener('pointerleave', () => { pointer = null; });
  canvas.addEventListener('pointercancel', () => { tap = null; pointer = null; });
  sync();
}
