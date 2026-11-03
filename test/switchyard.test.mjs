import test from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser } from 'fast-xml-parser';
import { renderSwitchyard } from '../src/motif.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
function geometry(seed, form) {
  const width = form === 'mark' ? 120 : 360;
  const height = form === 'mark' ? 120 : 80;
  const cols = form === 'mark' ? 3 : 15;
  const tile = Math.min(width * 0.94 / cols, height * 0.88 / 3);
  const point = (x, y) => [Math.round((x - width / 2) / tile * 2) / 2,
    Math.round((y - height / 2) / tile * 2) / 2];
  const svg = parser.parse(`<svg>${renderSwitchyard(seed, { width, height, form })}</svg>`).svg;
  const tracks = [];
  for (const path of svg.path.filter(p => p.stroke !== 'var(--line)')) {
    for (const [, x, y, command, args] of path.d.matchAll(/M([\d.]+),([\d.]+)([AL])([^M]*)/g)) {
      const values = args.match(/-?\d+(?:\.\d+)?/g).map(Number);
      const start = point(+x, +y);
      const end = point(...values.slice(-2));
      const col = Math.round((start[0] + end[0]) / 2) || 0;
      const row = Math.round((start[1] + end[1]) / 2) || 0;
      tracks.push({ start, end, col, row, command, sweep: command === 'A' ? values[4] : null, stroke: path.stroke });
    }
  }
  const dots = [svg.circle ?? []].flat().map(c => ({
    position: point(Number(c.cx), Number(c.cy)),
    radius: Number(c.r) / tile,
    fill: c.fill
  }));
  return { tracks, dots };
}
const signature = track => JSON.stringify(track);

test('Switchyard preserves the central crop, including crossings, curves, dots and accents', () => {
  const variants = new Set();
  for (let seed = 0; seed < 32; seed++) {
    const hero = geometry(seed, 'hero');
    const mark = geometry(seed, 'mark');
    const centralTracks = hero.tracks.filter(t => Math.abs(t.col) <= 1);
    assert.deepEqual(mark.tracks.map(signature).sort(), centralTracks.map(signature).sort());
    assert.equal(hero.tracks.length, 90);
    assert.equal(mark.tracks.length, 18);
    assert.ok(hero.tracks.some(t => t.command === 'L'), 'straight crossings are retained');
    assert.ok(hero.tracks.some(t => t.command === 'A'), 'curved tiles are retained');
    const centralDots = hero.dots.filter(d => Math.abs(d.position[0]) <= 1);
    assert.equal(mark.dots.length, centralDots.length);
    for (let i = 0; i < mark.dots.length; i++) {
      assert.deepEqual(mark.dots[i].position, centralDots[i].position);
      assert.equal(mark.dots[i].fill, centralDots[i].fill);
      assert.ok(Math.abs(mark.dots[i].radius - centralDots[i].radius) < 0.001, 'relative dot sizes agree');
    }
    const focal = mark.tracks.filter(t => t.stroke === 'var(--accent)');
    assert.equal(focal.length, 1);
    const dot = mark.dots.find(d => d.fill === 'var(--accent)');
    assert.deepEqual(dot.position, [focal[0].col, focal[0].row]);
    variants.add(mark.tracks.map(signature).join('|'));
  }
  assert.ok(variants.size >= 24, 'seeds produce distinct geometry');
});
