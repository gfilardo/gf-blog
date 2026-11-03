import { mulberry32, fmt, pick } from './utils.mjs';

/**
 * Family C: Recursive Guillotine Subdivision
 * 2D Binary Space Partitioning (BSP) constructivist architectural elevation lattice.
 */
export function renderSubdivision(seed, bounds = {}) {
  const width = bounds.width ?? 360;
  const height = bounds.height ?? 80;

  const rng = mulberry32(seed);

  const padX = bounds.form === 'mark' ? 8 : 12;
  const padY = 8;
  const root = { x: padX, y: padY, w: width - 2 * padX, h: height - 2 * padY };

  const leaves = [];
  const dividers = [];

  // Enforce recursion depth floor to guarantee structural complexity
  const targetDepth = 4;

  function subdivide(rect, depth) {
    if (depth >= targetDepth) {
      leaves.push(rect);
      return;
    }

    // Choose split orientation based on aspect ratio with PRNG modulation
    const splitVert = (rect.w / rect.h > 1.4) ? true : (rect.h / rect.w > 1.2 ? false : rng() < 0.5);

    // Harmonic split ratios clamped to prevent microscopic sliver cells
    const goldenRatios = [0.382, 0.5, 0.618];
    const baseRatio = pick(rng, goldenRatios);
    const ratio = Math.max(0.28, Math.min(0.72, baseRatio + (rng() - 0.5) * 0.08));

    if (splitVert) {
      const splitX = rect.x + rect.w * ratio;
      dividers.push({ x1: splitX, y1: rect.y, x2: splitX, y2: rect.y + rect.h, depth });
      subdivide({ x: rect.x, y: rect.y, w: splitX - rect.x, h: rect.h }, depth + 1);
      subdivide({ x: splitX, y: rect.y, w: rect.x + rect.w - splitX, h: rect.h }, depth + 1);
    } else {
      const splitY = rect.y + rect.h * ratio;
      dividers.push({ x1: rect.x, y1: splitY, x2: rect.x + rect.w, y2: splitY, depth });
      subdivide({ x: rect.x, y: rect.y, w: rect.w, h: splitY - rect.y }, depth + 1);
      subdivide({ x: rect.x, y: splitY, w: rect.w, h: rect.y + rect.h - splitY }, depth + 1);
    }
  }

  subdivide(root, 0);

  // Exactly one leaf cell tinted with var(--surface)
  const focalCellIndex = Math.floor(rng() * leaves.length);
  const focalCell = leaves[focalCellIndex];
  const surfaceRect = `<rect x="${fmt(focalCell.x)}" y="${fmt(focalCell.y)}" width="${fmt(focalCell.w)}" height="${fmt(focalCell.h)}" fill="var(--surface)"/>`;

  // Outer framing boundary
  const outerBorder = `<rect x="${fmt(root.x)}" y="${fmt(root.y)}" width="${fmt(root.w)}" height="${fmt(root.h)}" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/>`;

  // Prominent divider lines vs hairline dividers
  const focalDividerIndex = Math.floor(rng() * dividers.length);
  const linePaths = dividers.map((d, i) => {
    if (i === focalDividerIndex) {
      return `<line x1="${fmt(d.x1)}" y1="${fmt(d.y1)}" x2="${fmt(d.x2)}" y2="${fmt(d.y2)}" stroke="var(--accent)" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
    }
    const stroke = d.depth <= 1 ? 'var(--muted)' : 'var(--line)';
    return `<line x1="${fmt(d.x1)}" y1="${fmt(d.y1)}" x2="${fmt(d.x2)}" y2="${fmt(d.y2)}" stroke="${stroke}" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  }).join('');

  // Architectural corner tick marks
  const tickLen = 3;
  const cornerTicks = `<path d="M${fmt(root.x - tickLen)},${fmt(root.y)} H${fmt(root.x + root.w + tickLen)} M${fmt(root.x - tickLen)},${fmt(root.y + root.h)} H${fmt(root.x + root.w + tickLen)}" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"/>`;

  // Focal accent coordinate marker
  const marker = `<circle cx="${fmt(focalCell.x + focalCell.w / 2)}" cy="${fmt(focalCell.y + focalCell.h / 2)}" r="2" fill="var(--accent)"/>`;

  return `${surfaceRect}${outerBorder}${linePaths}${cornerTicks}${marker}`;
}

