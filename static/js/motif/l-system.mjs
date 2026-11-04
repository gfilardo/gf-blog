import { fnv1a, mulberry32, fmt, pick } from './utils.mjs';

const randomAt = (seed, id) => mulberry32(fnv1a(`${seed >>> 0}:${id}`))();

/**
 * Parallel string rewriting with stable symbol ancestry. An unchanged symbol
 * retains its ID in later generations, so growing more branches never changes
 * earlier stochastic choices. Reject oversized expansions rather than truncating
 * a string in the middle of a bracketed branch.
 * Reference: Prusinkiewicz & Lindenmayer, The Algorithmic Beauty of Plants, ch. 1.
 * https://algorithmicbotany.org/papers/#abop
 */
export function rewriteLSystem(axiom, rules, iterations, seed = 0, maxSymbols = 8192) {
  if (!Number.isInteger(iterations) || iterations < 0 || iterations > 8) throw new RangeError('L-system iterations must be between 0 and 8');
  let tokens = [...axiom].map((symbol, index) => ({ symbol, id: String(index) }));
  if (tokens.length > maxSymbols) throw new RangeError('L-system symbol limit exceeded');
  for (let generation = 0; generation < iterations; generation++) {
    const next = [];
    for (const token of tokens) {
      const rule = rules[token.symbol];
      if (rule === undefined) next.push(token);
      else {
        const replacement = Array.isArray(rule) ? rule[Math.floor(randomAt(seed, `rule:${token.id}`) * rule.length)] : rule;
        [...replacement].forEach((symbol, index) => next.push({ symbol, id: `${token.id}.${index}` }));
      }
      if (next.length > maxSymbols) throw new RangeError('L-system symbol limit exceeded');
    }
    tokens = next;
  }
  return tokens;
}

export function interpretLSystem(tokens, { angle, shrink = 0.7, seed = 0, tilt = 0, variation = 0.12 }) {
  let state = { x: 0, y: 0, heading: -Math.PI / 2 + tilt, length: 1, depth: 0, parent: null };
  const stack = [];
  const segments = [];
  for (const { symbol, id } of tokens) {
    if (symbol === 'F') {
      const length = state.length * (1 + (randomAt(seed, `length:${id}`) - 0.5) * variation);
      const end = [state.x + Math.cos(state.heading) * length, state.y + Math.sin(state.heading) * length];
      segments.push({ id, parent: state.parent, depth: state.depth, start: [state.x, state.y], end });
      state = { ...state, x: end[0], y: end[1], parent: id };
    } else if (symbol === '+' || symbol === '-') {
      state.heading += (symbol === '+' ? 1 : -1) * angle * (1 + (randomAt(seed, `turn:${id}`) - 0.5) * variation);
    } else if (symbol === '[') {
      stack.push({ ...state });
      state.length *= shrink;
      state.depth++;
    } else if (symbol === ']') {
      if (!stack.length) throw new Error('Unbalanced L-system brackets');
      state = stack.pop();
    }
  }
  if (stack.length) throw new Error('Unbalanced L-system brackets');
  return segments;
}

/**
 * Three curated grammars produce forks, asymmetric sprigs and crystalline fans.
 * Hero panels show growth stages; the mark reproduces the complete central tree.
 * Seeded rule, turn and length choices depend on symbol ancestry, not canvas size.
 */
export function renderLSystem(seed, bounds = {}) {
  const width = bounds.width ?? 360;
  const height = bounds.height ?? 80;
  const form = bounds.form ?? (width <= 160 ? 'mark' : 'hero');
  const compact = form === 'mark';
  const rng = mulberry32(seed);
  const family = pick(rng, [
    { rules: { X: ['F[+X][-X]', 'F[+X][-X]', 'F[+X]F[-X]'] }, depth: 5, angle: 26 },
    { rules: { X: ['F[+X]F[-X]X', 'F[+X]FX', 'F[-X]FX'] }, depth: 4, angle: 24 },
    { rules: { X: ['F[+X][X][-X]', 'F[+X][-X]'] }, depth: 4, angle: 36 }
  ]);
  const options = {
    seed,
    angle: (family.angle + (rng() - 0.5) * 14) * Math.PI / 180,
    shrink: 0.62 + rng() * 0.16,
    tilt: (rng() - 0.5) * 0.24
  };
  const model = depth => interpretLSystem(rewriteLSystem('X', family.rules, depth, seed), options);
  const full = model(family.depth);
  const xs = full.flatMap(s => [s.start[0], s.end[0]]);
  const ys = full.flatMap(s => [s.start[1], s.end[1]]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  const extent = Math.max(maxX - minX, maxY - minY);
  const size = Math.min(height * 0.82, width * (compact ? 0.82 : 0.25));
  const scale = size / extent;

  // One complete root-to-tip branch is accented. Parent links survive stack
  // restoration, so following them cannot jump between unrelated branches.
  const parents = new Set(full.map(s => s.parent));
  const tips = full.filter(s => !parents.has(s.id));
  const tip = tips[Math.floor(randomAt(seed, 'focal') * tips.length)];
  const byId = new Map(full.map(s => [s.id, s]));
  const accented = new Set();
  const branch = [];
  for (let segment = tip; segment; segment = byId.get(segment.parent)) {
    accented.add(segment.id);
    branch.unshift(segment);
  }
  const panels = compact ? [{ cx: width / 2, depth: family.depth, focal: true }] : [
    { cx: width * 0.18, depth: family.depth - 2, focal: false },
    { cx: width / 2, depth: family.depth, focal: true },
    { cx: width * 0.82, depth: family.depth - 1, focal: false }
  ];
  const weight = 'stroke-width="1" vector-effect="non-scaling-stroke" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  return panels.map(({ cx, depth, focal }) => {
    // Use the full model's framing for every stage, so the side studies grow
    // from the same root instead of being independently stretched to fill space.
    const point = ([x, y]) => `${fmt(cx + (x - centerX) * scale)},${fmt(height / 2 + (y - centerY) * scale)}`;
    const segments = focal ? full : model(depth);
    const muted = segments.filter(s => !focal || !accented.has(s.id))
      .map(s => `M${point(s.start)}L${point(s.end)}`).join(' ');
    const accent = focal ? `M${point(branch[0].start)}${branch.map(s => `L${point(s.end)}`).join(' ')}` : '';
    return (muted ? `<path d="${muted}" stroke="var(--muted)" ${weight}/>` : '')
      + (accent ? `<path d="${accent}" stroke="var(--accent)" ${weight}/>` : '');
  }).join('');
}
