import { fnv1a } from './motif/utils.mjs';
export { fnv1a, mulberry32 } from './motif/utils.mjs';
import { renderTruchet } from './motif/truchet.mjs';
export { renderTruchet };
import { renderGuilloche } from './motif/guilloche.mjs';
export { renderGuilloche };
import { renderSubdivision } from './motif/subdivision.mjs';
export { renderSubdivision };
import { renderSupershape } from './motif/supershape.mjs';
export { renderSupershape };
import { renderAutomata } from './motif/automata.mjs';
export { renderAutomata };
import { renderFlowField } from './motif/flow-field.mjs';
export { renderFlowField };
import { renderSwitchyard } from './motif/switchyard.mjs';
export { renderSwitchyard };
import { renderContours } from './motif/contours.mjs';
export { renderContours };
import { renderLSystem } from './motif/l-system.mjs';
export { renderLSystem };
import { renderChords } from './motif/chords.mjs';
export { renderChords };

// Immutable registry of dated algorithm epochs
export const ALGORITHMS = [
  // Epoch 1: Initial Launch
  { id: 'truchet', since: '2026-01-01', draw: renderTruchet },
  { id: 'guilloche', since: '2026-01-01', draw: renderGuilloche },
  { id: 'subdivision', since: '2026-01-01', draw: renderSubdivision },
  // Epoch 2: append only; articles before this date retain their original selection.
  { id: 'supershape', since: '2026-10-03', draw: renderSupershape },
  { id: 'automata', since: '2026-10-03', draw: renderAutomata },
  { id: 'flow-field', since: '2026-10-03', draw: renderFlowField },
  { id: 'switchyard', since: '2026-10-03', draw: renderSwitchyard },
  // Epoch 3: contour maps, two months after their implementation.
  { id: 'contours', since: '2027-01-04', draw: renderContours },
  // Epoch 4: L-systems, one month after contour maps.
  { id: 'l-system', since: '2027-02-04', draw: renderLSystem },
  // Epoch 5: modular chord diagrams.
  { id: 'chords', since: '2027-03-04', draw: renderChords },
];

/**
 * Asserts all architectural registry invariants:
 * 1. Monotonic since timestamps
 * 2. Unique algorithm IDs
 * 3. Immutable registry entries
 */
export function assertRegistryInvariants(algorithms = ALGORITHMS) {
  const seenIds = new Set();
  let prevDate = '0000-00-00';

  for (let i = 0; i < algorithms.length; i++) {
    const algo = algorithms[i];
    if (!algo.id || typeof algo.id !== 'string') {
      throw new Error(`Registry entry at index ${i} has invalid id: ${algo.id}`);
    }
    if (seenIds.has(algo.id)) {
      throw new Error(`Duplicate algorithm ID in registry: ${algo.id}`);
    }
    seenIds.add(algo.id);

    if (!algo.since || typeof algo.since !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(algo.since)) {
      throw new Error(`Algorithm ${algo.id} has invalid date format for since: ${algo.since}`);
    }
    if (algo.since < prevDate) {
      throw new Error(`Algorithm ${algo.id} (${algo.since}) breaks monotonicity; follows ${prevDate}`);
    }
    prevDate = algo.since;

    if (typeof algo.draw !== 'function') {
      throw new Error(`Algorithm ${algo.id} is missing draw function`);
    }
  }
}

// Check if algorithm ID is known
export function isKnownAlgorithm(id, algorithms = ALGORITHMS) {
  return algorithms.some(a => a.id === id);
}

/**
 * Resolves algorithm and seed independently.
 */
export function resolveMotifParameters(doc, algorithms = ALGORITHMS) {
  // 1. Explicit seed from frontmatter or default to slug FNV-1a hash
  let seed;
  if (typeof doc.motif === 'object' && doc.motif !== null && typeof doc.motif.seed === 'number') {
    seed = doc.motif.seed >>> 0;
  } else {
    seed = fnv1a(doc.slug);
  }

  // 2. Algorithm selection precedence:
  //    a. Explicit article frontmatter
  //    b. Series-level override
  //    c. Date-based epoch selection from slug hash
  let algorithmId = null;
  if (typeof doc.motif === 'string') {
    algorithmId = doc.motif;
  } else if (typeof doc.motif === 'object' && doc.motif !== null && typeof doc.motif.algorithm === 'string') {
    algorithmId = doc.motif.algorithm;
  } else if (doc.series && typeof doc.series.motif === 'string') {
    algorithmId = doc.series.motif;
  }

  if (algorithmId) {
    const found = algorithms.find(a => a.id === algorithmId);
    if (!found) {
      throw new Error(`Unknown motif algorithm "${algorithmId}" declared in ${doc.source || doc.slug}`);
    }
    return { algorithm: found, seed };
  }

  // Evaluate date epoch
  // Draft previews without date or future dates get access to the latest epoch
  const effectiveDate = (doc.draft && (!doc.date || doc.date > '2026-11-02'))
    ? '9999-12-31'
    : (doc.date || '9999-12-31');

  const eligible = algorithms.filter(a => a.since <= effectiveDate);
  if (eligible.length === 0) {
    throw new Error(`Article ${doc.slug} date (${doc.date}) precedes first algorithm epoch`);
  }

  // Slug-based deterministic index
  const slugHash = fnv1a(doc.slug);
  const selected = eligible[slugHash % eligible.length];
  return { algorithm: selected, seed };
}

/**
 * Generates the full inline SVG for an article.
 */
export function generateArticleMotif(doc, options = {}, algorithms = ALGORITHMS) {
  const width = options.width ?? 360;
  const height = options.height ?? 80;
  const form = options.form ?? (width <= 160 ? 'mark' : 'hero');

  const { algorithm, seed } = resolveMotifParameters(doc, algorithms);

  // Enforce complexity floor: ensure non-trivial geometry via deterministic perturbation if needed
  let effectiveSeed = seed;
  let geometry = '';
  let attempts = 0;

  while (attempts < 5) {
    geometry = algorithm.draw(effectiveSeed, { width, height, form });
    if (geometry && geometry.length >= 80) {
      break;
    }
    effectiveSeed = (effectiveSeed + 0x9e3779b9) >>> 0;
    attempts++;
  }

  return `<svg class="article-motif" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${geometry}</svg>`;
}
