import test from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { marchingSquares, renderContours } from '../static/js/motif/contours.mjs';
import { ALGORITHMS, resolveMotifParameters } from '../src/motif.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
function geometry(seed, bounds) {
  const svg = `<svg>${renderContours(seed, bounds)}</svg>`;
  assert.equal(XMLValidator.validate(svg), true);
  assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
  return [parser.parse(svg).svg.path].flat().map(path => ({
    stroke: path.stroke,
    points: [...path.d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m => m.slice(1).map(Number))
  }));
}

test('marching squares joins a planar isoline and closes an isolated hill', () => {
  const plane = Array.from({ length: 5 }, () => [0, 1, 2, 3, 4]);
  const routes = marchingSquares(plane, 2.25);
  assert.equal(routes.length, 1);
  assert.equal(routes[0].closed, false);
  assert.equal(routes[0].points.length, 5);
  assert.ok(routes[0].points.every(([x]) => x === 2.25));
  assert.deepEqual(new Set([routes[0].points[0][1], routes[0].points.at(-1)[1]]), new Set([0, 4]));
  const hill = Array.from({ length: 7 }, (_, y) => Array.from({ length: 7 }, (_, x) => 9 - (x - 3) ** 2 - (y - 3) ** 2));
  const loops = marchingSquares(hill, 4.5);
  assert.equal(loops.length, 1);
  assert.equal(loops[0].closed, true);
  assert.deepEqual(loops[0].points[0], loops[0].points.at(-1));
  for (const [x, y] of loops[0].points) assert.ok(Math.abs((x - 3) ** 2 + (y - 3) ** 2 - 4.5) <= 0.25);
  assert.deepEqual(marchingSquares([[0, 0], [0, 0]], 0), []);
});

test('marching squares resolves saddle topology by field strength with stable ties', () => {
  const side = ([x, y]) => y === 0 ? 0 : x === 1 ? 1 : y === 1 ? 2 : 3;
  for (const [grid, expected] of [
    [[[2, -1], [-1, 2]], ['0,1', '2,3']],
    [[[1, -2], [-2, 1]], ['0,3', '1,2']],
    [[[1, -1], [-1, 1]], ['0,1', '2,3']]
  ]) {
    const routes = marchingSquares(grid, 0);
    assert.ok(routes.every(route => !route.closed && route.points.length === 2));
    const actual = routes.map(route => route.points.map(side).sort().join(',')).sort();
    assert.deepEqual(actual, expected);
  }
});

test('contour marks crop the same terrain and accented component as the hero', () => {
  for (const seed of [0, 1, 42, 154, 12345, 4294967295]) {
    const hero = geometry(seed, { width: 360, height: 80, form: 'hero' });
    const mark = geometry(seed, { width: 120, height: 120, form: 'mark' });
    const normalizedHero = hero.flatMap(path => path.points.map(([x, y]) => ({
      x: (x - 180) / 70.4, y: (y - 40) / 70.4, stroke: path.stroke
    })));
    let shared = 0;
    for (const path of mark) for (const [px, py] of path.points) {
      const x = (px - 60) / 105.6, y = (py - 60) / 105.6;
      if (Math.abs(x) >= 0.499) continue; // Newly interpolated crop-boundary endpoints.
      assert.ok(normalizedHero.some(p => p.stroke === path.stroke && Math.hypot(p.x - x, p.y - y) < 0.0003));
      shared++;
    }
    assert.ok(shared > 50, 'the crop retains substantial shared terrain');
    assert.equal(mark.filter(p => p.stroke === 'var(--accent)').length, 1);
  }
});

test('contours stay substantial, finite, bounded and reproducible across sizes and seeds', () => {
  for (let seed = 0; seed < 16; seed++) for (const bounds of [
    { width: 360, height: 80, form: 'hero' },
    { width: 120, height: 120, form: 'mark' },
    { width: 44, height: 44, form: 'mark' },
    { width: 240, height: 100, form: 'hero' }
  ]) {
    const svg = renderContours(seed, bounds);
    assert.equal(svg, renderContours(seed, bounds));
    assert.ok(svg.length < 60000, 'output complexity is bounded');
    const paths = geometry(seed, bounds);
    assert.ok(paths.length >= 4);
    assert.equal(paths.filter(p => p.stroke === 'var(--accent)').length, 1);
    for (const path of paths) for (const [x, y] of path.points) assert.ok(x >= 0 && x <= bounds.width && y >= 0 && y <= bounds.height);
  }
});

test('contours activate on January 4, 2027, while explicit overrides and drafts can preview them', () => {
  assert.equal(ALGORITHMS.find(a => a.id === 'contours').since, '2027-01-04');
  const previous = ALGORITHMS.filter(a => a.id !== 'contours');
  let released = false;
  for (let i = 0; i < 100; i++) {
    const doc = { slug: `release-${i}`, date: '2027-01-03' };
    assert.equal(resolveMotifParameters(doc).algorithm.id, resolveMotifParameters(doc, previous).algorithm.id);
    if (resolveMotifParameters({ ...doc, date: '2027-01-04' }).algorithm.id === 'contours') released = true;
  }
  assert.ok(released);
  assert.equal(resolveMotifParameters({ slug: 'override', date: '2026-11-04', motif: 'contours' }).algorithm.id, 'contours');
  assert.ok(Array.from({ length: 100 }, (_, i) => resolveMotifParameters({ slug: `draft-${i}`, draft: true })).some(p => p.algorithm.id === 'contours'));
});

test('contour panoramas consist of enclosed terrain islands and summit markers', () => {
  for (let seed = 0; seed < 16; seed++) {
    const svg = `<svg>${renderContours(seed, { width: 360, height: 80, form: 'hero' })}</svg>`;
    const paths = parser.parse(svg).svg.path;
    const contours = paths.filter(path => path['data-contour-detail'] !== 'summits');
    assert.ok(contours.every(path => path.d.endsWith('Z')), 'terrain isolines close instead of forming open streamlines');
    const markers = paths.filter(path => path['data-contour-detail'] === 'summits');
    assert.equal(markers.length, 1);
    assert.ok((markers[0].d.match(/M/g) ?? []).length >= 4, 'several actual terrain summits are marked');
  }
});
