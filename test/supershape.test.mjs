import test from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { renderSupershape } from '../src/motif.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
function geometry(seed, bounds) {
  const svg = `<svg>${renderSupershape(seed, bounds)}</svg>`;
  assert.equal(XMLValidator.validate(svg), true);
  assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
  const paths = parser.parse(svg).svg.path;
  return paths.filter(p => /L/.test(p.d)).map(path => ({
    stroke: path.stroke,
    points: [...path.d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m => m.slice(1).map(Number)),
    closed: path.d.endsWith('Z')
  }));
}
const heroBounds = { width: 360, height: 80, form: 'hero' };
const markBounds = { width: 120, height: 120, form: 'mark' };

test('supershape compact mark reproduces every central hero contour and its color', () => {
  for (const seed of [0, 1, 42, 154, 12345, 4294967295]) {
    const hero = geometry(seed, heroBounds);
    const mark = geometry(seed, markBounds);
    assert.equal(hero.length, 11);
    assert.equal(mark.length, 5);
    for (let layer = 0; layer < 5; layer++) {
      const large = hero[layer + 3], small = mark[layer];
      assert.equal(large.stroke, small.stroke);
      assert.equal(large.points.length, small.points.length);
      for (let i = 0; i < large.points.length; i++) {
        for (const axis of [0, 1]) {
          const a = (large.points[i][axis] - (axis ? 40 : 180)) / 32;
          const b = (small.points[i][axis] - 60) / 48;
          assert.ok(Math.abs(a - b) < 0.0004, 'normalized contour geometry agrees');
        }
      }
    }
    const normalized = (shape, cx) => shape.points.map(([x, y]) => [(x - cx) / 32, (y - 40) / 32]);
    assert.notDeepEqual(normalized(hero[0], 64.8), normalized(hero[3], 180), 'left study changes the shape rather than duplicating the center');
    assert.notDeepEqual(normalized(hero[8], 295.2), normalized(hero[3], 180), 'right study changes the shape rather than duplicating the center');
  }
});

test('supershapes have non-circular silhouettes, distinct seeds, and nested contour extents', () => {
  const silhouettes = new Set();
  for (let seed = 0; seed < 64; seed++) {
    const shapes = geometry(seed, markBounds);
    assert.equal(shapes.filter(s => s.stroke === 'var(--accent)').length, 1);
    let previousRadius = Infinity;
    for (const shape of shapes) {
      assert.ok(shape.closed);
      assert.deepEqual(shape.points[0], shape.points.at(-1), 'odd and even symmetry close without a seam chord');
      const radii = shape.points.map(([x, y]) => Math.hypot(x - 60, y - 60));
      const outer = Math.max(...radii);
      assert.ok(outer < previousRadius - 5, 'each layer has a smaller outer extent');
      previousRadius = outer;
    }
    const radii = shapes[0].points.map(([x, y]) => Math.hypot(x - 60, y - 60));
    assert.ok(Math.max(...radii) - Math.min(...radii) > 5, 'outer contour has a visible radial variation');
    silhouettes.add(JSON.stringify(shapes[0].points));
  }
  assert.equal(silhouettes.size, 64);
});

test('supershape contours remain finite and bounded at custom sizes', () => {
  for (const bounds of [heroBounds, markBounds,
    { width: 44, height: 44, form: 'mark' },
    { width: 120, height: 120, form: 'hero' },
    { width: 240, height: 100, form: 'hero' }
  ]) {
    for (const seed of [0, 1, 42, 154, 12345, 4294967295]) {
      const first = renderSupershape(seed, bounds);
      assert.equal(first, renderSupershape(seed, bounds), 'rendering is deterministic');
      for (const shape of geometry(seed, bounds)) for (const [x, y] of shape.points) {
        assert.ok(x >= 0 && x <= bounds.width && y >= 0 && y <= bounds.height);
      }
    }
  }
});
