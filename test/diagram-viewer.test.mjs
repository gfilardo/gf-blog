import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../static/js/diagram-viewer.js', import.meta.url), 'utf8');

// Run the real event handlers against a small DOM stand-in, including scroll bounds.
function viewer({ height = 800 } = {}) {
  class Element {
    listeners = new Map();
    style = {};
    clientWidth = 400;
    clientHeight = 600;
    left = 0;
    top = 0;
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    fire(name, values = {}) {
      const event = { preventDefault() { this.defaultPrevented = true; }, ...values };
      this.listeners.get(name)?.(event);
      return event;
    }
    setAttribute() {}
    append() {}
    prepend(child) { this.button = child; }
    before() {}
    replaceWith() {}
    focus() {}
    setPointerCapture() {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 320 }; }
    get scrollLeft() { return this.left; }
    set scrollLeft(value) { this.left = Math.max(0, Math.min(value, parseFloat(canvas.style.width) - 400)); }
    get scrollTop() { return this.top; }
    set scrollTop(value) { this.top = Math.max(0, Math.min(value, parseFloat(canvas.style.height) - 600)); }
    scrollTo(x, y) { this.scrollLeft = x; this.scrollTop = y; }
    showModal() { this.open = true; }
    close() { this.open = false; }
  }
  const viewport = new Element();
  const canvas = new Element();
  const output = new Element();
  const dialog = new Element();
  const svg = new Element();
  svg.getAttribute = key => ({ width: '1000', height: String(height), 'aria-label': 'Overview' })[key];
  const figure = new Element();
  figure.querySelector = selector => selector === 'svg' ? svg : null;
  const selectors = {
    '.diagram-viewer-viewport': viewport, '.diagram-viewer-canvas': canvas, output,
    '#diagram-viewer-caption': new Element(),
    '[data-action="out"]': new Element(), '[data-action="in"]': new Element()
  };
  dialog.querySelector = selector => selectors[selector];
  const document = {
    querySelectorAll: () => [figure],
    createElement: tag => tag === 'dialog' ? dialog : new Element(),
    body: new Element(), documentElement: { classList: { add() {}, remove() {} } }
  };
  const window = new Element();
  window.matchMedia = () => ({ matches: true });
  vm.runInNewContext(source, {
    document, HTMLDialogElement: Element, window,
    ResizeObserver: class { observe() {} }
  });
  figure.button.fire('click');
  const touch = (name, id, x, y = 200) => viewport.fire(name, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y });
  const zoom = () => parseFloat(canvas.style.width) / 1000;
  return { viewport, dialog, touch, zoom, window };
}

test('touch pinch anchors the diagram between fingers and continues as a one-finger pan', () => {
  const { viewport, touch, zoom } = viewer();
  touch('pointerdown', 1, 100);
  touch('pointerdown', 2, 300);
  touch('pointermove', 1, 0);
  touch('pointermove', 2, 400);
  assert.equal(zoom(), 2);
  assert.equal(viewport.scrollLeft, 200);
  touch('pointerup', 1, 0);
  touch('pointermove', 2, 350);
  assert.equal(zoom(), 2);
  assert.equal(viewport.scrollLeft, 250);
  touch('pointercancel', 2, 350);
  touch('pointermove', 2, 100);
  assert.equal(viewport.scrollLeft, 250);
});

test('trackpad pinch zooms at the cursor, limits scale, and leaves ordinary scrolling native', () => {
  const { viewport, zoom } = viewer();
  const wheel = (deltaY, ctrlKey = true) => viewport.fire('wheel', { deltaY, deltaMode: 0, ctrlKey, clientX: 100, clientY: 200 });
  assert.equal(wheel(-Math.log(2) / 0.01).defaultPrevented, true);
  assert.equal(zoom(), 2);
  assert.equal(viewport.scrollLeft, 100);
  assert.equal(viewport.scrollTop, 200);
  assert.equal(wheel(-50, false).defaultPrevented, undefined);
  assert.equal(zoom(), 2);
  wheel(-10000);
  assert.equal(zoom(), 4);
  wheel(10000);
  assert.equal(zoom(), 0.25);
});

test('Safari trackpad gestures use relative scale without applying wheel zoom twice', () => {
  const { viewport, zoom } = viewer();
  viewport.fire('gesturestart', { clientX: 100, clientY: 200 });
  viewport.fire('gesturechange', { scale: 1.5 });
  assert.equal(zoom(), 1.5);
  viewport.fire('wheel', { ctrlKey: true, deltaY: -100, clientX: 100, clientY: 200 });
  assert.equal(zoom(), 1.5);
  viewport.fire('gesturechange', { scale: 2 });
  assert.equal(zoom(), 2);
  assert.equal(viewport.scrollLeft, 100);
  viewport.fire('gestureend');
  viewport.fire('wheel', { ctrlKey: true, deltaY: -Math.log(1.5) / 0.01, clientX: 100, clientY: 200 });
  assert.equal(zoom(), 3);
});

test('closing clears in-progress gestures before reopening', () => {
  const { viewport, dialog, touch, zoom } = viewer();
  touch('pointerdown', 1, 100);
  dialog.fire('close');
  touch('pointermove', 1, 200);
  assert.equal(zoom(), 1);
  assert.equal(viewport.scrollLeft, 0);
});

test('Safari touch gesture events do not duplicate an active pointer pinch', () => {
  const { viewport, touch, zoom } = viewer();
  touch('pointerdown', 1, 100);
  touch('pointerdown', 2, 300);
  viewport.fire('gesturestart', { clientX: 200, clientY: 200 });
  touch('pointermove', 1, 0);
  touch('pointermove', 2, 400);
  viewport.fire('gesturechange', { scale: 2 });
  assert.equal(zoom(), 2);
  assert.equal(viewport.scrollLeft, 200);
});

test('zooming a vertically centered wide diagram keeps the point under the cursor fixed', () => {
  const { viewport, zoom } = viewer({ height: 200 });
  // The diagram initially spans y=200..400. Its center should stay at y=300
  // as it grows beyond the viewport height, without jumping toward the top.
  viewport.fire('wheel', {
    ctrlKey: true, deltaY: -Math.log(4) / 0.01, deltaMode: 0,
    clientX: 200, clientY: 300
  });
  assert.equal(zoom(), 4);
  assert.equal(viewport.scrollTop, 100);
  viewport.fire('wheel', {
    ctrlKey: true, deltaY: Math.log(4) / 0.01, deltaMode: 0,
    clientX: 200, clientY: 300
  });
  assert.equal(zoom(), 1);
  assert.equal(viewport.scrollTop, 0);
});

test('printing closes the viewer and immediately restores the inline diagram', () => {
  const { window, dialog, touch, viewport } = viewer();
  touch('pointerdown', 1, 100);
  window.fire('beforeprint');
  assert.equal(dialog.open, false);
  // The active diagram and gestures are cleared before the queued close event.
  touch('pointermove', 1, 200);
  assert.equal(viewport.scrollLeft, 0);
  assert.doesNotThrow(() => dialog.fire('close'));
});

test('diagram with figcaption appends zoom button inline to the caption', () => {
  class Element {
    listeners = new Map();
    style = {};
    clientWidth = 400;
    clientHeight = 600;
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    fire(name, values = {}) {
      const event = { preventDefault() { this.defaultPrevented = true; }, ...values };
      this.listeners.get(name)?.(event);
      return event;
    }
    setAttribute() {}
    append(...children) { this.children = (this.children || []).concat(children); }
    before() {}
    replaceWith() {}
    focus() {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 320 }; }
    scrollTo() {}
    showModal() { this.open = true; }
    close() { this.open = false; }
  }
  const figcaption = new Element();
  figcaption.childNodes = [{ textContent: 'Figure 1: Request flow' }];
  const svg = new Element();
  svg.getAttribute = key => ({ width: '1000', height: '800', 'aria-label': 'Overview' })[key];
  const figure = new Element();
  figure.querySelector = selector => selector === 'svg' ? svg : selector === 'figcaption' ? figcaption : null;
  const captionOutput = new Element();
  const dialog = new Element();
  dialog.querySelector = selector => ({
    '.diagram-viewer-viewport': new Element(),
    '.diagram-viewer-canvas': new Element(),
    output: new Element(),
    '#diagram-viewer-caption': captionOutput,
    '[data-action="out"]': new Element(),
    '[data-action="in"]': new Element()
  })[selector];
  const document = {
    querySelectorAll: () => [figure],
    createElement: tag => tag === 'dialog' ? dialog : new Element(),
    body: new Element(), documentElement: { classList: { add() {}, remove() {} } }
  };
  const window = new Element();
  window.matchMedia = () => ({ matches: true });
  vm.runInNewContext(source, {
    document, HTMLDialogElement: Element, window,
    ResizeObserver: class { observe() {} }
  });
  assert.ok(figure.button);
  figure.button.fire('click');
  assert.equal(dialog.open, true);
  assert.equal(captionOutput.textContent, 'Overview');
});

test('diagram that fits vertically locks vertical overflow and prevents vertical wiggle', () => {
  const { viewport, touch } = viewer({ height: 200 });
  assert.equal(viewport.style.overflowY, 'hidden');
  assert.equal(viewport.scrollTop, 0);
  // Simulating dragging diagonally with a vertical drift
  touch('pointerdown', 1, 100, 200);
  touch('pointermove', 1, 200, 250);
  assert.equal(viewport.scrollTop, 0);
  assert.equal(viewport.style.overflowY, 'hidden');
});
