import test from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { rewriteLSystem, interpretLSystem, renderLSystem } from '../static/js/motif/l-system.mjs';
import { ALGORITHMS, resolveMotifParameters } from '../src/motif.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
function paths(seed, bounds) {
  const svg = `<svg>${renderLSystem(seed, bounds)}</svg>`;
  assert.equal(XMLValidator.validate(svg), true);
  assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
  return [parser.parse(svg).svg.path].flat().map(path => ({
    ...path, points: [...path.d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m => m.slice(1).map(Number))
  }));
}

test('L-system rewriting is parallel, bounded and preserves unchanged symbol identities', () => {
  const result = rewriteLSystem('F', { F: 'F+F' }, 2);
  assert.equal(result.map(t => t.symbol).join(''), 'F+F+F+F');
  const short = rewriteLSystem('X', { X: 'F[+X][-X]' }, 2);
  const longer = rewriteLSystem('X', { X: 'F[+X][-X]' }, 3);
  for (const token of short.filter(t => t.symbol !== 'X')) assert.ok(longer.some(t => t.id === token.id && t.symbol === token.symbol));
  assert.throws(() => rewriteLSystem('X', { X: 'XXXXXXXX' }, 8), /symbol limit/);
  assert.throws(() => rewriteLSystem('X', {}, 9), /iterations/);
});

test('turtle branches restore position, heading, length and parent after popping', () => {
  const tokens = rewriteLSystem('F[+F]F', {}, 0);
  const segments = interpretLSystem(tokens, { angle: Math.PI / 2, shrink: 0.5, variation: 0 });
  const near = (actual, expected) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-10));
  near(segments[0].end, [0, -1]);
  near(segments[1].start, [0, -1]);
  near(segments[1].end, [0.5, -1]);
  near(segments[2].start, [0, -1]);
  near(segments[2].end, [0, -2]);
  assert.equal(segments[1].parent, segments[0].id);
  assert.equal(segments[2].parent, segments[0].id);
  for (const text of ['F]', 'F[+F']) assert.throws(() => interpretLSystem(rewriteLSystem(text, {}, 0), { angle: 0.4 }), /Unbalanced/);
});

test('seeded branch choices and geometry remain stable when additional generations grow', () => {
  const rules = { X: ['F[+X][-X]', 'F[+X]F[-X]'] };
  const options = { seed: 42, angle: 0.5, shrink: 0.72 };
  const earlier = interpretLSystem(rewriteLSystem('X', rules, 3, 42), options);
  const later = interpretLSystem(rewriteLSystem('X', rules, 5, 42), options);
  const byId = new Map(later.map(segment => [segment.id, segment]));
  for (const segment of earlier) assert.deepEqual(byId.get(segment.id), segment);
  assert.ok(later.length > earlier.length);
});

test('compact L-system reproduces the complete central hero tree and connected accent', () => {
  for (const seed of [0, 1, 42, 154, 12345, 4294967295]) {
    const hero = paths(seed, { width: 360, height: 80, form: 'hero' });
    const mark = paths(seed, { width: 120, height: 120, form: 'mark' });
    assert.equal(hero.length, 4);
    assert.equal(mark.length, 2);
    for (const [large, small] of [[hero[1], mark[0]], [hero[2], mark[1]]]) {
      assert.equal(large.stroke, small.stroke);
      assert.equal(large.points.length, small.points.length);
      for (let i = 0; i < large.points.length; i++) for (const axis of [0, 1]) {
        const a = (large.points[i][axis] - (axis ? 40 : 180)) / 65.6;
        const b = (small.points[i][axis] - 60) / 98.4;
        assert.ok(Math.abs(a - b) < 0.0002);
      }
    }
    const accent = mark.find(p => p.stroke === 'var(--accent)');
    assert.equal((accent.d.match(/M/g) ?? []).length, 1, 'accent follows one uninterrupted root-to-tip route');
    assert.ok(accent.points.length >= 3);
  }
});

test('L-system seeds vary structure while staying reproducible and inside each canvas', () => {
  const counts = new Set();
  const variants = new Set();
  for (let seed = 0; seed < 32; seed++) for (const bounds of [
    { width: 360, height: 80, form: 'hero' },
    { width: 120, height: 120, form: 'mark' },
    { width: 44, height: 44, form: 'mark' },
    { width: 240, height: 100, form: 'hero' }
  ]) {
    const svg = renderLSystem(seed, bounds);
    assert.equal(svg, renderLSystem(seed, bounds));
    assert.ok(svg.length < 30000);
    const figures = paths(seed, bounds);
    assert.equal(figures.filter(p => p.stroke === 'var(--accent)').length, 1);
    for (const path of figures) for (const [x, y] of path.points) assert.ok(x >= 0 && x <= bounds.width && y >= 0 && y <= bounds.height);
    if (bounds.width === 120) {
      counts.add(figures.reduce((sum, p) => sum + p.points.length, 0));
      variants.add(svg);
    }
  }
  assert.ok(counts.size > 8, 'seed choices change branch counts as well as angles');
  assert.equal(variants.size, 32);
});

test('L-systems activate one month after contour maps, on February 4, 2027', () => {
  assert.equal(ALGORITHMS.find(a => a.id === 'contours').since, '2027-01-04');
  assert.equal(ALGORITHMS.find(a => a.id === 'l-system').since, '2027-02-04');
  const previous = ALGORITHMS.filter(a => a.id !== 'l-system');
  let available = false;
  for (let i = 0; i < 100; i++) {
    const doc = { slug: `l-system-release-${i}`, date: '2027-02-03' };
    assert.equal(resolveMotifParameters(doc).algorithm.id, resolveMotifParameters(doc, previous).algorithm.id);
    if (resolveMotifParameters({ ...doc, date: '2027-02-04' }).algorithm.id === 'l-system') available = true;
  }
  assert.ok(available);
  assert.equal(resolveMotifParameters({ slug: 'preview', date: '2026-11-04', motif: 'l-system' }).algorithm.id, 'l-system');
});
