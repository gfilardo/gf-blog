import { mulberry32, fmt } from './utils.mjs';

/**
 * Extract connected isolines from a rectangular scalar grid. Shared grid edges
 * have stable IDs, so adjacent cells join without floating-point key rounding.
 * Four-crossing saddle cells use the bilinear asymptotic decider; exact ties
 * consistently connect top/right and bottom/left.
 * Reference: https://www.boristhebrave.com/docs/sylves/1/articles/tutorials/marching_squares.html
 */
export function marchingSquares(grid, level) {
  const rows = grid.length - 1;
  const cols = grid[0].length - 1;
  const vertices = new Map();
  const neighbors = new Map();
  function crossing(key, x, y, a, b, horizontal) {
    if (!vertices.has(key)) {
      const t = a / (a - b);
      vertices.set(key, [x + (horizontal ? t : 0), y + (horizontal ? 0 : t)]);
      neighbors.set(key, []);
    }
    return key;
  }
  const shifted = value => value === level ? 1e-12 : value - level;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const [tl, tr, br, bl] = [grid[y][x], grid[y][x + 1], grid[y + 1][x + 1], grid[y + 1][x]].map(shifted);
    const edges = [];
    if ((tl > 0) !== (tr > 0)) edges[0] = crossing(`h:${x}:${y}`, x, y, tl, tr, true);
    if ((tr > 0) !== (br > 0)) edges[1] = crossing(`v:${x + 1}:${y}`, x + 1, y, tr, br, false);
    if ((bl > 0) !== (br > 0)) edges[2] = crossing(`h:${x}:${y + 1}`, x, y + 1, bl, br, true);
    if ((tl > 0) !== (bl > 0)) edges[3] = crossing(`v:${x}:${y}`, x, y, tl, bl, false);
    const crossed = edges.filter(Boolean);
    const pairs = crossed.length === 4
      ? (tl * br - tr * bl >= 0 ? [[edges[0], edges[1]], [edges[2], edges[3]]] : [[edges[0], edges[3]], [edges[1], edges[2]]])
      : crossed.length === 2 ? [crossed] : [];
    for (const [a, b] of pairs) {
      neighbors.get(a).push(b);
      neighbors.get(b).push(a);
    }
  }
  const visited = new Set();
  const routes = [];
  function trace(start) {
    const points = [];
    let current = start;
    let closed = false;
    while (!visited.has(current)) {
      visited.add(current);
      points.push(vertices.get(current));
      const next = neighbors.get(current).find(key => !visited.has(key));
      if (next === undefined) {
        closed = neighbors.get(current).includes(start) && points.length > 2;
        break;
      }
      current = next;
    }
    if (closed) points.push(points[0]);
    if (points.length >= 2) routes.push({ points, closed });
  }
  for (const [key, adjacent] of neighbors) if (adjacent.length === 1 && !visited.has(key)) trace(key);
  for (const key of neighbors.keys()) if (!visited.has(key)) trace(key);
  return routes;
}

const RESOLUTION = 48;
const HALF_WIDTH = 2.25;

// Clip line segments rather than using SVG clip paths: every emitted coordinate
// remains inside its canvas, including newly created endpoints at the crop edge.
function crop(points, limit) {
  const chunks = [];
  let chunk = null;
  const same = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dx = b[0] - a[0];
    let enter = 0, leave = 1;
    if (Math.abs(dx) < 1e-12) {
      if (Math.abs(a[0]) > limit) { chunk = null; continue; }
    } else {
      const t1 = (-limit - a[0]) / dx, t2 = (limit - a[0]) / dx;
      enter = Math.max(0, Math.min(t1, t2));
      leave = Math.min(1, Math.max(t1, t2));
      if (enter >= leave) { chunk = null; continue; }
    }
    const start = [a[0] + dx * enter, a[1] + (b[1] - a[1]) * enter];
    const end = [a[0] + dx * leave, a[1] + (b[1] - a[1]) * leave];
    if (!chunk || !same(chunk.at(-1), start)) { chunk = [start]; chunks.push(chunk); }
    chunk.push(end);
  }
  // Join pieces split only by the arbitrary starting vertex of a closed loop.
  if (chunks.length > 1 && same(chunks.at(-1).at(-1), chunks[0][0])) {
    chunks[0] = [...chunks.pop(), ...chunks[0].slice(1)];
  }
  return chunks;
}

/**
 * Seeded Gaussian hills and valleys rendered as connected contour maps.
 * The compact mark crops the central square of the same canonical terrain;
 * neither field sampling, elevation levels nor focal selection depend on size.
 */
export function renderContours(seed, bounds = {}) {
  const width = bounds.width ?? 360;
  const height = bounds.height ?? 80;
  const form = bounds.form ?? (width <= 160 ? 'mark' : 'hero');
  const compact = form === 'mark';
  const rng = mulberry32(seed);
  const anchor = { x: (rng() - 0.5) * 0.3, y: (rng() - 0.5) * 0.2 };
  const hills = [{ ...anchor, radius: 0.18 + rng() * 0.07, amplitude: 1.3 }];
  // A nearby secondary summit gives the shared central crop its own ridges
  // and saddles, rather than reducing every compact mark to concentric ovals.
  const bearing = rng() * Math.PI * 2;
  const separation = 0.22 + rng() * 0.1;
  hills.push({
    x: anchor.x + Math.cos(bearing) * separation,
    y: anchor.y + Math.sin(bearing) * separation * 0.65,
    radius: 0.13 + rng() * 0.07, amplitude: 0.75 + rng() * 0.45
  });
  for (const side of [-1, 1]) hills.push({
    x: side * (1.1 + rng() * 0.4), y: (rng() - 0.5) * 0.3,
    radius: 0.23 + rng() * 0.12, amplitude: 1 + rng() * 0.3
  });
  for (let i = 0; i < 6; i++) hills.push({
    x: (rng() - 0.5) * 4,
    y: (rng() - 0.5) * 0.6,
    radius: 0.13 + rng() * 0.17,
    amplitude: rng() < 0.2 ? -0.3 : 0.45 + rng() * 0.65
  });
  for (const hill of hills) {
    hill.angle = rng() * Math.PI;
    hill.aspect = 0.65 + rng() * 0.7;
  }
  const grid = Array.from({ length: RESOLUTION + 1 }, (_, row) =>
    Array.from({ length: RESOLUTION * 4.5 + 1 }, (_, col) => {
      const x = col / RESOLUTION - HALF_WIDTH;
      const y = row / RESOLUTION - 0.5;
      const elevation = hills.reduce((value, hill) => {
        const dx = x - hill.x, dy = y - hill.y;
        const u = (dx * Math.cos(hill.angle) + dy * Math.sin(hill.angle)) / hill.aspect;
        const v = -dx * Math.sin(hill.angle) + dy * Math.cos(hill.angle);
        return value + hill.amplitude * Math.exp(-(u * u + v * v) / hill.radius ** 2);
      }, 0);
      // A zero-elevation coastline at the field boundary makes every positive
      // isoline an enclosed island, rather than a cropped, flowing ribbon.
      return elevation * (1 - (x / HALF_WIDTH) ** 8) * (1 - (y / 0.5) ** 8);
    }));
  // Choose elevations within the central crop's value range. Every level then
  // intersects that crop, even when several broad hills overlap the anchor.
  let peak = -Infinity, trough = Infinity;
  for (let y = 0; y <= RESOLUTION; y++) for (let x = RESOLUTION * 1.75; x <= RESOLUTION * 2.75; x++) {
    peak = Math.max(peak, grid[y][x]);
    trough = Math.min(trough, grid[y][x]);
  }
  const routes = [];
  for (let level = 0; level < 6; level++) {
    for (const route of marchingSquares(grid, trough + (peak - trough) * (0.18 + level * 0.13))) {
      routes.push({ level, points: route.points.map(([x, y]) => [x / RESOLUTION - HALF_WIDTH, y / RESOLUTION - 0.5]) });
    }
  }
  // Accent the complete middle-elevation component nearest the central hill.
  // Select before cropping so hero and mark retain identical route membership.
  const candidates = routes.filter(route => route.level === 3 && route.points.some(([x]) => Math.abs(x) <= 0.5));
  const distance = route => Math.min(...route.points.map(([x, y]) => (x - anchor.x) ** 2 + (y - anchor.y) ** 2));
  const focal = candidates.reduce((best, route) => !best || distance(route) < distance(best) ? route : best, null);
  const scale = compact ? Math.min(width, height) * 0.88 : Math.min(height * 0.88, width * 0.94 / 4.5);
  const weight = 'stroke-width="1" vector-effect="non-scaling-stroke" fill="none" stroke-linejoin="round" stroke-linecap="round"';
  const contours = routes.map(route => {
    const chunks = crop(route.points, compact ? 0.5 : HALF_WIDTH);
    const d = chunks.map(points => {
      const closed = Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]) < 1e-9;
      return points.map(([x, y], i) => `${i ? 'L' : 'M'}${fmt(width / 2 + x * scale)},${fmt(height / 2 + y * scale)}`).join(' ') + (closed ? 'Z' : '');
    }).join(' ');
    if (!d) return '';
    const stroke = route === focal ? 'accent' : route.level === 0 ? 'line' : 'muted';
    return `<path d="${d}" stroke="var(--${stroke})" ${weight}/>`;
  }).join('');
  // Cartographic summit crosses mark actual local maxima, not Gaussian centers:
  // overlapping hills can move a peak. Select globally before applying the crop.
  const peaks = [];
  for (let row = 2; row < RESOLUTION - 1; row++) for (let col = 2; col < grid[0].length - 2; col++) {
    const value = grid[row][col];
    if (value < peak * 0.3) continue;
    let maximum = true;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && grid[row + dy][col + dx] >= value) maximum = false;
    }
    if (maximum) peaks.push({ x: col / RESOLUTION - HALF_WIDTH, y: row / RESOLUTION - 0.5, value });
  }
  peaks.sort((a, b) => b.value - a.value);
  const selected = [];
  for (const summit of peaks) {
    if (selected.every(other => Math.hypot(summit.x - other.x, summit.y - other.y) > 0.35)) selected.push(summit);
    if (selected.length === 4) break;
  }
  const crosses = selected.flatMap(({ x, y }) => [
    [[x - 0.025, y], [x + 0.025, y]],
    [[x, y - 0.025], [x, y + 0.025]]
  ]).flatMap(segment => crop(segment, compact ? 0.5 : HALF_WIDTH)).map(points =>
    points.map(([x, y], i) => `${i ? 'L' : 'M'}${fmt(width / 2 + x * scale)},${fmt(height / 2 + y * scale)}`).join(' ')).join(' ');
  return contours + (crosses ? `<path data-contour-detail="summits" d="${crosses}" stroke="var(--line)" ${weight}/>` : '');
}
