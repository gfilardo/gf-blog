import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { WIDTH, HEIGHT } from '../static/js/flock.mjs';

test('touch pulses survive release, expire, cancel on scroll, and respect pause', async () => {
  const source = (await readFile(new URL('../static/js/system-field.js', import.meta.url), 'utf8')).replace(/^import .*;\n/, '');
  const events = {}, buttonEvents = {}, calls = [];
  let callback, now = 0;
  const ctx = new Proxy({}, { get: () => () => {} });
  const canvas = { getContext: () => ctx, getBoundingClientRect: () => ({ left: 20, top: 50, width: 300, height: 190 }), addEventListener: (name, fn) => { events[name] = fn; } };
  const button = { setAttribute() {}, addEventListener: (name, fn) => { buttonEvents[name] = fn; } };
  const field = { querySelector: name => name === 'canvas' ? canvas : button, classList: { add() {} } };
  vm.runInNewContext(source, {
    document: { querySelector: () => field, hidden: false, addEventListener() {} },
    window: { addEventListener() {} }, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    performance: { now: () => now },
    requestAnimationFrame: fn => { callback = fn; return 1; }, cancelAnimationFrame() {},
    IntersectionObserver: class { observe() {} },
    visitorAt: () => null, createFlock: () => [], WIDTH, HEIGHT,
    stepFlock: (birds, dt, time, pointer) => { calls.push({ dt, pointer }); return birds; }
  });
  const touch = { pointerType: 'touch', clientX: 170, clientY: 145 };
  events.pointerdown(touch);
  events.pointerleave();
  now = 100; callback(now);
  assert.equal(calls.at(-1).pointer.x, 300);
  assert.equal(calls.at(-1).pointer.y, HEIGHT / 2);
  assert.equal(calls.reduce((sum, call) => sum + call.dt, 0), 1.1);
  now = 1000; callback(now);
  assert.equal(calls.at(-1).pointer, null);
  events.pointerdown(touch); events.pointercancel(); callback(1016);
  assert.equal(calls.at(-1).pointer, null);
  buttonEvents.click();
  const count = calls.length;
  events.pointerdown(touch); callback(1032);
  assert.equal(calls.length, count);
  buttonEvents.click(); callback(1048);
  assert.equal(calls.at(-1).pointer, null);
});
