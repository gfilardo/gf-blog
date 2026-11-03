import { mulberry32, fmt, pick } from './utils.mjs';

/**
 * Family B: Guilloché & Harmonograph Curves
 * Continuous coupled harmonic oscillators modeling astronomical dials & engraved rosettes.
 */
export function renderGuilloche(seed, bounds = {}) {
  const width = bounds.width ?? 360;
  const height = bounds.height ?? 80;
  const form = bounds.form ?? (width <= 160 ? 'mark' : 'hero');

  const rng = mulberry32(seed);

  // Guaranteed coprime frequency pairs to enforce rich geometric loops without cancellation
  const coprimePairs = [
    [2, 3], [3, 4], [3, 5], [4, 5], [5, 6], [3, 7], [5, 7], [5, 8], [7, 8], [7, 9], [7, 11]
  ];
  const [f1, f2] = pick(rng, coprimePairs);
  const [f3, f4] = pick(rng, coprimePairs);
  const p1 = rng() * Math.PI * 2;
  const p2 = rng() * Math.PI * 2;

  if (form === 'mark' || width === height) {
    // Single centered radial rosette
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.42;

    const steps = 180;
    let mainD = [];
    let accentD = [];

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const rMod = radius * (0.68 + 0.28 * Math.cos(f1 * t + p1));
      const x = cx + rMod * Math.cos(t);
      const y = cy + rMod * Math.sin(t);
      mainD.push(`${i === 0 ? 'M' : 'L'}${fmt(x)},${fmt(y)}`);
    }

    // Concentric resonant harmonic loop in --accent
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = cx + radius * 0.72 * Math.sin(f2 * t + p2);
      const y = cy + radius * 0.72 * Math.cos(f1 * t);
      accentD.push(`${i === 0 ? 'M' : 'L'}${fmt(x)},${fmt(y)}`);
    }

    // Outer astrolabe coordinate ring and axis hairlines
    const dialRing = `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(radius)}" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/>`;
    const innerRing = `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(radius * 0.35)}" stroke="var(--line)" stroke-dasharray="2 3" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/>`;
    const centerPoint = `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="1.5" fill="var(--accent)"/>`;

    return [
      dialRing,
      innerRing,
      `<path d="${mainD.join(' ')}Z" stroke="var(--muted)" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/>`,
      `<path d="${accentD.join(' ')}Z" stroke="var(--accent)" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/>`,
      centerPoint
    ].join('');
  }

  // Hero form: Horizontal harmonograph triptych with 3 phase-coupled dials
  const cy = height / 2;
  const radius = Math.min(height * 0.4, 32);
  const centers = [width * 0.18, width * 0.5, width * 0.82];

  const axisLine = `<line x1="${fmt(width * 0.06)}" y1="${fmt(cy)}" x2="${fmt(width * 0.94)}" y2="${fmt(cy)}" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"/>`;

  const dials = centers.map((cx, idx) => {
    const isFocal = idx === 1; // Center dial is the primary focal accent
    const steps = 140;
    let d = [];
    const freqX = isFocal ? f1 : (idx === 0 ? f2 : f3);
    const freqY = isFocal ? f2 : (idx === 0 ? f3 : f4);
    const phase = idx * 1.25 + p1;

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = cx + radius * 0.85 * Math.sin(freqX * t + phase);
      const y = cy + radius * 0.85 * Math.cos(freqY * t);
      d.push(`${i === 0 ? 'M' : 'L'}${fmt(x)},${fmt(y)}`);
    }

    const ring = `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(radius)}" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/>`;
    const centerDot = `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="1.5" fill="${isFocal ? 'var(--accent)' : 'var(--muted)'}"/>`;
    const path = `<path d="${d.join(' ')}Z" stroke="${isFocal ? 'var(--accent)' : 'var(--muted)'}" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/>`;

    return `${ring}${path}${centerDot}`;
  }).join('');

  return `${axisLine}${dials}`;
}

