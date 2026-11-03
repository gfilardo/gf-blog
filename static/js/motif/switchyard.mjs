import { fnv1a, mulberry32, fmt } from './utils.mjs';

/**
 * Switchyard: a variant of the truchet algorithm with a mix of curved connectors,
 * straight crossings, asymmetric inward/outward bends, decorative tile-center dots, 
 * and dashed centerline. Unlike classic Smith tiles, tangent continuity and
 * coloring an entire connected route are not constraints of this design.
 * Coordinate-based tile identity shared by every canvas size.
 * The asymmetric inward/outward arc bends are intentional features of this
 * variant. For classic corner-centered Smith tiles, see truchet.mjs.
 * Truchet background: Christopher Carlson, "Multi-Scale Truchet Patterns":
 * https://archive.bridgesmathart.org/2018/bridges2018-39.pdf
 */
export function renderSwitchyard(seed, bounds = {}) {
  const width = bounds.width ?? 360;
  const height = bounds.height ?? 80;
  const form = bounds.form ?? (width <= 160 ? 'mark' : 'hero');
  const cols = form === 'mark' ? 3 : 15;
  const tile = Math.min(width * 0.94 / cols, height * 0.88 / 3);
  const radius = fmt(tile / 2);
  const paths = [];
  const accents = [];
  const nodes = [];
  const point = (x, y) => `${fmt(width / 2 + x * tile)},${fmt(height / 2 + y * tile)}`;

  // Keep the focal tile inside the shared central 3×3 crop. Its position and
  // decorative registration dot therefore agree in the hero and compact mark.
  const focal = Math.floor(mulberry32(fnv1a(`${seed >>> 0}:focal`))() * 9);
  const focalCol = focal % 3 - 1;
  const focalRow = Math.floor(focal / 3) - 1;
  for (let row = -1; row <= 1; row++) {
    for (let col = -(cols - 1) / 2; col <= (cols - 1) / 2; col++) {
      // Each tile owns a random stream: changing the canvas or loop order never
      // changes its connector type, orientation, or registration dot.
      const rng = mulberry32(fnv1a(`${seed >>> 0}:${col}:${row}`));
      const curved = rng() < 0.75;
      const rotation = Math.floor(rng() * 2);
      const dotted = rng() < 0.25;
      const isFocal = col === focalCol && row === focalRow;
      const left = point(col - 0.5, row);
      const right = point(col + 0.5, row);
      const top = point(col, row - 0.5);
      const bottom = point(col, row + 0.5);
      let first;
      let second;
      if (!curved) {
        first = `M${left}L${right}`;
        second = `M${top}L${bottom}`;
      } else if (rotation === 0) {
        // Preserve the original bend directions, including the inward arc.
        first = `M${left}A${radius},${radius} 0 0,1 ${top}`;
        second = `M${bottom}A${radius},${radius} 0 0,1 ${right}`;
      } else {
        first = `M${top}A${radius},${radius} 0 0,1 ${right}`;
        second = `M${left}A${radius},${radius} 0 0,0 ${bottom}`;
      }
      if (isFocal) accents.push(first);
      else paths.push(first);
      paths.push(second);
      if (dotted || isFocal) {
        // These are decorative tile-center dots, not claims of track junctions.
        // Scale with the tile so the mark reproduces the same relative geometry.
        nodes.push(`<circle cx="${fmt(width / 2 + col * tile)}" cy="${fmt(height / 2 + row * tile)}" r="${fmt(tile * (isFocal ? 0.05 : 0.0375))}" fill="var(--${isFocal ? 'accent' : 'line'})"/>`);
      }
    }
  }

  const left = width / 2 - cols * tile / 2;
  const right = width - left;
  const top = height / 2 - 3 * tile / 2;
  const bottom = height - top;
  const tick = tile * 0.1;
  const guides = `M${fmt(left)},${fmt(top + tick)}V${fmt(top)}H${fmt(left + tick)} M${fmt(right - tick)},${fmt(top)}H${fmt(right)}V${fmt(top + tick)} M${fmt(left)},${fmt(bottom - tick)}V${fmt(bottom)}H${fmt(left + tick)} M${fmt(right - tick)},${fmt(bottom)}H${fmt(right)}V${fmt(bottom - tick)}`;
  // The centerline lies on the same world-space row at every size.
  const axis = `M${fmt(left)},${fmt(height / 2)}H${fmt(right)}`;
  const weight = 'stroke-width="1" vector-effect="non-scaling-stroke" fill="none"';
  return `<path d="${guides}" stroke="var(--line)" ${weight}/>`
    + `<path d="${axis}" stroke="var(--line)" stroke-dasharray="2 4" ${weight}/>`
    + `<path d="${paths.join(' ')}" stroke="var(--muted)" ${weight}/>`
    + `<path d="${accents.join(' ')}" stroke="var(--accent)" ${weight}/>${nodes.join('')}`;
}
