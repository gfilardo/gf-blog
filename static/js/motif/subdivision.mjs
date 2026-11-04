import { fnv1a, mulberry32, fmt, pick } from './utils.mjs';

/**
 * Build a canonical architectural plan before considering output dimensions.
 * Its central square is the compact mark; two wings extend it into the hero.
 * Each partition owns a PRNG keyed by its ancestry, so decisions remain stable
 * when a region is rendered alone or at a different scale.
 */
export function createSubdivision(seed) {
  const rng = mulberry32(seed);
  const bias = pick(rng, [0.25, 0.5, 0.75]);
  const depth = rng() < 0.5 ? 3 : 4;
  const minimum = 1 / 6;
  const leaves = [];
  const dividers = [
    { x1: -0.5, y1: -0.5, x2: -0.5, y2: 0.5, depth: 0 },
    { x1: 0.5, y1: -0.5, x2: 0.5, y2: 0.5, depth: 0 }
  ];
  function partition(rect, id, level, limit) {
    const random = mulberry32(fnv1a(`${seed >>> 0}:${id}`));
    const vertical = rect.w >= 2 * minimum - 1e-9;
    const horizontal = rect.h >= 2 * minimum - 1e-9;
    // Large rooms are deliberate areas of negative space. Stop different
    // branches at different depths rather than subdividing all leaves equally.
    if (level >= limit || (!vertical && !horizontal) || (level >= 2 && random() < 0.32)) {
      leaves.push({ ...rect, id, depth: level });
      return;
    }
    const splitX = vertical && (!horizontal || rect.w / rect.h > 1.8 || (rect.h / rect.w <= 1.8 && random() < bias));
    const span = splitX ? rect.w : rect.h;
    const origin = splitX ? rect.x : rect.y;
    const ratio = pick(random, [1 / 3, 0.382, 0.5, 0.618, 2 / 3]);
    // Quantize to a shared drafting grid, then clamp to a minimum room size.
    const cut = Math.max(origin + minimum, Math.min(origin + span - minimum, Math.round((origin + span * ratio) * 24) / 24));
    if (splitX) {
      dividers.push({ x1: cut, y1: rect.y, x2: cut, y2: rect.y + rect.h, depth: level });
      partition({ x: rect.x, y: rect.y, w: cut - rect.x, h: rect.h }, `${id}.0`, level + 1, limit);
      partition({ x: cut, y: rect.y, w: rect.x + rect.w - cut, h: rect.h }, `${id}.1`, level + 1, limit);
    } else {
      dividers.push({ x1: rect.x, y1: cut, x2: rect.x + rect.w, y2: cut, depth: level });
      partition({ x: rect.x, y: rect.y, w: rect.w, h: cut - rect.y }, `${id}.0`, level + 1, limit);
      partition({ x: rect.x, y: cut, w: rect.w, h: rect.y + rect.h - cut }, `${id}.1`, level + 1, limit);
    }
  }
  partition({ x: -0.5, y: -0.5, w: 1, h: 1 }, 'center', 0, depth);
  partition({ x: -2.25, y: -0.5, w: 1.75, h: 1 }, 'west', 0, depth - 1);
  partition({ x: 0.5, y: -0.5, w: 1.75, h: 1 }, 'east', 0, depth - 1);
  const central = leaves.filter(leaf => leaf.id.startsWith('center'));
  const largestArea = Math.max(...central.map(leaf => leaf.w * leaf.h));
  const focal = pick(rng, central.filter(leaf => leaf.w * leaf.h >= largestArea * 0.65));
  return { leaves, dividers, focal };
}

/**
 * Guillotine subdivision with varied room hierarchy, broad quiet cells and a
 * single highlighted room. Hero and mark share the exact same partition tree.
 * The highlighted room's fill and complete boundary define one focal feature;
 * no unrelated divider or floating node is chosen independently.
 */
export function renderSubdivision(seed, bounds = {}) {
  const width = bounds.width ?? 360;
  const height = bounds.height ?? 80;
  const form = bounds.form ?? (width <= 160 ? 'mark' : 'hero');
  const compact = form === 'mark';
  const { dividers, focal } = createSubdivision(seed);
  const limit = compact ? 0.5 : 2.25;
  const scale = compact ? Math.min(width, height) * 0.84 : Math.min(height * 0.8, width * 0.92 / 4.5);
  const x = value => fmt(width / 2 + value * scale);
  const y = value => fmt(height / 2 + value * scale);
  const segments = [
    ...dividers,
    { x1: -limit, y1: -0.5, x2: limit, y2: -0.5, depth: 0 },
    { x1: -limit, y1: 0.5, x2: limit, y2: 0.5, depth: 0 },
    { x1: -limit, y1: -0.5, x2: -limit, y2: 0.5, depth: 0 },
    { x1: limit, y1: -0.5, x2: limit, y2: 0.5, depth: 0 }
  ];
  const seen = new Set();
  const paths = { line: [], muted: [] };
  for (const segment of segments) {
    const vertical = segment.x1 === segment.x2;
    if (vertical && Math.abs(segment.x1) > limit + 1e-9) continue;
    const fixed = vertical ? segment.x1 : segment.y1;
    const start = vertical ? segment.y1 : Math.max(-limit, segment.x1);
    const end = vertical ? segment.y2 : Math.min(limit, segment.x2);
    if (end - start < 1e-9) continue;
    const key = [vertical, fixed, start, end].join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    let intervals = [[start, end]];
    // Remove shared focal boundaries from ordinary rules so accent edges are
    // drawn exactly once, even when they occupy part of a longer partition.
    const onFocal = vertical
      ? Math.abs(fixed - focal.x) < 1e-9 || Math.abs(fixed - focal.x - focal.w) < 1e-9
      : Math.abs(fixed - focal.y) < 1e-9 || Math.abs(fixed - focal.y - focal.h) < 1e-9;
    if (onFocal) {
      const a = vertical ? focal.y : focal.x;
      const b = a + (vertical ? focal.h : focal.w);
      intervals = [[start, Math.min(end, a)], [Math.max(start, b), end]].filter(([a, b]) => b - a > 1e-9);
    }
    const stroke = segment.depth <= 1 ? 'muted' : 'line';
    for (const [a, b] of intervals) paths[stroke].push(vertical
      ? `M${x(fixed)},${y(a)}L${x(fixed)},${y(b)}`
      : `M${x(a)},${y(fixed)}L${x(b)},${y(fixed)}`);
  }
  const weight = 'stroke-width="1" vector-effect="non-scaling-stroke" fill="none"';
  const room = `x="${x(focal.x)}" y="${y(focal.y)}" width="${fmt(focal.w * scale)}" height="${fmt(focal.h * scale)}"`;
  const ticks = `M${x(-limit - 0.04)},${y(-0.5)}L${x(-limit)},${y(-0.5)} M${x(limit)},${y(-0.5)}L${x(limit + 0.04)},${y(-0.5)} M${x(-limit - 0.04)},${y(0.5)}L${x(-limit)},${y(0.5)} M${x(limit)},${y(0.5)}L${x(limit + 0.04)},${y(0.5)}`;
  return `<rect ${room} fill="var(--surface)"/>`
    + Object.entries(paths).filter(([, commands]) => commands.length).map(([stroke, commands]) => `<path d="${commands.join(' ')}" stroke="var(--${stroke})" ${weight}/>`).join('')
    + `<path d="${ticks}" stroke="var(--line)" ${weight}/>`
    + `<rect ${room} stroke="var(--accent)" ${weight}/>`;
}
