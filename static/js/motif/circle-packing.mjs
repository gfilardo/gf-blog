import { fnv1a, mulberry32, fmt } from './utils.mjs';

/**
 * Bounded greedy circle packing in a canonical capsule-shaped region. For each
 * batch, choose the sampled center with the most free space, then grow its disc
 * up to the boundary, neighbors or seeded radius cap. The small drafting gap
 * keeps adjacent outlines distinguishable at list-mark size.
 * Reference: https://thecodingtrain.com/challenges/50-animated-circle-packing
 */
export function createCirclePacking(seed) {
  const rng = mulberry32(seed);
  const halfLine = 1.55 + rng() * 0.2;
  const boundaryRadius = 0.35 + rng() * 0.09;
  const radiusCap = 0.15 + rng() * 0.1;
  const minimumRadius = 0.05;
  const gap = 0.045;
  // Reserve the focal disc inside the shared crop before placing its neighbors.
  const focal = { x: (rng() - 0.5) * 0.18, y: (rng() - 0.5) * 0.12, r: 0.14 + rng() * 0.07 };
  const circles = [focal];
  const clearance = (x, y) => boundaryRadius - Math.hypot(Math.max(Math.abs(x) - halfLine, 0), y);
  const target = 48 + Math.floor(rng() * 17);
  // No unbounded rejection loop: at most 120 batches × 32 candidate centers.
  for (let batch = 0; batch < 120 && circles.length < target; batch++) {
    let best = null;
    for (let attempt = 0; attempt < 32; attempt++) {
      const x = (rng() - 0.5) * 2 * (halfLine + boundaryRadius);
      const y = (rng() - 0.5) * 2 * boundaryRadius;
      let room = clearance(x, y);
      if (room < minimumRadius) continue;
      for (const circle of circles) {
        room = Math.min(room, Math.hypot(x - circle.x, y - circle.y) - circle.r - gap);
        if (room < minimumRadius) break;
      }
      if (room >= minimumRadius && (!best || room > best.room)) best = { x, y, room };
    }
    if (best) {
      const available = Math.min(best.room, radiusCap * (0.65 + rng() * 0.35));
      // Keep the first large anchors, then sample more of the available radius
      // range. Always growing every disc to its maximum clustered the smaller
      // circles near the same size. Leave the minimum radius and gap intact.
      const sizing = mulberry32(fnv1a(`${seed >>> 0}:radius:${circles.length}`))();
      const r = circles.length < 6 ? available : minimumRadius + (available - minimumRadius) * (0.35 + sizing * 0.65);
      circles.push({ x: best.x, y: best.y, r });
    }
  }
  // Paint belongs to circle identity, independent of radius and canvas. Its
  // separate random streams cannot perturb the placement or growth decisions.
  circles.forEach((circle, index) => {
    const paint = mulberry32(fnv1a(`${seed >>> 0}:paint:${index}`));
    const stroke = paint();
    const fill = paint();
    circle.stroke = circle === focal ? 'var(--accent)' : stroke < 0.3 ? 'var(--line)' : stroke < 0.9 ? 'var(--muted)' : 'var(--ink)';
    circle.fill = circle === focal ? 'var(--surface)' : fill < 0.6 ? 'none' : fill < 0.85 ? 'var(--surface)' : fill < 0.97 ? 'var(--line)' : 'var(--muted)';
  });
  return { circles, focal, halfLine, boundaryRadius, minimumRadius, gap };
}

/**
 * Visible angular intervals of a circle cropped by vertical boundaries. Native
 * SVG arcs express partial discs without introducing straight closing chords or
 * emitting off-canvas circle geometry. Merge intervals across the 0/2π seam.
 */
export function circleArcsInStrip(circle, left, right) {
  const turn = Math.PI * 2;
  const angles = [0, turn];
  for (const edge of [left, right]) {
    const cosine = (edge - circle.x) / circle.r;
    if (cosine > -1 && cosine < 1) {
      const angle = Math.acos(cosine);
      angles.push(angle, turn - angle);
    }
  }
  angles.sort((a, b) => a - b);
  const arcs = [];
  for (let i = 1; i < angles.length; i++) {
    const start = angles[i - 1], end = angles[i];
    const x = circle.x + circle.r * Math.cos((start + end) / 2);
    if (end - start > 1e-12 && x >= left && x <= right) arcs.push([start, end]);
  }
  if (arcs.length > 1 && arcs[0][0] === 0 && arcs.at(-1)[1] === turn) {
    const first = arcs.shift();
    arcs[arcs.length - 1][1] = turn + first[1];
  }
  return arcs;
}

/**
 * The hero shows the complete packing; compact and list marks show its central
 * square, preserving circle centers, radii and accent identity. A packing is
 * never restarted for a different aspect ratio.
 */
export function renderCirclePacking(seed, bounds = {}) {
  const width = bounds.width ?? 360;
  const height = bounds.height ?? 80;
  const form = bounds.form ?? (width <= 160 ? 'mark' : 'hero');
  const compact = form === 'mark';
  const { circles, focal } = createCirclePacking(seed);
  const scale = compact ? Math.min(width, height) * 0.88 : Math.min(height * 0.88, width * 0.94 / 4.5);
  const x = value => fmt(width / 2 + value * scale);
  const y = value => fmt(height / 2 + value * scale);
  const weight = 'stroke-width="1" vector-effect="non-scaling-stroke"';
  return [...circles.slice(1), focal].map(circle => {
    const { stroke, fill } = circle;
    const radius = fmt(circle.r * scale);
    if (!compact || circle.x - circle.r >= -0.5 && circle.x + circle.r <= 0.5) {
      return `<circle cx="${x(circle.x)}" cy="${y(circle.y)}" r="${radius}" stroke="${stroke}" fill="${fill}" ${weight}/>`;
    }
    const arcs = circleArcsInStrip(circle, -0.5, 0.5);
    const d = arcs.map(([start, end]) => {
      const point = theta => `${x(circle.x + circle.r * Math.cos(theta))},${y(circle.y + circle.r * Math.sin(theta))}`;
      return `M${point(start)}A${radius},${radius} 0 ${end - start > Math.PI ? 1 : 0},1 ${point(end)}`;
    }).join(' ');
    // SVG closes the fill implicitly along the crop edge, while the unclosed
    // path strokes only the visible circular arc. Preserve the original paint.
    return d ? `<path d="${d}" stroke="${stroke}" fill="${fill}" ${weight}/>` : '';
  }).join('');
}
