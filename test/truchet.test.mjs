import test from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { renderTruchet } from '../src/motif.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const edgeKey = edge => [edge.start.join(','), edge.end.join(',')].sort().join(':');
function geometry(seed, form) {
  const width = form === 'mark' ? 120 : 360;
  const height = form === 'mark' ? 120 : 80;
  const cols = form === 'mark' ? 3 : 15;
  const tile = Math.min(width * 0.94 / cols, height * 0.88 / 3);
  const normalize = ([x, y]) => [Math.round((x - width / 2) * 2 / tile), Math.round((y - height / 2) * 2 / tile)];
  const svg = `<svg>${renderTruchet(seed, { width, height, form })}</svg>`;
  assert.equal(XMLValidator.validate(svg), true);
  const parsed = parser.parse(svg).svg;
  assert.equal(parsed.circle, undefined, 'no floating node dots');
  const paths = parsed.path.filter(p => p.stroke !== 'var(--line)');
  const edges = [];
  for (const path of paths) {
    let point;
    let subpathStart;
    let previous;
    let first;
    const moves = [...path.d.matchAll(/M/g)].length;
    if (form === 'hero' && path.stroke === 'var(--accent)') assert.equal(moves, 1, 'accent is one connected route');
    for (const [, command, args] of path.d.matchAll(/([MAZ])([^MAZ]*)/g)) {
      const values = (args.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      if (command === 'M') {
        point = normalize(values);
        subpathStart = point;
        previous = null;
        first = null;
      } else if (command === 'A') {
        const end = normalize(values.slice(5));
        assert.ok(Math.abs(values[0] - tile / 2) < 0.01 && values[0] === values[1]);
        assert.equal(values[2], 0);
        assert.equal(values[3], 0);
        assert.equal(Math.abs(end[0] - point[0]), 1);
        assert.equal(Math.abs(end[1] - point[1]), 1);
        // The sweep determines which of the two possible circle centers is used.
        const center = [[point[0], end[1]], [end[0], point[1]]].find(([cx, cy]) => {
          const cross = (point[0] - cx) * (end[1] - cy) - (point[1] - cy) * (end[0] - cx);
          return (cross > 0 ? 1 : 0) === values[4];
        });
        assert.ok(center.every(v => Math.abs(v % 2) === 1), 'arc center is a tile corner');
        const sign = values[4] ? 1 : -1;
        const tangent = p => [-sign * (p[1] - center[1]), sign * (p[0] - center[0])];
        const edge = { start: point, end, startTangent: tangent(point), endTangent: tangent(end), stroke: path.stroke };
        if (previous) assert.ok(same(previous.endTangent, edge.startTangent), 'route joins are tangent-continuous');
        first ??= edge;
        previous = edge;
        edges.push(edge);
        point = end;
      } else {
        assert.ok(same(point, subpathStart), 'closed route returns to its start without an extra chord');
        assert.ok(same(previous.endTangent, first.startTangent), 'closed route has a smooth seam');
      }
    }
  }
  return edges;
}

test('Truchet arcs meet smoothly and form complete, non-branching routes', () => {
  for (const seed of [0, 1, 42, 12345, 2147483647, 4294967295]) {
    for (const form of ['hero', 'mark']) {
      const edges = geometry(seed, form);
      assert.equal(edges.length, form === 'hero' ? 90 : 18, 'every tile contributes exactly two arcs');
      assert.equal(new Set(edges.map(edgeKey)).size, edges.length, 'no duplicated arcs');
      const nodes = new Map();
      for (const edge of edges) for (const point of [edge.start, edge.end]) {
        const id = point.join(',');
        nodes.set(id, (nodes.get(id) ?? 0) + 1);
      }
      for (const [key, degree] of nodes) {
        const [x, y] = key.split(',').map(Number);
        const perimeter = Math.abs(x) === (form === 'hero' ? 15 : 3) || Math.abs(y) === 3;
        assert.equal(degree, perimeter ? 1 : 2, 'routes end only at the canvas perimeter');
      }
    }
  }
});

test('Truchet mark is the exact central crop, including accent membership', () => {
  const variants = new Set();
  for (let seed = 0; seed < 32; seed++) {
    const hero = geometry(seed, 'hero').filter(e => Math.abs(Math.round((e.start[0] + e.end[0]) / 4)) <= 1);
    const mark = geometry(seed, 'mark');
    const signature = edges => edges.map(e => `${edgeKey(e)}:${e.stroke}`).sort();
    assert.deepEqual(signature(mark), signature(hero));
    variants.add(signature(mark).join('|'));
  }
  assert.ok(variants.size >= 24, 'coordinate hashing produces varied tilings');
});
