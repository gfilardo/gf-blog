import { fnv1a, mulberry32, fmt } from './utils.mjs';

/**
 * Smith's two quarter-circle tiles, traced as connected routes.
 * Each arc joins adjacent edge midpoints around a tile corner; neighboring
 * tiles consequently meet with matching tangents, without crossings.
 *
 * Reference: Christopher Carlson, "Multi-Scale Truchet Patterns" (Bridges 2018).
 * https://archive.bridgesmathart.org/2018/bridges2018-39.pdf
 * Uses the basic Smith tiles discussed in the paper, at a single tile scale.
 *
 * Both forms sample one 15×3 field; the mark shows its central 3×3 tiles.
 */
export function renderTruchet(seed, bounds = {}) {
  const width = bounds.width ?? 360;
  const height = bounds.height ?? 80;
  const form = bounds.form ?? (width <= 160 ? 'mark' : 'hero');
  const compact = form === 'mark';
  const cols = compact ? 3 : 15;
  const tile = Math.min(width * 0.94 / cols, height * 0.88 / 3);
  const edges = [];
  const adjacent = new Map();
  const key = p => p.join(',');
  const equal = (a, b) => key(a) === key(b);

  // Integer coordinates use half-tile units; shared edge midpoints therefore
  // have identical keys without any floating-point comparisons.
  function add(start, end, sweep, col, row) {
    const index = edges.length;
    edges.push({ start, end, sweep, col, row });
    for (const point of [start, end]) {
      const id = key(point);
      if (!adjacent.has(id)) adjacent.set(id, []);
      adjacent.get(id).push(index);
    }
  }
  for (let row = -1; row <= 1; row++) {
    for (let col = -7; col <= 7; col++) {
      const top = [2 * col, 2 * row - 1];
      const right = [2 * col + 1, 2 * row];
      const bottom = [2 * col, 2 * row + 1];
      const left = [2 * col - 1, 2 * row];
      // Tile identity depends only on seed and location, never traversal order.
      // Mix the coordinate hash through the PRNG rather than using its lowest
      // bit directly, which can create regular parity patterns on the grid.
      const orientation = mulberry32(fnv1a(`${seed >>> 0}:${col}:${row}`))() < 0.5 ? 0 : 1;
      if (orientation === 0) {
        // Centers: top-left and bottom-right. SVG sweep 0/1 chooses the
        // corner-centered quarter-circle, not the alternative interior arc.
        add(left, top, 0, col, row);
        add(bottom, right, 1, col, row);
      } else {
        // Centers: top-right and bottom-left, with the same sweep convention.
        add(top, right, 0, col, row);
        add(left, bottom, 1, col, row);
      }
    }
  }

  const visited = new Set();
  const routes = [];
  // Interior midpoints have degree two and perimeter midpoints degree one,
  // so every component is a non-branching open route or a closed loop.
  function trace(index, start) {
    const route = [];
    let point = start;
    while (index !== undefined && !visited.has(index)) {
      visited.add(index);
      const edge = edges[index];
      const forward = equal(point, edge.start);
      const end = forward ? edge.end : edge.start;
      // Reversing an arc's endpoints also reverses its SVG sweep direction.
      route.push({ ...edge, start: point, end, sweep: forward ? edge.sweep : 1 - edge.sweep });
      point = end;
      index = adjacent.get(key(point)).find(next => !visited.has(next));
    }
    routes.push(route);
  }
  // Open routes start at the perimeter; the remainder are closed loops.
  for (const [id, indices] of adjacent) {
    if (indices.length === 1 && !visited.has(indices[0])) trace(indices[0], id.split(',').map(Number));
  }
  for (let index = 0; index < edges.length; index++) {
    if (!visited.has(index)) trace(index, edges[index].start);
  }

  // Select a route through a seeded arc of the central tile. Trace it across
  // the full field before cropping, so accent membership agrees in both forms.
  const focalArc = fnv1a(`${seed >>> 0}:focal`) & 1;
  const focalEdge = edges.filter(edge => edge.col === 0 && edge.row === 0)[focalArc];
  const focalRoute = routes.find(route => route.some(edge =>
    equal(edge.start, focalEdge.start) && equal(edge.end, focalEdge.end)
    || equal(edge.start, focalEdge.end) && equal(edge.end, focalEdge.start)));
  const point = ([x, y]) => `${fmt(width / 2 + x * tile / 2)},${fmt(height / 2 + y * tile / 2)}`;
  const radius = fmt(tile / 2);
  function path(route) {
    const commands = [];
    let previous = null;
    let cropped = false;
    for (const edge of route) {
      if (compact && Math.abs(edge.col) > 1) {
        // A route can leave and re-enter the crop. Restart with M on re-entry
        // so the renderer never draws a shortcut across the hidden section.
        previous = null;
        cropped = true;
        continue;
      }
      if (!previous || !equal(previous, edge.start)) commands.push(`M${point(edge.start)}`);
      commands.push(`A${radius},${radius} 0 0,${edge.sweep} ${point(edge.end)}`);
      previous = edge.end;
    }
    // Close only complete loops; closing a clipped route would add a chord.
    if (commands.length && !cropped && equal(route[0].start, route.at(-1).end)) commands.push('Z');
    return commands.join(' ');
  }

  const muted = routes.filter(route => route !== focalRoute).map(path).filter(Boolean).join(' ');
  const accent = path(focalRoute);
  const left = (width - cols * tile) / 2;
  const right = width - left;
  const top = (height - 3 * tile) / 2;
  const bottom = height - top;
  const tick = Math.min(3, tile / 5);
  const guides = `M${fmt(left)},${fmt(top + tick)}V${fmt(top)}H${fmt(left + tick)} M${fmt(right - tick)},${fmt(top)}H${fmt(right)}V${fmt(top + tick)} M${fmt(left)},${fmt(bottom - tick)}V${fmt(bottom)}H${fmt(left + tick)} M${fmt(right - tick)},${fmt(bottom)}H${fmt(right)}V${fmt(bottom - tick)}`;
  const weight = 'stroke-width="1" vector-effect="non-scaling-stroke" fill="none"';
  return `<path d="${guides}" stroke="var(--line)" ${weight}/>`
    + `<path d="${muted}" stroke="var(--muted)" ${weight}/>`
    + `<path d="${accent}" stroke="var(--accent)" ${weight}/>`;
}
