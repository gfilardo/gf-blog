import { mulberry32, fmt } from './utils.mjs';

// Streamlines through a smooth, seeded vector field. Inspired by:
// https://www.tylerxhobbs.com/words/flow-fields
export function renderFlowField(seed, bounds = {}) {
  const width = bounds.width ?? 360;
  const height = bounds.height ?? 80;
  const form = bounds.form ?? (width <= 160 ? 'mark' : 'hero');
  const rng = mulberry32(seed);
  // Parameters are independent of the canvas: the mark samples the same central
  // field as the hero, which extends the currents further along the x axis.
  const phase = rng() * Math.PI * 2;
  const frequency = 2 + rng() * 3;
  const drift = (rng() - 0.5) * 0.6;
  const vortices = Array.from({ length: 2 + Math.floor(rng() * 3) }, () => ({
    x: (rng() - 0.5) * 1.5,
    y: (rng() - 0.5) * 0.65,
    radius: 0.25 + rng() * 0.4,
    strength: (rng() < 0.5 ? -1 : 1) * (2 + rng() * 4)
  }));
  const aspect = width / height;
  const pad = 0.07;
  const limitX = aspect / 2 - pad;
  const limitY = 0.5 - pad;
  const spacing = form === 'mark' ? 0.065 : 0.06;
  const step = 0.025;
  const distance2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const inside = p => Math.abs(p.x) <= limitX && Math.abs(p.y) <= limitY;

  function direction({ x, y }) {
    let vx = 0.85;
    let vy = drift + 0.4 * Math.sin(x * frequency + phase) * Math.cos(y * 3 - phase);
    for (const vortex of vortices) {
      const dx = x - vortex.x;
      const dy = y - vortex.y;
      const influence = vortex.strength * Math.exp(-(dx * dx + dy * dy) / (vortex.radius ** 2));
      vx -= dy / vortex.radius * influence;
      vy += dx / vortex.radius * influence;
    }
    const length = Math.hypot(vx, vy);
    return length < 1e-6 ? null : { x: vx / length, y: vy / length };
  }

  // A spatial hash keeps separation checks local, even in the wide composition.
  const occupied = new Map();
  const bin = p => [Math.floor(p.x / spacing), Math.floor(p.y / spacing)];
  function crowded(p) {
    const [x, y] = bin(p);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const other of occupied.get(`${x + dx},${y + dy}`) ?? []) {
          if (distance2(p, other) < spacing ** 2) return true;
        }
      }
    }
    return false;
  }

  function trace(start, sign, opposite = []) {
    const points = [start];
    for (let i = 0; i < 240; i++) {
      const p = points.at(-1);
      const first = direction(p);
      if (!first) break;
      // Midpoint integration smooths tight bends without increasing SVG density.
      const middle = direction({ x: p.x + first.x * step * sign / 2, y: p.y + first.y * step * sign / 2 });
      if (!middle) break;
      const next = { x: p.x + middle.x * step * sign, y: p.y + middle.y * step * sign };
      if (!inside(next) || crowded(next)) break;
      if (points.some((other, index) => index < points.length - 8 && distance2(next, other) < step ** 2)) break;
      if (opposite.some((other, index) => index > 5 && distance2(next, other) < step ** 2)) break;
      points.push(next);
    }
    return points;
  }

  const candidates = [{ x: 0, y: 0 }];
  const cols = Math.ceil(2 * limitX / spacing);
  const rows = Math.ceil(2 * limitY / spacing);
  // Jittered candidates fill the field, starting near the center for a strong
  // focal streamline. Stable ordering makes rendering reproducible.
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      candidates.push({
        x: -limitX + (col + 0.25 + rng() * 0.5) * 2 * limitX / cols,
        y: -limitY + (row + 0.25 + rng() * 0.5) * 2 * limitY / rows
      });
    }
  }
  candidates.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
  const lines = [];
  for (const candidate of candidates) {
    if (crowded(candidate)) continue;
    const forward = trace(candidate, 1);
    const backward = trace(candidate, -1, forward);
    const points = [...backward.slice(1).reverse(), ...forward];
    if (points.length < 10) continue;
    lines.push(points);
    for (const point of points) {
      const key = bin(point).join(',');
      if (!occupied.has(key)) occupied.set(key, []);
      occupied.get(key).push(point);
    }
    if (lines.length >= (form === 'mark' ? 22 : 42)) break;
  }

  // Keep gentle stretches compact while retaining points around curved sections.
  function path(points) {
    const kept = points.filter((p, i) => {
      if (i === 0 || i === points.length - 1 || i % 3 === 0) return true;
      const a = points[i - 1];
      const b = points[i + 1];
      return Math.abs((p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x)) > 0.0002;
    });
    const point = p => `${fmt(width / 2 + p.x * height)},${fmt(height / 2 + p.y * height)}`;
    const commands = [`M${point(kept[0])}`];
    for (let i = 1; i < kept.length - 1; i++) {
      const p = kept[i];
      const next = kept[i + 1];
      commands.push(`Q${point(p)} ${point({ x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 })}`);
    }
    commands.push(`L${point(kept.at(-1))}`);
    return commands.join(' ');
  }
  const weight = 'stroke-width="1" vector-effect="non-scaling-stroke" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  return lines.map((points, i) => `<path d="${path(points)}" stroke="var(--${i === 0 ? 'accent' : i % 4 === 0 ? 'line' : 'muted'})" ${weight}/>`).join('');
}
