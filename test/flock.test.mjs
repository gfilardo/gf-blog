import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlock, stepFlock, visitorAt, WIDTH, HEIGHT } from '../static/js/flock.mjs';

test('flock stays finite, bounded and moving after sustained interaction', () => {
  let birds = createFlock();
  const original = structuredClone(birds);
  for (let i = 0; i < 1800; i++) {
    birds = stepFlock(birds, 1, i / 60, i < 900 ? { x: 300, y: 190 } : null, visitorAt(i / 60));
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


test('visitor crosses the scene, leaves quiet recovery time, and alternates direction', () => {
  assert.equal(visitorAt(4), null);
  assert.ok(visitorAt(5).x < 0);
  assert.ok(visitorAt(13.9).x > WIDTH);
  assert.equal(visitorAt(14), null);
  assert.equal(visitorAt(32), null);
  assert.ok(visitorAt(33).x > WIDTH);
  assert.ok(visitorAt(41.9).x < 0);
});

test('visitor deflects nearby agents without affecting distant ones or permanently changing their traits', () => {
  const birds = createFlock(1);
  Object.assign(birds[0], { x: 300, y: 190, vx: 0, vy: 1 });
  const baseline = stepFlock(birds);
  const nearby = stepFlock(birds, 1, 0, null, { x: 290, y: 190 });
  const distant = stepFlock(birds, 1, 0, null, { x: 0, y: 0 });
  assert.ok(nearby[0].vx > baseline[0].vx);
  assert.deepEqual(distant, baseline);
  assert.equal(nearby[0].speed, birds[0].speed);
  assert.equal(nearby[0].sociability, birds[0].sociability);
});
