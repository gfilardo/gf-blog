import { createFlock } from '../static/js/flock.mjs';

// A static flock remains visible without JavaScript and before enhancement.
export function systemArt() {
  const birds = createFlock().map(bird => {
    const angle = Math.atan2(bird.vy, bird.vx) * 180 / Math.PI;
    return `<path class="boid boid-${bird.color}" transform="translate(${bird.x.toFixed(2)} ${bird.y.toFixed(2)}) rotate(${angle.toFixed(2)}) scale(${bird.size.toFixed(2)})" d="M-1.8 -1.1 1.2 0 -1.8 1.1 -.8 0Z"/>`;
  }).join('');
  return `<svg class="flock-fallback" viewBox="0 0 600 380" aria-hidden="true">${birds}</svg>`;
}
