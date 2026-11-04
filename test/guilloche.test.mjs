import test from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { renderGuilloche } from '../src/motif.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
function geometry(seed, bounds) {
  const svg = `<svg>${renderGuilloche(seed, bounds)}</svg>`;
  assert.equal(XMLValidator.validate(svg), true);
  return parser.parse(svg).svg;
}
function curves(svg) {
  return [svg.path].flat().map(path => {
    const start = path.d.match(/^M([\d.]+),([\d.]+)/).slice(1).map(Number);
    const segments = [...path.d.matchAll(/C([^CZ]+)/g)].map(m => m[1].match(/-?\d+(?:\.\d+)?/g).map(Number));
    return { ...path, start, segments };
  });
}
function bezier(start, values, t) {
  const a = 1 - t;
  return [0, 1].map(axis => a ** 3 * start[axis] + 3 * a * a * t * values[axis]
    + 3 * a * t * t * values[axis + 2] + t ** 3 * values[axis + 4]);
}

test('guilloché compact dial reproduces the central hero geometry and accents', () => {
  for (const seed of [0, 1, 42, 154, 12345, 4294967295]) {
    const hero = geometry(seed, { width: 360, height: 80, form: 'hero' });
    const mark = geometry(seed, { width: 120, height: 120, form: 'mark' });
    const center = curves(hero).find(p => p.stroke === 'var(--accent)');
    const compact = curves(mark)[0];
    assert.equal(compact.stroke, center.stroke);
    assert.equal(compact.segments.length, center.segments.length);
    const normalized = (curve, cx, cy, radius) => [curve.start, ...curve.segments]
      .flatMap(values => values.map((value, i) => (value - (i % 2 ? cy : cx)) / radius));
    const large = normalized(center, 180, 40, 32);
    const small = normalized(compact, 60, 60, 50.4);
    for (let i = 0; i < large.length; i++) assert.ok(Math.abs(large[i] - small[i]) < 0.0004);
    const heroDot = hero.circle.find(c => c.fill === 'var(--accent)');
    const markDot = mark.circle.find(c => c.fill === 'var(--accent)');
    assert.ok(Math.abs(Number(heroDot.r) / 32 - Number(markDot.r) / 50.4) < 0.0004);
    assert.equal(mark.circle.filter(c => c.stroke === 'var(--line)').length, 1);
  }
});

test('guilloché avoids collapsed dials, including the former seed 154 regression', () => {
  for (const seed of [154, ...Array.from({ length: 64 }, (_, i) => i)]) {
    const parsed = geometry(seed, { width: 360, height: 80, form: 'hero' });
    for (const curve of curves(parsed)) {
      const points = curve.segments.map(values => values.slice(-2));
      const mean = [0, 1].map(axis => points.reduce((sum, p) => sum + p[axis], 0) / points.length);
      const covariance = (a, b) => points.reduce((sum, p) => sum + (p[a] - mean[a]) * (p[b] - mean[b]), 0) / points.length;
      const xx = covariance(0, 0), yy = covariance(1, 1), xy = covariance(0, 1);
      assert.ok((xx * yy - xy * xy) / (xx * yy) > 0.9, 'curve spans two dimensions rather than collapsing into a diagonal');
    }
  }
});

test('guilloché cubic interpolation follows the analytic high-frequency curve and closes smoothly', () => {
  // Seed 12345 selects (7,11); this phase is captured from its stable PRNG stream.
  const phase = 3.0423523901887672 + 1.25;
  const curve = curves(geometry(12345, { width: 120, height: 120, form: 'mark' }))[0];
  const radius = 50.4;
  const h = 2 * Math.PI / curve.segments.length;
  let start = curve.start;
  for (const [index, values] of curve.segments.entries()) {
    for (const fraction of [0.25, 0.5, 0.75]) {
      const t = (index + fraction) * h;
      const expected = [60 + radius * 0.85 * Math.sin(7 * t + phase), 60 + radius * 0.85 * Math.cos(11 * t)];
      const actual = bezier(start, values, fraction);
      assert.ok(Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 0.045, 'Bézier error stays below 0.045 coordinate units including rounding');
    }
    start = values.slice(-2);
  }
  assert.deepEqual(start, curve.start, 'periodic curve closes exactly');
  const first = curve.segments[0], last = curve.segments.at(-1);
  for (const axis of [0, 1]) assert.ok(Math.abs((first[axis] - curve.start[axis]) - (last[axis + 4] - last[axis + 2])) < 0.02, 'tangents match across the closed seam');
});

test('guilloché honors explicit form and keeps Bézier controls inside custom canvases', () => {
  for (const bounds of [
    { width: 120, height: 120, form: 'hero' },
    { width: 44, height: 44, form: 'mark' },
    { width: 240, height: 100, form: 'hero' },
    { width: 600, height: 300, form: 'mark' }
  ]) {
    const parsed = geometry(12345, bounds);
    const paths = curves(parsed);
    assert.equal(paths.length, bounds.form === 'hero' ? 3 : 1);
    for (const curve of paths) for (const values of [curve.start, ...curve.segments]) {
      for (let i = 0; i < values.length; i += 2) {
        assert.ok(values[i] >= 0 && values[i] <= bounds.width);
        assert.ok(values[i + 1] >= 0 && values[i + 1] <= bounds.height);
      }
    }
  }
});
