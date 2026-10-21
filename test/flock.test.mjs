import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlock, stepFlock, WIDTH, HEIGHT } from '../static/js/flock.mjs';

test('flock stays finite, bounded and moving after sustained interaction', () => {
  let birds = createFlock();
  const original = structuredClone(birds);
  for (let i = 0; i < 1800; i++) {
    birds = stepFlock(birds, 1, i / 60, i < 900 ? { x: 300, y: 190 } : null);
    for (const bird of birds) {
      assert.ok(Number.isFinite(bird.x + bird.y + bird.vx + bird.vy));
      assert.ok(bird.x >= 0 && bird.x <= WIDTH && bird.y >= 0 && bird.y <= HEIGHT);
      assert.ok(Math.hypot(bird.vx, bird.vy) > .1);
    }
  }
  assert.notDeepEqual(birds, original);
  assert.equal(new Set(birds.map(b => b.speed)).size, birds.length);
});

test('nearby agents separate and updates leave the previous frame untouched', () => {
  const birds = createFlock(2);
  Object.assign(birds[0], { x: 300, y: 190, vx: 0, vy: 1 });
  Object.assign(birds[1], { x: 301, y: 190, vx: 0, vy: 1 });
  const snapshot = structuredClone(birds);
  const next = stepFlock(birds);
  assert.deepEqual(birds, snapshot);
  assert.ok(next[0].vx < 0 && next[1].vx > 0);
});
