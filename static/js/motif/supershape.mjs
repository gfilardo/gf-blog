import { mulberry32, fmt, pick } from './utils.mjs';

/**
 * Layered studies of Gielis' polar superformula. Seeded parameter families
 * explore stars, rounded lobes, and alternating petals instead of repeatedly
 * drawing a nearly circular silhouette. Layers morph and turn inward; the
 * compact mark reproduces the complete central study from the hero.
 * Reference: Johan Gielis, 2003, "A generic geometric transformation that
 * unifies a wide range of natural and abstract shapes".
 * https://doi.org/10.3732/ajb.90.3.333
 */
export function renderSupershape(seed, bounds = {}) {
  const width = bounds.width ?? 360;
  const height = bounds.height ?? 80;
  const form = bounds.form ?? (width <= 160 ? 'mark' : 'hero');
  const compact = form === 'mark';
  const rng = mulberry32(seed);
  const family = Math.floor(rng() * 3);
  const m = pick(rng, family === 2 ? [4, 6, 8, 10] : [3, 4, 5, 6, 7, 8, 9]);
  const n1 = family === 0 ? 0.65 + rng() * 0.55 : 0.9 + rng() * 0.9;
  const n2 = family === 1 ? 3 + rng() * 4 : 0.55 + rng() * 0.8;
  const n3 = family === 2 ? 3 + rng() * 4 : n2;
  const phase = rng() * Math.PI * 2;
  const twist = (rng() < 0.5 ? -1 : 1) * (0.3 + rng() * 0.8);
  const radius = Math.min(height * 0.4, width * (compact ? 0.4 : 0.13));
  const steps = Math.max(120, m * 24);
  // Odd symmetry is closed over 2π when n2=n3 (the sine/cosine terms swap).
  // Alternating exponents therefore use even symmetry orders exclusively.
  const studies = compact ? [{ cx: width / 2, stage: 1, focal: true }] : [
    { cx: width * 0.18, stage: 0, focal: false },
    { cx: width / 2, stage: 1, focal: true },
    { cx: width * 0.82, stage: 2, focal: false }
  ];
  const weight = 'stroke-width="1" vector-effect="non-scaling-stroke" fill="none" stroke-linejoin="round"';
  let guides = '';
  const figures = studies.map(({ cx, stage, focal }) => {
    const count = focal ? 5 : 3;
    const paths = [];
    for (let layer = 0; layer < count; layer++) {
      const depth = layer / (count - 1);
      // The side studies show different exponent settings of the same seeded
      // symmetry. The central set is identical for hero, compact and list marks.
      const exponent = n1 * (0.7 + stage * 0.3 + depth * 0.35);
      const turn = phase + twist * depth * (0.5 + stage * 0.5);
      const points = [];
      for (let i = 0; i <= steps; i++) {
        const theta = i / steps * Math.PI * 2;
        const sum = Math.abs(Math.cos(m * theta / 4)) ** n2
          + Math.abs(Math.sin(m * theta / 4)) ** n3;
        const r = sum ** (-1 / exponent);
        points.push([r, theta + turn]);
      }
      // Normalize each layer independently before shrinking it, preserving
      // the intended hierarchy even for parameter sets with long petal tips.
      const maxRadius = Math.max(...points.map(([r]) => r));
      const scale = radius * (1 - depth * 0.72) / maxRadius;
      const d = points.map(([r, theta], i) => `${i ? 'L' : 'M'}${fmt(cx + r * scale * Math.cos(theta))},${fmt(height / 2 + r * scale * Math.sin(theta))}`).join(' ');
      const stroke = focal && layer === 1 ? 'accent' : layer === count - 1 ? 'line' : 'muted';
      paths.push(`<path d="${d}Z" stroke="var(--${stroke})" ${weight}/>`);
    }
    // Small axis ticks frame the studies without putting every shape in a ring.
    const tick = radius * 0.08;
    guides += `M${fmt(cx - radius - tick)},${fmt(height / 2)}h${fmt(tick)} M${fmt(cx + radius)},${fmt(height / 2)}h${fmt(tick)}`;
    return paths.join('');
  }).join('');
  return `<path d="${guides}" stroke="var(--line)" ${weight}/>${figures}`;
}
