export const WIDTH = 600;
export const HEIGHT = 380;

export function createFlock(count = 110, seed = 731) {
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  return Array.from({ length: count }, (_, i) => {
    const angle = random() * Math.PI * 1.6 - .8;
    const radius = 55 + random() * 95;
    const heading = angle + Math.PI / 2;
    const speed = .65 + random() * .65;
    return { x: 310 + Math.cos(angle) * radius * 1.5, y: 185 + Math.sin(angle) * radius,
      vx: Math.cos(heading) * speed, vy: Math.sin(heading) * speed,
      speed, size: 2 + random() * 1.7, phase: random() * Math.PI * 2,
      sociability: .7 + random() * .6, color: i % 11 === 0 ? 1 : i % 4 === 0 ? 2 : 0 };
  });
}

// All agents read the same previous frame; no leader or prescribed flight path.
export function stepFlock(birds, dt = 1, time = 0, pointer = null) {
  const next = birds.map(bird => {
    let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, neighbors = 0;
    for (const other of birds) {
      if (other === bird) continue;
      const dx = other.x - bird.x, dy = other.y - bird.y, d2 = dx * dx + dy * dy;
      if (d2 > 0 && d2 < 65 * 65) {
        ax += other.vx; ay += other.vy; cx += other.x; cy += other.y; neighbors++;
        if (d2 < 22 * 22) { sx -= dx / d2; sy -= dy / d2; }
      }
    }
    let fx = sx * .65, fy = sy * .65;
    if (neighbors) {
      fx += (ax / neighbors - bird.vx) * .035 + (cx / neighbors - bird.x) * .00065 * bird.sociability;
      fy += (ay / neighbors - bird.vy) * .035 + (cy / neighbors - bird.y) * .00065 * bird.sociability;
    }
    // Individual preference drifts slowly, keeping differences within the flock.
    fx += Math.cos(time * .23 + bird.phase) * .008;
    fy += Math.sin(time * .19 + bird.phase) * .008;
    const margin = 65;
    if (bird.x < margin) fx += (margin - bird.x) * .002;
    if (bird.x > WIDTH - margin) fx -= (bird.x - WIDTH + margin) * .002;
    if (bird.y < margin) fy += (margin - bird.y) * .002;
    if (bird.y > HEIGHT - margin) fy -= (bird.y - HEIGHT + margin) * .002;
    if (pointer) {
      const dx = bird.x - pointer.x, dy = bird.y - pointer.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < 85) { fx += dx / d * (1 - d / 85) * .12; fy += dy / d * (1 - d / 85) * .12; }
    }
    const force = Math.hypot(fx, fy), cap = Math.min(1, .065 / (force || 1));
    let vx = bird.vx + fx * cap * dt, vy = bird.vy + fy * cap * dt;
    const speed = Math.hypot(vx, vy) || 1;
    const desired = Math.max(bird.speed * .7, Math.min(bird.speed * 1.3, speed));
    vx *= desired / speed; vy *= desired / speed;
    return { ...bird, x: Math.max(5, Math.min(WIDTH - 5, bird.x + vx * dt)),
      y: Math.max(5, Math.min(HEIGHT - 5, bird.y + vy * dt)), vx, vy };
  });
  return next;
}
