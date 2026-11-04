import test from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { createChordDiagram, renderChords } from '../static/js/motif/chords.mjs';
import { ALGORITHMS, resolveMotifParameters } from '../src/motif.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
function geometry(seed, bounds) {
  const svg = `<svg>${renderChords(seed, bounds)}</svg>`;
  assert.equal(XMLValidator.validate(svg), true);
  assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
  const parsed = parser.parse(svg).svg;
  return {
    rings: [parsed.circle].flat(),
    paths: [parsed.path].flat().map(path => ({
      ...path, points: [...path.d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m => m.slice(1).map(Number))
    }))
  };
}

test('modular chords follow multiplication, omit fixed points and deduplicate reverse edges', () => {
  const model = createChordDiagram(12, 2);
  assert.deepEqual(model.next, [0, 2, 4, 6, 8, 10, 0, 2, 4, 6, 8, 10]);
  assert.equal(model.edges.length, 10);
  const keys = new Set();
  for (const [a, b] of model.edges) {
    assert.notEqual(a, b);
    assert.equal(b, (a * 2) % 12);
    keys.add([a, b].sort((a, b) => a - b).join(','));
  }
  assert.equal(keys.size, model.edges.length);
  assert.equal(model.edges.filter(([a, b]) => [a, b].sort().join(',') === '4,8').length, 1);
  assert.equal(createChordDiagram(12, 2, -1).next[1], 1, 'negative offsets wrap into the same modular domain');
  assert.throws(() => createChordDiagram(2, 2), /count/);
  assert.throws(() => createChordDiagram(12, 1), /multiplier/);
  assert.throws(() => createChordDiagram(12, 11), /multiplier/);
  assert.throws(() => createChordDiagram(12, 2, 0.5), /offset/);
});

test('chord compact marks reproduce the central hero graph and accented walk', () => {
  for (const seed of [0, 1, 42, 154, 12345, 4294967295]) {
    const hero = geometry(seed, { width: 360, height: 80, form: 'hero' });
    const mark = geometry(seed, { width: 120, height: 120, form: 'mark' });
    assert.equal(hero.paths.length, 4);
    assert.equal(mark.paths.length, 2);
    for (const [large, small] of [[hero.paths[1], mark.paths[0]], [hero.paths[2], mark.paths[1]]]) {
      assert.equal(large.stroke, small.stroke);
      assert.equal(large.points.length, small.points.length);
      for (let i = 0; i < large.points.length; i++) for (const axis of [0, 1]) {
        const a = (large.points[i][axis] - (axis ? 40 : 180)) / 32;
        const b = (small.points[i][axis] - 60) / 48;
        assert.ok(Math.abs(a - b) < 0.0004);
      }
    }
    const accent = mark.paths.find(p => p.stroke === 'var(--accent)');
    assert.equal((accent.d.match(/M/g) ?? []).length, 1);
    assert.ok(accent.points.length >= 4 && accent.points.length <= 9, 'accent is a bounded connected walk');
    assert.ok(mark.paths[0].points.length > 10, 'unaccented structure remains visible');
  }
});

test('seeded chord graphs stay varied, finite, bounded, and free of duplicate lines', () => {
  const variants = new Set();
  for (let seed = 0; seed < 64; seed++) for (const bounds of [
    { width: 360, height: 80, form: 'hero' },
    { width: 120, height: 120, form: 'mark' },
    { width: 44, height: 44, form: 'mark' },
    { width: 240, height: 100, form: 'hero' }
  ]) {
    const svg = renderChords(seed, bounds);
    assert.equal(svg, renderChords(seed, bounds));
    assert.ok(svg.length < 15000);
    const { paths, rings } = geometry(seed, bounds);
    assert.equal(paths.filter(p => p.stroke === 'var(--accent)').length, 1);
    for (const ring of rings) {
      assert.ok(ring.cx - ring.r >= 0 && Number(ring.cx) + Number(ring.r) <= bounds.width);
      assert.ok(ring.cy - ring.r >= 0 && Number(ring.cy) + Number(ring.r) <= bounds.height);
    }
    for (const path of paths) for (const [x, y] of path.points) assert.ok(x >= 0 && x <= bounds.width && y >= 0 && y <= bounds.height);
    if (bounds.width === 120) {
      variants.add(svg);
      const edges = [];
      const plain = paths[0].points;
      for (let i = 0; i < plain.length; i += 2) edges.push([plain[i], plain[i + 1]]);
      const accent = paths[1].points;
      for (let i = 1; i < accent.length; i++) edges.push([accent[i - 1], accent[i]]);
      const key = edge => edge.map(p => p.join(',')).sort().join(':');
      assert.equal(new Set(edges.map(key)).size, edges.length);
      assert.ok(edges.length >= 19 && edges.length <= 60, 'line count avoids shallow or excessively dense diagrams');
    }
  }
  assert.equal(variants.size, 64);
});

test('chords activate in the March 4, 2027 epoch and remain available for manual preview', () => {
  assert.equal(ALGORITHMS.find(a => a.id === 'chords').since, '2027-03-04');
  const previous = ALGORITHMS.filter(a => a.id !== 'chords');
  let available = false;
  for (let i = 0; i < 100; i++) {
    const doc = { slug: `chord-release-${i}`, date: '2027-03-03' };
    assert.equal(resolveMotifParameters(doc).algorithm.id, resolveMotifParameters(doc, previous).algorithm.id);
    if (resolveMotifParameters({ ...doc, date: '2027-03-04' }).algorithm.id === 'chords') available = true;
  }
  assert.ok(available);
  assert.equal(resolveMotifParameters({ slug: 'preview', date: '2026-11-04', motif: 'chords' }).algorithm.id, 'chords');
});
