// Progressive enhancement: the inline figures remain readable without JavaScript.
(() => {
  const figures = document.querySelectorAll('.mermaid-diagram');
  if (!figures.length || typeof HTMLDialogElement === 'undefined') return;

  const dialog = document.createElement('dialog');
  dialog.className = 'diagram-viewer';
  dialog.setAttribute('aria-labelledby', 'diagram-viewer-title');
  dialog.setAttribute('aria-describedby', 'diagram-viewer-help diagram-viewer-caption');
  dialog.innerHTML = `
    <h2 id="diagram-viewer-title" class="diagram-viewer-sr">Diagram</h2>
    <div class="diagram-viewer-toolbar">
      <div class="diagram-viewer-tools" role="group" aria-label="Diagram zoom">
        <button type="button" data-action="out" aria-label="Zoom out" title="Zoom out">−</button>
        <output aria-label="Zoom level" aria-live="polite"></output>
        <button type="button" data-action="in" aria-label="Zoom in" title="Zoom in">+</button>
        <button type="button" data-action="fit" title="Fit diagram to screen">Fit</button>
      </div>
      <button type="button" data-action="close" aria-label="Close diagram" title="Close diagram" autofocus>Close ×</button>
    </div>
    <p id="diagram-viewer-help" class="diagram-viewer-sr">Pinch to zoom. Drag, scroll, or swipe to move around.</p>
    <div class="diagram-viewer-viewport" tabindex="0" role="region" aria-label="Scrollable diagram">
      <div class="mermaid-diagram diagram-viewer-canvas"></div>
    </div>
    <p id="diagram-viewer-caption" class="diagram-viewer-sr"></p>`;
  document.body.append(dialog);
  const viewport = dialog.querySelector('.diagram-viewer-viewport');
  const canvas = dialog.querySelector('.diagram-viewer-canvas');
  const output = dialog.querySelector('output');
  const caption = dialog.querySelector('#diagram-viewer-caption');
  const zoomOut = dialog.querySelector('[data-action="out"]');
  const zoomIn = dialog.querySelector('[data-action="in"]');
  let active;
  let scale = 1;
  let fitted = false;

  const fitScale = () => Math.min(viewport.clientWidth / active.width, viewport.clientHeight / active.height);
  function pointAt(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }
  function anchorAt(point) {
    const insetX = Math.max(0, (viewport.clientWidth - active.width * scale) / 2);
    const insetY = Math.max(0, (viewport.clientHeight - active.height * scale) / 2);
    return { x: (viewport.scrollLeft + point.x - insetX) / scale, y: (viewport.scrollTop + point.y - insetY) / scale };
  }
  function resize(next, fit = false, point = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 }, anchor = anchorAt(point)) {
    scale = Math.max(Math.min(fitScale(), 0.25), Math.min(4, next));
    fitted = fit;
    canvas.style.width = `${active.width * scale}px`;
    canvas.style.height = `${active.height * scale}px`;
    output.textContent = `${Math.round(scale * 100)}%`;
    zoomOut.disabled = scale <= Math.min(fitScale(), 0.25);
    zoomIn.disabled = scale >= 4;
    const insetX = Math.max(0, (viewport.clientWidth - active.width * scale) / 2);
    const insetY = Math.max(0, (viewport.clientHeight - active.height * scale) / 2);
    const maxScrollX = Math.max(0, active.width * scale - viewport.clientWidth);
    const maxScrollY = Math.max(0, active.height * scale - viewport.clientHeight);
    if (viewport.style) {
      viewport.style.overflowX = maxScrollX > 0 ? 'auto' : 'hidden';
      viewport.style.overflowY = maxScrollY > 0 ? 'auto' : 'hidden';
    }
    viewport.scrollLeft = fit || maxScrollX === 0 ? 0 : Math.max(0, Math.min(maxScrollX, anchor.x * scale + insetX - point.x));
    viewport.scrollTop = fit || maxScrollY === 0 ? 0 : Math.max(0, Math.min(maxScrollY, anchor.y * scale + insetY - point.y));
  }

  // Handle touch locally, so zooming a diagram never zooms the surrounding page.
  const pointers = new Map();
  let gesture;
  function startGesture() {
    const points = [...pointers.values()];
    if (!points.length) { gesture = null; return; }
    const center = points.length > 1
      ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
      : points[0];
    gesture = {
      anchor: anchorAt(center), scale,
      distance: points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0
    };
  }
  viewport.addEventListener('pointerdown', event => {
    if (!active || event.pointerType === 'mouse') return;
    safariGesture = null;
    pointers.set(event.pointerId, pointAt(event.clientX, event.clientY));
    viewport.setPointerCapture(event.pointerId);
    startGesture();
  });
  viewport.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, pointAt(event.clientX, event.clientY));
    const points = [...pointers.values()];
    const center = points.length > 1
      ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
      : points[0];
    const distance = points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
    resize(gesture.distance > 0 ? gesture.scale * distance / gesture.distance : scale, false, center, gesture.anchor);
  });
  function endPointer(event) {
    if (!pointers.delete(event.pointerId)) return;
    startGesture();
  }
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) viewport.addEventListener(name, endPointer);

  // Chromium and Firefox expose trackpad pinch as a Ctrl+wheel event.
  // Ordinary trackpad scrolling keeps its native behavior.
  let safariGesture;
  viewport.addEventListener('wheel', event => {
    if (!active || !event.ctrlKey) return;
    event.preventDefault();
    if (safariGesture) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
    resize(scale * Math.exp(-event.deltaY * unit * 0.01), false, pointAt(event.clientX, event.clientY));
  }, { passive: false });
  // Safari exposes Mac trackpad pinch through its gesture events instead.
  viewport.addEventListener('gesturestart', event => {
    if (!active) return;
    event.preventDefault();
    if (pointers.size) return; // Touch Pointer Events already own this pinch.
    const point = pointAt(event.clientX, event.clientY);
    safariGesture = { scale, point, anchor: anchorAt(point) };
  }, { passive: false });
  viewport.addEventListener('gesturechange', event => {
    if (!safariGesture) return;
    event.preventDefault();
    resize(safariGesture.scale * event.scale, false, safariGesture.point, safariGesture.anchor);
  }, { passive: false });
  viewport.addEventListener('gestureend', event => {
    event.preventDefault();
    safariGesture = null;
  }, { passive: false });

  for (const figure of figures) {
    const svg = figure.querySelector('svg');
    if (!svg) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'diagram-expand';
    button.setAttribute('aria-label', 'Zoom diagram');
    button.setAttribute('aria-haspopup', 'dialog');
    button.title = 'Zoom diagram';
    button.innerHTML = '<span>Zoom</span> <span class="diagram-expand-arrow" aria-hidden="true">↗</span>';

    const captionEl = figure.querySelector('figcaption');
    if (captionEl) {
      const wrapper = document.createElement('span');
      wrapper.className = 'diagram-expand-wrap';
      wrapper.innerHTML = '<span class="diagram-expand-sep" aria-hidden="true"> · </span>';
      wrapper.append(button);
      captionEl.append(wrapper);
    } else {
      const wrapper = document.createElement('figcaption');
      wrapper.append(button);
      figure.append(wrapper);
    }
    figure.button = button;

    button.addEventListener('click', () => {
      const bounds = svg.getBoundingClientRect();
      const placeholder = document.createElement('div');
      placeholder.style.height = `${bounds.height}px`;
      svg.before(placeholder);
      active = { svg, placeholder, button, width: Number(svg.getAttribute('width')) || svg.viewBox.baseVal.width, height: Number(svg.getAttribute('height')) || svg.viewBox.baseVal.height };
      // Move the original SVG so marker IDs and style rules are never duplicated.
      canvas.append(svg);
      caption.textContent = svg.getAttribute('aria-label') || figure.querySelector('figcaption')?.childNodes[0]?.textContent?.trim() || '';
      dialog.showModal();
      document.documentElement.classList.add('diagram-viewer-open');
      const mobile = window.matchMedia('(max-width: 600px)').matches;
      resize(mobile ? Math.max(1, fitScale()) : fitScale(), !mobile);
      viewport.scrollTo(0, 0);
    });
  }

  dialog.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') dialog.close();
    else if (action === 'fit') resize(fitScale(), true);
    else if (action === 'in') resize(scale * 1.25);
    else if (action === 'out') resize(scale / 1.25);
    else if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    }
  });
  function restoreDiagram() {
    if (!active) return;
    active.placeholder.replaceWith(active.svg);
    document.documentElement.classList.remove('diagram-viewer-open');
    active.button.focus({ preventScroll: true });
    pointers.clear();
    gesture = null;
    safariGesture = null;
    active = null;
  }
  dialog.addEventListener('close', restoreDiagram);
  window.addEventListener('beforeprint', () => {
    if (!dialog.open) return;
    dialog.close();
    // Restore synchronously: the close event can arrive after print layout.
    restoreDiagram();
  });
  new ResizeObserver(() => {
    if (dialog.open && active) resize(fitted ? fitScale() : scale, fitted);
  }).observe(viewport);
})();
