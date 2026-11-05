import { SCENE, viewSpan, walkingDistance } from './arcade-geometry.mjs';

// The photograph is projected onto two walls and a ground plane. Advancing the
// camera reprojects each surface at its own depth, rather than zooming an image.
const canvas = document.querySelector('.arcade-canvas');
const background = canvas?.parentElement;
const gl = canvas?.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });

if (gl) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const image = new Image();
  let frame = 0, previous = 0, loaded = false;
  let position = reduced.matches ? 0 : walkingDistance(window.scrollY);
  let target = position;
  let uniforms;

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = vec2(a_position.x * .5 + .5, .5 - a_position.y * .5);
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;
  const fragmentSource = `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_photo;
    uniform vec2 u_span;
    uniform float u_travel;
    const vec2 vanishing = vec2(${SCENE.vanishingX}, ${SCENE.horizon});
    const float focal = ${SCENE.focal};
    const float aspect = ${SCENE.aspect};
    void main() {
      vec2 uv = vanishing + (v_uv - vanishing) * u_span;
      vec2 ray = vec2((uv.x - vanishing.x) / focal,
                      (vanishing.y - uv.y) / (focal * aspect));
      float distance = ${SCENE.far.toFixed(1)};
      if (ray.x < -.00001) distance = min(distance, ${SCENE.left} / ray.x);
      if (ray.x > .00001) distance = min(distance, ${SCENE.right} / ray.x);
      if (ray.y < -.00001) distance = min(distance, -${SCENE.eye} / ray.y);
      vec2 point = ray * distance;
      float depth = distance + u_travel;
      vec2 photo = vanishing + vec2(point.x, -point.y * aspect) * focal / depth;
      gl_FragColor = vec4(texture2D(u_photo, photo).rgb, 1.0);
    }
  `;

  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source); gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) { gl.deleteShader(result); return null; }
    return result;
  }

  function setup() {
    const vertex = shader(gl.VERTEX_SHADER, vertexSource);
    const fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return false;
    const program = gl.createProgram();
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return false; }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const attribute = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    gl.uniform1i(gl.getUniformLocation(program, 'u_photo'), 0);
    uniforms = { span: gl.getUniformLocation(program, 'u_span'), travel: gl.getUniformLocation(program, 'u_travel') };
    loaded = true;
    resize();
    return true;
  }

  function draw() {
    gl.uniform1f(uniforms.travel, position);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    background.classList.add('arcade-ready');
  }
  function tick(now) {
    frame = 0;
    if (!loaded || document.hidden) { previous = 0; return; }
    const dt = previous ? Math.min(now - previous, 64) : 16.67;
    previous = now;
    position += (target - position) * (1 - Math.exp(-dt / 95));
    if (Math.abs(target - position) < .001) position = target;
    draw();
    if (position !== target) frame = requestAnimationFrame(tick);
    else previous = 0;
  }
  function requestDraw() {
    if (loaded && !frame && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    // Cap the render buffer too: this quiet background does not need 4K redraws.
    const scale = Math.min(ratio, 1920 / window.innerWidth);
    canvas.width = Math.round(window.innerWidth * scale);
    canvas.height = Math.round(window.innerHeight * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (loaded) gl.uniform2fv(uniforms.span, viewSpan(window.innerWidth / window.innerHeight));
    requestDraw();
  }
  function scroll() {
    if (reduced.matches) return;
    target = walkingDistance(window.scrollY);
    requestDraw();
  }

  image.addEventListener('load', setup, { once: true });
  image.src = new URL('../assets/arcade-reference.png', import.meta.url).href;
  window.addEventListener('scroll', scroll, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  reduced.addEventListener('change', () => {
    position = target = reduced.matches ? 0 : walkingDistance(window.scrollY);
    requestDraw();
  });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    if (!document.hidden) { target = reduced.matches ? 0 : walkingDistance(window.scrollY); requestDraw(); }
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    loaded = false; cancelAnimationFrame(frame); frame = 0;
    background.classList.remove('arcade-ready');
  });
  canvas.addEventListener('webglcontextrestored', () => { if (image.complete && image.naturalWidth) setup(); });
}
