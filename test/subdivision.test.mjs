import test from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { createSubdivision, renderSubdivision } from '../static/js/motif/subdivision.mjs';
import { ALGORITHMS } from '../src/motif.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
function geometry(seed, form) {
  const width = form === 'hero' ? 360 : 120;
  const height = form === 'hero' ? 80 : 120;
  const scale = form === 'hero' ? 64 : 100.8;
  const svg = `<svg>${renderSubdivision(seed, { width, height, form })}</svg>`;
  assert.equal(XMLValidator.validate(svg), true);
  const parsed = parser.parse(svg).svg;
  assert.equal(parsed.circle, undefined, 'no unrelated floating coordinate marker');
  const normalized = ([x, y]) => [Math.round((x - width / 2) / scale * 24), Math.round((y - height / 2) / scale * 24)];
  const paths = [parsed.path].flat();
  const rules = paths.slice(0, -1).flatMap(path => [...path.d.matchAll(/M([\d.]+),([\d.]+)L([\d.]+),([\d.]+)/g)]
    .map(m => ({ start: normalized(m.slice(1, 3).map(Number)), end: normalized(m.slice(3).map(Number)), stroke: path.stroke })));
  const room = parsed.rect.find(rect => rect.stroke === 'var(--accent)');
  const fill = parsed.rect.find(rect => rect.fill === 'var(--surface)');
  for (const attr of ['x', 'y', 'width', 'height']) assert.equal(room[attr], fill[attr], 'accent and fill describe the same focal room');
  return { rules, room: [...normalized([Number(room.x), Number(room.y)]), Math.round(Number(room.width) / scale * 24), Math.round(Number(room.height) / scale * 24)] };
}

test('subdivision partitions a canonical plan without gaps, overlaps, or tiny rooms', () => {
  const counts = new Set();
  const focalPositions = new Set();
  for (let seed = 0; seed < 64; seed++) {
    const model = createSubdivision(seed);
    assert.deepEqual(model, createSubdivision(seed));
    counts.add(model.leaves.length);
    focalPositions.add(`${model.focal.x},${model.focal.y}`);
    assert.ok(Math.abs(model.leaves.reduce((sum, room) => sum + room.w * room.h, 0) - 4.5) < 1e-9);
    assert.ok(model.focal.id.startsWith('center'));
    assert.ok(model.focal.x >= -0.5 && model.focal.x + model.focal.w <= 0.5 + 1e-9);
    for (const room of model.leaves) {
      assert.ok(room.w >= 1 / 6 - 1e-9 && room.h >= 1 / 6 - 1e-9);
      assert.ok(Math.min(room.w, room.h) * 44 * 0.84 >= 6, 'rooms remain at least six pixels wide in the actual list mark');
      assert.ok(room.x >= -2.25 && room.x + room.w <= 2.25 + 1e-9);
      assert.ok(room.y >= -0.5 && room.y + room.h <= 0.5 + 1e-9);
    }
    for (let i = 0; i < model.leaves.length; i++) for (let j = i + 1; j < model.leaves.length; j++) {
      const a = model.leaves[i], b = model.leaves[j];
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      assert.ok(overlapX < 1e-9 || overlapY < 1e-9);
    }
  }
  assert.ok(counts.size >= 8, 'seeds change partition counts and hierarchy');
  assert.ok(focalPositions.size > 12);
});

test('subdivision compact mark matches the central hero partitions and focal room', () => {
  const key = rule => `${rule.start.join(',')}:${rule.end.join(',')}:${rule.stroke}`;
  for (const seed of [0, 1, 42, 154, 12345, 4294967295]) {
    const hero = geometry(seed, 'hero');
    const mark = geometry(seed, 'mark');
    const crop = hero.rules.flatMap(rule => {
      const [x1, y1] = rule.start, [x2, y2] = rule.end;
      if (x1 === x2) return Math.abs(x1) <= 12 ? [rule] : [];
      const start = Math.max(-12, x1), end = Math.min(12, x2);
      return end > start ? [{ ...rule, start: [start, y1], end: [end, y2] }] : [];
    });
    assert.deepEqual(mark.rules.map(key).sort(), crop.map(key).sort());
    assert.deepEqual(mark.room, hero.room);
    assert.equal(new Set(mark.rules.map(key)).size, mark.rules.length);
    const [x, y, w, h] = mark.room;
    for (const rule of mark.rules) {
      const [x1, y1] = rule.start, [x2, y2] = rule.end;
      if (x1 === x2 && (x1 === x || x1 === x + w)) assert.ok(Math.min(y2, y + h) <= Math.max(y1, y), 'accent vertical boundary is not double-stroked');
      if (y1 === y2 && (y1 === y || y1 === y + h)) assert.ok(Math.min(x2, x + w) <= Math.max(x1, x), 'accent horizontal boundary is not double-stroked');
    }
  }
});

test('subdivision SVG is finite, bounded and stable across seeds and canvas sizes', () => {
  assert.equal(ALGORITHMS.find(a => a.id === 'subdivision').since, '2026-01-01');
  for (let seed = 0; seed < 32; seed++) for (const bounds of [
    { width: 360, height: 80, form: 'hero' },
    { width: 120, height: 120, form: 'mark' },
    { width: 44, height: 44, form: 'mark' },
    { width: 240, height: 100, form: 'hero' }
  ]) {
    const svg = renderSubdivision(seed, bounds);
    assert.equal(svg, renderSubdivision(seed, bounds));
    assert.equal(XMLValidator.validate(`<svg>${svg}</svg>`), true);
    assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
    assert.equal((svg.match(/stroke="var\(--accent\)"/g) ?? []).length, 1);
    assert.ok(svg.length < 6000);
    for (const match of svg.matchAll(/[ML]([\d.]+),([\d.]+)/g)) assert.ok(+match[1] >= 0 && +match[1] <= bounds.width && +match[2] >= 0 && +match[2] <= bounds.height);
    const parsed = parser.parse(`<svg>${svg}</svg>`).svg;
    for (const rect of parsed.rect) {
      assert.ok(Number(rect.x) + Number(rect.width) <= bounds.width);
      assert.ok(Number(rect.y) + Number(rect.height) <= bounds.height);
    }
  }
});
