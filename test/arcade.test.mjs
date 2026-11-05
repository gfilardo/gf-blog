import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENE, photoPoint, viewSpan, walkingDistance } from '../static/js/arcade-geometry.mjs';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} differs from ${b}`);

test('the walk starts at the original photograph and keeps its vanishing point fixed', () => {
  for (const point of [[0, 0], [.2, .4], [.8, .1], [.1, .9], [1, 1], [.32, .718]]) {
    photoPoint(point, 0).forEach((value, axis) => close(value, point[axis]));
  }
  for (const travel of [0, 3, 10, 18]) {
    photoPoint([SCENE.vanishingX, SCENE.horizon], travel).forEach((value, axis) => close(value, [SCENE.vanishingX, SCENE.horizon][axis]));
  }
});

test('forward travel has depth parallax instead of uniformly enlarging the photo', () => {
  // Points along one wall: the nearer point moves proportionally more.
  const far = [.45, SCENE.horizon], near = [.9, SCENE.horizon];
  const scale = point => (photoPoint(point, 8)[0] - SCENE.vanishingX) / (point[0] - SCENE.vanishingX);
  assert.ok(scale(near) < scale(far));
  // Samples remain within the captured photo even at the end of a long article.
  for (let u = 0; u <= 1; u += .05) {
    for (let v = 0; v <= 1; v += .05) {
      assert.ok(photoPoint([u, v], 18).every(value => Number.isFinite(value) && value >= 0 && value <= 1));
    }
  }
});

test('wall and floor reprojection stay continuous where their surfaces meet', () => {
  for (const x of [SCENE.left, SCENE.right]) {
    for (const z of [15, 25, 60]) {
      const u = SCENE.vanishingX + x / z * SCENE.focal;
      const v = SCENE.horizon + SCENE.eye / z * SCENE.focal * SCENE.aspect;
      for (const travel of [0, 5, 18]) {
        const actual = photoPoint([u, v], travel);
        close(actual[0], SCENE.vanishingX + x / (z + travel) * SCENE.focal);
        close(actual[1], SCENE.horizon + SCENE.eye / (z + travel) * SCENE.focal * SCENE.aspect);
      }
    }
  }
});

test('responsive framing preserves proportions and travel remains bounded', () => {
  for (const aspect of [390 / 844, 697 / 1049, 1440 / 900, 2560 / 1080]) {
    const [x, y] = viewSpan(aspect);
    close(x / y * SCENE.aspect, aspect);
    assert.ok(x > 0 && x <= 1 && y > 0 && y <= 1);
  }
  assert.equal(walkingDistance(0), 0);
  assert.equal(walkingDistance(-100), 0);
  let previous = 0;
  for (const scroll of [100, 500, 2000, 10000, 1000000]) {
    const travel = walkingDistance(scroll);
    assert.ok(travel > previous && travel <= 18);
    previous = travel;
  }
});
