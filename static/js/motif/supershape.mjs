import { mulberry32, fmt, pick } from './utils.mjs';

// Gielis' polar superformula; positive exponents avoid singular radii.
// Reference: https://doi.org/10.3732/ajb.90.3.333
export function renderSupershape(seed, bounds = {}) {
  const width = bounds.width ?? 360;
  const height = bounds.height ?? 80;
  const form = bounds.form ?? (width <= 160 ? 'mark' : 'hero');
  const rng = mulberry32(seed);
  const m = pick(rng, [4, 6, 8, 10, 12]);
  const n1 = 0.8 + rng() * 2;
  const n2 = 1 + rng() * 5;
  const n3 = 1 + rng() * 5;
  const phase = rng() * Math.PI * 2;
  const points = Array.from({ length: 241 }, (_, i) => {
    const t = i / 240 * Math.PI * 2;
    const r = (Math.abs(Math.cos(m * t / 4)) ** n2
      + Math.abs(Math.sin(m * t / 4)) ** n3) ** (-1 / n1);
    return [r * Math.cos(t + phase), r * Math.sin(t + phase)];
  });
  const maxRadius = Math.max(...points.map(([x, y]) => Math.hypot(x, y)));
  const radius = Math.min(height * 0.4, width * (form === 'mark' ? 0.4 : 0.13));
  const centers = form === 'mark' ? [width / 2] : [width * 0.18, width / 2, width * 0.82];
  const weight = 'stroke-width="1" vector-effect="non-scaling-stroke" fill="none"';
  return centers.map((cx, index) => {
    const focal = index === Math.floor(centers.length / 2);
    const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${fmt(cx + x / maxRadius * radius)},${fmt(height / 2 + y / maxRadius * radius)}`).join(' ');
    return `<circle cx="${fmt(cx)}" cy="${fmt(height / 2)}" r="${fmt(radius)}" stroke="var(--line)" ${weight}/>`
      + `<path d="${d}Z" stroke="var(--${focal ? 'accent' : 'muted'})" ${weight}/>`;
  }).join('');
}
