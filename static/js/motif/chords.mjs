import { mulberry32, fmt, pick } from './utils.mjs';

/**
 * Times-table chords: i -> (multiplier * i + offset) mod count.
 * A zero offset is the classic modular multiplication circle. Integer rules
 * retain a finite vertex graph whose connected walks can be accented.
 * Reference: https://github.com/kathuman/multiplication-circle
 */
export function createChordDiagram(count, multiplier, offset = 0) {
  if (!Number.isInteger(count) || count < 3 || count > 96) throw new RangeError('Chord count must be between 3 and 96');
  if (!Number.isInteger(multiplier) || multiplier < 2 || multiplier >= count - 1) throw new RangeError('Chord multiplier must be between 2 and count - 2');
  if (!Number.isInteger(offset)) throw new RangeError('Chord offset must be an integer');
  offset = ((offset % count) + count) % count;
  const next = Array.from({ length: count }, (_, i) => (i * multiplier + offset) % count);
  const edges = [];
  const seen = new Set();
  for (let i = 0; i < count; i++) {
    const target = next[i];
    if (target === i) continue;
    const key = [i, target].sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push([i, target]);
  }
  return { count, multiplier, offset, next, edges };
}

function accentWalk(diagram, rng) {
  const walks = [];
  for (let start = 0; start < diagram.count; start++) {
    const vertices = [start];
    const visited = new Set([start]);
    const used = new Set();
    let current = start;
    // A short cycle or connected walk creates a legible accent even when the
    // full multiplication orbit runs through most of the circle's vertices.
    for (let step = 0; step < 8; step++) {
      const target = diagram.next[current];
      const key = [current, target].sort((a, b) => a - b).join(',');
      if (target === current || used.has(key)) break;
      used.add(key);
      vertices.push(target);
      if (visited.has(target)) break;
      visited.add(target);
      current = target;
    }
    if (vertices.length >= 4) walks.push(vertices);
  }
  const cycles = walks.filter(walk => walk[0] === walk.at(-1));
  const candidates = cycles.length ? cycles : walks;
  return candidates.length ? pick(rng, candidates) : null;
}

/**
 * Three related modular multiplication rules form the wide study. The mark
 * reproduces the complete central graph: point count, phase, offset, edges and
 * accented walk are resolved before applying any canvas dimensions.
 */
export function renderChords(seed, bounds = {}) {
  const width = bounds.width ?? 360;
  const height = bounds.height ?? 80;
  const form = bounds.form ?? (width <= 160 ? 'mark' : 'hero');
  const compact = form === 'mark';
  const rng = mulberry32(seed);
  const count = pick(rng, [30, 36, 40, 42, 48, 54, 60]);
  const offset = rng() < 0.65 ? 0 : Math.floor(rng() * count);
  // Some modular rules consist entirely of fixed points and two-cycles even
  // when the multiplier is neither 1 nor -1. Reject those shallow graphs before
  // selecting a rule, rather than falling back to an arbitrary isolated accent.
  const diagrams = [2, 3, 4, 5, 7, 9].map(multiplier => createChordDiagram(count, multiplier, offset))
    .filter(diagram => diagram.edges.length >= count * 0.65 && accentWalk(diagram, () => 0));
  const centralIndex = Math.floor(rng() * diagrams.length);
  const phase = rng() * Math.PI * 2;
  const central = diagrams[centralIndex];
  const walk = accentWalk(central, rng);
  const accented = new Set(walk.slice(1).map((vertex, i) => [walk[i], vertex].sort((a, b) => a - b).join(',')));
  const radius = Math.min(height * 0.4, width * (compact ? 0.4 : 0.13));
  const studies = compact ? [{ cx: width / 2, diagram: central, focal: true }] : [
    { cx: width * 0.18, diagram: diagrams[(centralIndex + diagrams.length - 1) % diagrams.length], focal: false },
    { cx: width / 2, diagram: central, focal: true },
    { cx: width * 0.82, diagram: diagrams[(centralIndex + 1) % diagrams.length], focal: false }
  ];
  const weight = 'stroke-width="1" vector-effect="non-scaling-stroke" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  return studies.map(({ cx, diagram, focal }) => {
    const point = vertex => {
      const theta = phase + vertex * Math.PI * 2 / count;
      return `${fmt(cx + radius * Math.cos(theta))},${fmt(height / 2 + radius * Math.sin(theta))}`;
    };
    const muted = diagram.edges.filter(([a, b]) => !focal || !accented.has([a, b].sort((a, b) => a - b).join(',')))
      .map(([a, b]) => `M${point(a)}L${point(b)}`).join(' ');
    const accent = focal ? `M${point(walk[0])}${walk.slice(1).map(vertex => `L${point(vertex)}`).join(' ')}` : '';
    const ring = `<circle cx="${fmt(cx)}" cy="${fmt(height / 2)}" r="${fmt(radius)}" stroke="var(--line)" ${weight}/>`;
    return ring + `<path d="${muted}" stroke="var(--muted)" ${weight}/>`
      + (accent ? `<path d="${accent}" stroke="var(--accent)" ${weight}/>` : '');
  }).join('');
}
