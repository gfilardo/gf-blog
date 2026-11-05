// Camera calibration for the supplied photograph. Image coordinates run downwards;
// world coordinates use metres, with the camera looking along the positive z axis.
export const SCENE = Object.freeze({
  aspect: 1000 / 558,
  horizon: .718,
  vanishingX: .32,
  focal: 1.05,
  eye: 1.7,
  left: -3.5,
  right: 7.7,
  far: 2000,
});

export function viewSpan(aspect) {
  return [Math.min(1, aspect / SCENE.aspect), Math.min(1, SCENE.aspect / aspect)];
}

export function walkingDistance(scrollY) {
  // A finite photograph has finite detail. Ease the pace in very long articles
  // instead of stretching its distant pixels into a blurry, endless tunnel.
  return 18 * (1 - Math.exp(-Math.max(0, scrollY) / 4500));
}

export function photoPoint([u, v], travel) {
  const dx = (u - SCENE.vanishingX) / SCENE.focal;
  const dy = (SCENE.horizon - v) / (SCENE.focal * SCENE.aspect);
  let distance = SCENE.far;
  if (dx < 0) distance = Math.min(distance, SCENE.left / dx);
  if (dx > 0) distance = Math.min(distance, SCENE.right / dx);
  if (dy < 0) distance = Math.min(distance, -SCENE.eye / dy);
  const depth = distance + travel;
  return [SCENE.vanishingX + dx * distance / depth * SCENE.focal,
    SCENE.horizon - dy * distance / depth * SCENE.focal * SCENE.aspect];
}
