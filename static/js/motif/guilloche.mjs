import { mulberry32, fmt, pick } from './utils.mjs';

/**
 * Engraved Lissajous dials: x = a sin(fx t + phase), y = a cos(fy t).
 * The compact mark reproduces the hero's central dial, including its phase.
 * These undamped, single-oscillator-per-axis curves are related to harmonographs:
 * https://paulbourke.net/geometry/harmonograph/index.html
 */
export function renderGuilloche(seed, bounds = {}) {
  const width = bounds.width ?? 360;
  const height = bounds.height ?? 80;
  const form = bounds.form ?? (width <= 160 ? 'mark' : 'hero');
  const compact = form === 'mark';
  const rng = mulberry32(seed);
  const coprimePairs = [
    [2, 3], [3, 4], [3, 5], [4, 5], [5, 6], [3, 7], [5, 7], [5, 8], [7, 8], [7, 9], [7, 11]
  ];
  const [f1, f2] = pick(rng, coprimePairs);
  const [f3, f4] = pick(rng, coprimePairs);
  const phase = rng() * Math.PI * 2;
  function gcd(a, b) {
    while (b) [a, b] = [b, a % b];
    return a;
  }
  // Combining two valid pairs does not guarantee a valid third pair. Preserve
  // the original left dial where possible; otherwise use the known-good pair.
  const leftPair = gcd(f2, f3) === 1 ? [f2, f3] : [f1, f2];
  const dials = [
    { frequencies: leftPair, phase, center: width * 0.18, focal: false },
    { frequencies: [f1, f2], phase: phase + 1.25, center: width / 2, focal: true },
    { frequencies: [f3, f4], phase: phase + 2.5, center: width * 0.82, focal: false }
  ];
  const radius = compact ? Math.min(width, height) * 0.42 : Math.min(height * 0.4, width * 0.13, 32);
  const cy = height / 2;
  const amplitude = 0.85;

  function curve({ frequencies: [fx, fy], phase, center }) {
    // Cubic Hermite interpolation uses the analytic position and tangent at
    // each endpoint. Its error is bounded by max|p''''| h^4 / 384. Increase the
    // segment count with frequency and radius, targeting <0.03 coordinate units
    // before two-decimal SVG rounding. A canonical radius floor keeps identical
    // control-point layouts across the standard hero and compact canvases.
    const fourthDerivative = amplitude * Math.hypot(fx ** 4, fy ** 4);
    const steps = Math.max(4 * Math.max(fx, fy),
      Math.ceil(2 * Math.PI * (fourthDerivative * Math.max(64, radius) / (384 * 0.03)) ** 0.25));
    const h = 2 * Math.PI / steps;
    const sample = t => ({
      x: amplitude * Math.sin(fx * t + phase),
      y: amplitude * Math.cos(fy * t),
      dx: amplitude * fx * Math.cos(fx * t + phase),
      dy: -amplitude * fy * Math.sin(fy * t)
    });
    const point = (x, y) => `${fmt(center + radius * x)},${fmt(cy + radius * y)}`;
    let previous = sample(0);
    const commands = [`M${point(previous.x, previous.y)}`];
    for (let i = 1; i <= steps; i++) {
      const next = sample(i * h);
      commands.push(`C${point(previous.x + previous.dx * h / 3, previous.y + previous.dy * h / 3)} ${point(next.x - next.dx * h / 3, next.y - next.dy * h / 3)} ${point(next.x, next.y)}`);
      previous = next;
    }
    return `${commands.join(' ')}Z`;
  }

  const weight = 'stroke-width="1" vector-effect="non-scaling-stroke" fill="none"';
  const axis = compact ? '' : `<line x1="${fmt(width * 0.06)}" y1="${fmt(cy)}" x2="${fmt(width * 0.94)}" y2="${fmt(cy)}" stroke="var(--line)" ${weight}/>`;
  return axis + (compact ? [dials[1]] : dials).map(dial => {
    const stroke = dial.focal ? 'var(--accent)' : 'var(--muted)';
    const ring = `<circle cx="${fmt(dial.center)}" cy="${fmt(cy)}" r="${fmt(radius)}" stroke="var(--line)" ${weight}/>`;
    const path = `<path d="${curve(dial)}" stroke="${stroke}" ${weight}/>`;
    const dot = `<circle cx="${fmt(dial.center)}" cy="${fmt(cy)}" r="${fmt(radius * 0.046875)}" fill="${stroke}"/>`;
    return `${ring}${path}${dot}`;
  }).join('');
}
