import { mulberry32, fmt } from './utils.mjs';

/**
 * Family A: Truchet Tile Circuits
 * Grid-based circuit network composed of Smith quarter-circle arcs and crossing tracks.
 */
export function renderTruchet(seed, bounds = {}) {
  const width = bounds.width ?? 360;
  const height = bounds.height ?? 80;
  const form = bounds.form ?? (width <= 160 ? 'mark' : 'hero');

  const rng = mulberry32(seed);

  // Adapts grid to canvas form while preserving visual identity
  const cols = form === 'mark' ? 3 : 9;
  const rows = form === 'mark' ? 3 : 2;
  const tileSize = Math.min(width / cols, height / rows);
  const offsetX = (width - cols * tileSize) / 2;
  const offsetY = (height - rows * tileSize) / 2;

  const totalTiles = cols * rows;
  const focalIndex = Math.floor(rng() * totalTiles);

  let paths = [];
  let accentPaths = [];
  let nodes = [];

  // Corner registration ticks in --line
  const tick = 4;
  const cornerTicks = `<path d="M${fmt(offsetX)},${fmt(offsetY + tick)} V${fmt(offsetY)} H${fmt(offsetX + tick)} M${fmt(offsetX + cols * tileSize - tick)},${fmt(offsetY)} H${fmt(offsetX + cols * tileSize)} V${fmt(offsetY + tick)} M${fmt(offsetX)},${fmt(offsetY + rows * tileSize - tick)} V${fmt(offsetY + rows * tileSize)} H${fmt(offsetX + tick)} M${fmt(offsetX + cols * tileSize - tick)},${fmt(offsetY + rows * tileSize)} H${fmt(offsetX + cols * tileSize)} V${fmt(offsetY + rows * tileSize - tick)}" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/>`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const isFocal = idx === focalIndex;
      const x = offsetX + c * tileSize;
      const y = offsetY + r * tileSize;
      const s = tileSize;
      const hs = s / 2;

      // PRNG-driven tile variety: dual arcs vs crossing track
      const tileType = rng() < 0.75 ? 'arc' : 'cross';
      const rotation = Math.floor(rng() * 2); // 0 or 1

      if (tileType === 'cross') {
        const p1 = `M${fmt(x)},${fmt(y + hs)} H${fmt(x + s)}`;
        const p2 = `M${fmt(x + hs)},${fmt(y)} V${fmt(y + s)}`;
        if (isFocal) {
          accentPaths.push(p1);
          paths.push(p2);
        } else {
          paths.push(`${p1} ${p2}`);
        }
      } else if (rotation === 0) {
        // Arcs: Top-Left and Bottom-Right
        const a1 = `M${fmt(x)},${fmt(y + hs)} A${fmt(hs)},${fmt(hs)} 0 0,1 ${fmt(x + hs)},${fmt(y)}`;
        const a2 = `M${fmt(x + hs)},${fmt(y + s)} A${fmt(hs)},${fmt(hs)} 0 0,1 ${fmt(x + s)},${fmt(y + hs)}`;
        if (isFocal) {
          accentPaths.push(a1);
          paths.push(a2);
        } else {
          paths.push(`${a1} ${a2}`);
        }
      } else {
        // Arcs: Top-Right and Bottom-Left
        const a1 = `M${fmt(x + hs)},${fmt(y)} A${fmt(hs)},${fmt(hs)} 0 0,1 ${fmt(x + s)},${fmt(y + hs)}`;
        const a2 = `M${fmt(x)},${fmt(y + hs)} A${fmt(hs)},${fmt(hs)} 0 0,0 ${fmt(x + hs)},${fmt(y + s)}`;
        if (isFocal) {
          accentPaths.push(a1);
          paths.push(a2);
        } else {
          paths.push(`${a1} ${a2}`);
        }
      }

      // Small junction pin node at select edge midpoints
      if (rng() < 0.25) {
        nodes.push(`<circle cx="${fmt(x + hs)}" cy="${fmt(y + hs)}" r="1.5" fill="var(--line)"/>`);
      }
    }
  }

  // Accent junction node on the focal tile
  const focalCol = focalIndex % cols;
  const focalRow = Math.floor(focalIndex / cols);
  const fx = offsetX + focalCol * tileSize + tileSize / 2;
  const fy = offsetY + focalRow * tileSize + tileSize / 2;
  nodes.push(`<circle cx="${fmt(fx)}" cy="${fmt(fy)}" r="2" fill="var(--accent)"/>`);

  const bgGuide = `<line x1="${fmt(offsetX)}" y1="${fmt(offsetY + rows * tileSize / 2)}" x2="${fmt(offsetX + cols * tileSize)}" y2="${fmt(offsetY + rows * tileSize / 2)}" stroke="var(--line)" stroke-dasharray="2 4" stroke-width="1" vector-effect="non-scaling-stroke"/>`;

  return [
    cornerTicks,
    bgGuide,
    `<path d="${paths.join(' ')}" stroke="var(--muted)" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/>`,
    accentPaths.length ? `<path d="${accentPaths.join(' ')}" stroke="var(--accent)" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/>` : '',
    nodes.join('')
  ].filter(Boolean).join('');
}

