import test from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { createCirclePacking, circleArcsInStrip, renderCirclePacking } from '../static/js/motif/circle-packing.mjs';
import { ALGORITHMS, resolveMotifParameters } from '../src/motif.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
function geometry(seed, bounds) {
  const svg = `<svg>${renderCirclePacking(seed, bounds)}</svg>`;
  assert.equal(XMLValidator.validate(svg), true);
  assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
  const parsed = parser.parse(svg).svg;
  return { circles: [parsed.circle ?? []].flat(), paths: [parsed.path ?? []].flat() };
}

test('circle packing is reproducible, bounded and non-overlapping with drafting gaps', () => {
  const counts = new Set();
  for (let seed = 0; seed < 64; seed++) {
    const model = createCirclePacking(seed);
    assert.deepEqual(model, createCirclePacking(seed));
    assert.ok(model.circles.length >= 20 && model.circles.length <= 64);
    counts.add(model.circles.length);
    assert.ok(Math.abs(model.focal.x) + model.focal.r < 0.5);
    assert.ok(Math.abs(model.focal.y) + model.focal.r < 0.5);
    for (const c of model.circles) {
      const boundaryDistance = model.boundaryRadius - Math.hypot(Math.max(Math.abs(c.x) - model.halfLine, 0), c.y);
      assert.ok(c.r >= model.minimumRadius);
      assert.ok(c.r <= boundaryDistance + 1e-9, 'circle fits inside the capsule');
      assert.ok(Math.abs(c.x) + c.r <= 2.25 && Math.abs(c.y) + c.r <= 0.5);
    }
    for (let i = 0; i < model.circles.length; i++) for (let j = i + 1; j < model.circles.length; j++) {
      const a = model.circles[i], b = model.circles[j];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) + 1e-9 >= a.r + b.r + model.gap);
    }
  }
  assert.ok(counts.size >= 10, 'seeds change composition and packing density');
});

test('circle cropping computes exact visible arcs without closing chords', () => {
  const circle = { x: 0, y: 0, r: 1 };
  const arcs = circleArcsInStrip(circle, -0.5, 0.5);
  assert.equal(arcs.length, 2);
  const expected = [[Math.PI / 3, 2 * Math.PI / 3], [4 * Math.PI / 3, 5 * Math.PI / 3]];
  arcs.forEach((arc, i) => arc.forEach((angle, j) => assert.ok(Math.abs(angle - expected[i][j]) < 1e-9)));
  assert.deepEqual(circleArcsInStrip(circle, -2, 2), [[0, Math.PI * 2]]);
  assert.deepEqual(circleArcsInStrip({ x: 3, y: 0, r: 1 }, -0.5, 0.5), []);
  const half = circleArcsInStrip(circle, 0, 2);
  assert.equal(half.length, 1, 'intervals join across the angular seam');
  assert.ok(Math.abs(half[0][1] - half[0][0] - Math.PI) < 1e-9);
});

test('compact packing preserves hero circles, partial boundary circles and accent identity', () => {
  for (const seed of [0, 1, 42, 154, 12345, 4294967295]) {
    const hero = geometry(seed, { width: 360, height: 80, form: 'hero' });
    const mark = geometry(seed, { width: 120, height: 120, form: 'mark' });
    const normalized = hero.circles.map(c => ({ x: (Number(c.cx) - 180) / 70.4, y: (Number(c.cy) - 40) / 70.4, r: Number(c.r) / 70.4, stroke: c.stroke, fill: c.fill }));
    for (const circle of mark.circles) {
      const x = (Number(circle.cx) - 60) / 105.6, y = (Number(circle.cy) - 60) / 105.6, r = Number(circle.r) / 105.6;
      assert.ok(normalized.some(c => c.stroke === circle.stroke && c.fill === circle.fill && Math.hypot(c.x - x, c.y - y) < 0.0003 && Math.abs(c.r - r) < 0.0002));
    }
    assert.equal(mark.circles.filter(c => c.stroke === 'var(--accent)').length, 1);
    assert.ok(mark.paths.length > 0, 'cross-boundary circles are retained as arcs');
    for (const path of mark.paths) {
      assert.doesNotMatch(path.d, /[LZ]/, 'cropped circles never acquire straight closing chords');
      for (const m of path.d.matchAll(/M([\d.]+),([\d.]+)A([\d.]+),[\d.]+ 0 [01],1 ([\d.]+),([\d.]+)/g)) {
        const start = [(+m[1] - 60) / 105.6, (+m[2] - 60) / 105.6];
        const end = [(+m[4] - 60) / 105.6, (+m[5] - 60) / 105.6];
        const radius = +m[3] / 105.6;
        assert.ok(Math.abs(Math.abs(start[0]) - 0.5) < 0.0002 && Math.abs(Math.abs(end[0]) - 0.5) < 0.0002);
        assert.ok(normalized.some(c => c.stroke === path.stroke && c.fill === path.fill && Math.abs(c.r - radius) < 0.0002
          && Math.abs(Math.hypot(start[0] - c.x, start[1] - c.y) - c.r) < 0.0003
          && Math.abs(Math.hypot(end[0] - c.x, end[1] - c.y) - c.r) < 0.0003));
      }
    }
  }
});

test('circle packing SVG remains finite, compact and inside custom canvases', () => {
  for (let seed = 0; seed < 16; seed++) for (const bounds of [
    { width: 360, height: 80, form: 'hero' },
    { width: 120, height: 120, form: 'mark' },
    { width: 44, height: 44, form: 'mark' },
    { width: 240, height: 100, form: 'hero' }
  ]) {
    const svg = renderCirclePacking(seed, bounds);
    assert.equal(svg, renderCirclePacking(seed, bounds));
    assert.ok(svg.length < 14000);
    assert.equal((svg.match(/stroke="var\(--accent\)"/g) ?? []).length, 1);
    const { circles, paths } = geometry(seed, bounds);
    for (const c of circles) {
      assert.ok(c.cx - c.r >= 0 && Number(c.cx) + Number(c.r) <= bounds.width);
      assert.ok(c.cy - c.r >= 0 && Number(c.cy) + Number(c.r) <= bounds.height);
    }
    for (const path of paths) for (const m of path.d.matchAll(/(?:M|,1 )([\d.]+),([\d.]+)/g)) assert.ok(+m[1] >= 0 && +m[1] <= bounds.width && +m[2] >= 0 && +m[2] <= bounds.height);
  }
});

test('circle packing activates on April 4, 2027 and is available for manual preview', () => {
  assert.equal(ALGORITHMS.find(a => a.id === 'circle-packing').since, '2027-04-04');
  const previous = ALGORITHMS.filter(a => a.id !== 'circle-packing');
  let available = false;
  for (let i = 0; i < 100; i++) {
    const doc = { slug: `packing-release-${i}`, date: '2027-04-03' };
    assert.equal(resolveMotifParameters(doc).algorithm.id, resolveMotifParameters(doc, previous).algorithm.id);
    if (resolveMotifParameters({ ...doc, date: '2027-04-04' }).algorithm.id === 'circle-packing') available = true;
  }
  assert.ok(available);
  assert.equal(resolveMotifParameters({ slug: 'preview', date: '2026-11-04', motif: 'circle-packing' }).algorithm.id, 'circle-packing');
});

test('circle packing mixes neutral paint independently of circle size', () => {
  const smallStrokes = new Set();
  const fills = new Set();
  const sizeBands = new Set();
  for (const seed of [0, 1, 42, 154, 12345, 4294967295]) {
    const model = createCirclePacking(seed);
    const ordinary = model.circles.filter(circle => circle !== model.focal);
    assert.ok(ordinary.some(circle => circle.fill !== 'none'), 'neutral circles can be filled too');
    assert.ok(ordinary.some(circle => circle.fill === 'none'), 'negative space remains among the fills');
    for (const circle of ordinary) {
      assert.ok(['var(--line)', 'var(--muted)', 'var(--ink)'].includes(circle.stroke));
      assert.ok(['none', 'var(--surface)', 'var(--line)', 'var(--muted)'].includes(circle.fill));
      fills.add(circle.fill);
      if (circle.r < 0.08) smallStrokes.add(circle.stroke);
      if (circle.r < 0.14) sizeBands.add(Math.floor(circle.r * 100));
    }
  }
  assert.equal(smallStrokes.size, 3, 'small circles no longer all use the faintest stroke');
  assert.equal(fills.size, 4);
  assert.ok(sizeBands.size >= 8, 'small and medium circles use a broad radius range');
});
