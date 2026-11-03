import { mulberry32, fmt, pick } from './utils.mjs';

// Elementary binary cellular automata with zero-valued cells beyond the canvas.
// https://reference.wolfram.com/language/ref/CellularAutomaton
export function renderAutomata(seed, bounds = {}) {
  const width = bounds.width ?? 360;
  const height = bounds.height ?? 80;
  const form = bounds.form ?? (width <= 160 ? 'mark' : 'hero');
  const rng = mulberry32(seed);
  const rule = pick(rng, [30, 90, 110, 150]);
  const generations = 8 + Math.floor(rng() * 4);
  const initial = pick(rng, [[1], [1, 1], [1, 0, 1], [1, 1, 1]]);
  const reflected = rng() < 0.5;

  // Compute once in a halo wide enough that the finite boundary cannot affect
  // any displayed generation. Every panel is a prefix of this same evolution.
  const cols = generations * 2 + initial.length;
  let state = Array(cols).fill(0);
  initial.forEach((value, i) => { state[generations + i] = value; });
  const history = [state];
  for (let row = 1; row < generations; row++) {
    state = state.map((_, col) => {
      const neighborhood = ((state[col - 1] ?? 0) << 2) | (state[col] << 1) | (state[col + 1] ?? 0);
      return (rule >>> neighborhood) & 1;
    });
    history.push(state);
  }

  const panels = form === 'mark'
    ? [{ cx: width / 2, rows: generations, focal: true }]
    : [
      { cx: width * 0.18, rows: generations - 3, focal: false },
      { cx: width / 2, rows: generations, focal: true },
      { cx: width * 0.82, rows: generations - 1, focal: false }
    ];
  const cell = Math.min(height * 0.78 / (generations * 2 - 1),
    width * (form === 'mark' ? 0.8 : 0.25) / cols);
  const weight = 'stroke-width="1" vector-effect="non-scaling-stroke" fill="none"';
  let guides = '';
  const figures = panels.map(({ cx, rows, focal }) => {
    // Reflect the evolution about its last row to form a compact woven seal.
    // Draw the union boundary of live cells, removing every shared cell edge.
    const cells = new Set();
    for (let row = 0; row < rows; row++) {
      history[row].forEach((alive, col) => {
        if (!alive) return;
        const x = reflected ? cols - 1 - col : col;
        cells.add(`${x},${row}`);
        cells.add(`${x},${rows * 2 - 2 - row}`);
      });
    }
    const ox = cx - cols * cell / 2;
    const oy = (height - (rows * 2 - 1) * cell) / 2;
    const edges = [];
    const edge = (x1, y1, x2, y2) => edges.push(`M${fmt(ox + x1 * cell)},${fmt(oy + y1 * cell)}L${fmt(ox + x2 * cell)},${fmt(oy + y2 * cell)}`);
    for (const key of cells) {
      const [x, y] = key.split(',').map(Number);
      if (!cells.has(`${x},${y - 1}`)) edge(x, y, x + 1, y);
      if (!cells.has(`${x + 1},${y}`)) edge(x + 1, y, x + 1, y + 1);
      if (!cells.has(`${x},${y + 1}`)) edge(x + 1, y + 1, x, y + 1);
      if (!cells.has(`${x - 1},${y}`)) edge(x, y + 1, x, y);
    }
    const guideY = height / 2;
    guides += `M${fmt(cx - cols * cell / 2 - cell)},${fmt(guideY)}h${fmt(cell)} M${fmt(cx + cols * cell / 2)},${fmt(guideY)}h${fmt(cell)}`;
    return `<path d="${edges.join(' ')}" stroke="var(--${focal ? 'accent' : 'muted'})" ${weight} stroke-linejoin="miter"/>`;
  }).join('');
  return `<path d="${guides}" stroke="var(--line)" ${weight}/>${figures}`;
}
