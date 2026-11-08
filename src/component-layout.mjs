// A content-agnostic layout container: tables, diagrams, and widgets
// share the same sizing vocabulary as article images. Also handles callout containers.
const layouts = new Map([
  ['default', 'default'], ['wide', 'wide'], ['bleed', 'bleed'],
  ['full', 'bleed'], ['narrow', 'narrow'], ['center', 'narrow'],
  ['float-left', 'float-left'], ['float-right', 'float-right'],
]);

export const CALLOUT_TYPES = new Set(['note', 'info', 'tip', 'warning', 'caution', 'important']);

export const CALLOUT_ICONS = {
  note: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm8-3a1 1 0 100-2 1 1 0 000 2zm1 3.5a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z"/></svg>',
  info: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm8-3a1 1 0 100-2 1 1 0 000 2zm1 3.5a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z"/></svg>',
  tip: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.913.307.54.414 1.02.414 1.53h3.43c0-.51.107-.99.414-1.53.204-.357.45-.65.673-.913l.214-.253c.56-.68.984-1.32.984-2.304 0-2.06-1.637-3.75-4-3.75zM5.5 11.75a.75.75 0 000 1.5h5a.75.75 0 000-1.5h-5zm1 2.5a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z"/></svg>',
  important: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm8-2.5a.75.75 0 00-.75.75v3.5a.75.75 0 001.5 0v-3.5A.75.75 0 008 5.5zm0 6.5a1 1 0 100-2 1 1 0 000 2z"/></svg>',
  warning: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM8 5a.75.75 0 00-.75.75v3.5a.75.75 0 001.5 0v-3.5A.75.75 0 008 5zm0 7a1 1 0 100-2 1 1 0 000 2z"/></svg>',
  caution: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.47.04c.328-.04.66.058.909.268l2.62 2.222 2.62-2.222a1.2 1.2 0 011.41-.048l3.434 2.373a1.2 1.2 0 01.492 1.134l-.626 3.42 2.222 2.62a1.2 1.2 0 010 1.544l-2.222 2.62.626 3.42a1.2 1.2 0 01-.492 1.134l-3.434 2.373a1.2 1.2 0 01-1.41-.048l-2.62-2.222-2.62 2.222a1.2 1.2 0 01-1.41.048L.545 15.54a1.2 1.2 0 01-.492-1.134l.626-3.42L-1.543 8.366a1.2 1.2 0 010-1.544l2.222-2.62L.053.782A1.2 1.2 0 01.545-.352L3.979-.026a1.2 1.2 0 01.491.066zM5.22 5.22a.75.75 0 00-1.06 1.06L6.94 9 4.16 11.78a.75.75 0 101.06 1.06L8 10.06l2.78 2.78a.75.75 0 001.06-1.06L9.06 9l2.78-2.72a.75.75 0 00-1.06-1.06L8 7.94 5.22 5.22z"/></svg>'
};

export function parseComponentHint(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return { layout: 'default', widget: null };

  let spec = trimmed;
  if (spec.startsWith('component')) {
    spec = spec.slice('component'.length).trim();
    if (!spec) return { layout: 'default', widget: null };
  }

  const parts = spec.split(/\s+/);
  const first = parts[0].toLowerCase();

  if (CALLOUT_TYPES.has(first)) {
    const customTitle = parts.slice(1).join(' ').trim();
    const type = first === 'info' ? 'note' : first;
    return { callout: type, title: customTitle || type[0].toUpperCase() + type.slice(1) };
  }

  if (first.includes('#')) {
    const [w, h] = first.split('#');
    const hint = h.trim();
    if (!layouts.has(hint)) {
      throw new Error(`Unknown component layout hint: "${hint}". Choose one of: ${[...layouts.keys()].join(', ')}`);
    }
    return { layout: layouts.get(hint), widget: w.trim() || null };
  }

  if (layouts.has(first)) {
    return { layout: layouts.get(first), widget: null };
  }

  if (parts.length >= 2 && layouts.has(parts[1])) {
    return { layout: layouts.get(parts[1]), widget: parts[0] };
  }

  throw new Error(`Unknown component layout hint: "${spec}". Choose one of: ${[...layouts.keys()].join(', ')}`);
}

export function componentLayout(md) {
  md.block.ruler.before('fence', 'component', (state, start, end, silent) => {
    const line = n => state.src.slice(state.bMarks[n] + state.tShift[n], state.eMarks[n]);
    if (state.sCount[start] - state.blkIndent >= 4) return false;
    const opening = /^:::(?:component)?(?:\s+(.*))?$/.exec(line(start));
    if (!opening) return false;
    if (silent) return true;

    const parsed = parseComponentHint(opening[1]);

    let close = start + 1;
    let depth = 1;
    let fence = null;
    for (; close < end; close++) {
      const text = line(close);
      // Container markers in code examples are literal text.
      const code = /^(`{3,}|~{3,})(.*)$/.exec(text);
      if (code) {
        if (!fence) fence = code[1];
        else if (code[1][0] === fence[0] && code[1].length >= fence.length && !code[2].trim()) fence = null;
        continue;
      }
      if (fence || state.sCount[close] - state.blkIndent >= 4) continue;
      if (text.startsWith(':::') && text.trim() !== ':::') depth++;
      if (/^:::\s*$/.test(text) && --depth === 0) break;
    }
    if (close === end) throw new Error('Unclosed component layout: add a closing ::: line');

    const oldParent = state.parentType;
    const oldMax = state.lineMax;

    if (parsed.callout) {
      const type = parsed.callout;
      const title = parsed.title;
      state.parentType = 'component';
      state.lineMax = close;
      const token = state.push('callout_open', 'aside', 1);
      token.block = true;
      token.map = [start, close + 1];
      token.attrSet('class', `callout callout-${type}`);
      token.attrSet('role', 'note');

      const titleToken = state.push('html_block', '', 0);
      titleToken.content = `<div class="callout-title">${CALLOUT_ICONS[type] || ''} ${title}</div>\n`;

      state.md.block.tokenize(state, start + 1, close);
      state.push('callout_close', 'aside', -1).block = true;
      state.parentType = oldParent;
      state.lineMax = oldMax;
      state.line = close + 1;
      return true;
    }

    const { layout, widget } = parsed;
    state.parentType = 'component';
    state.lineMax = close;
    const token = state.push('component_open', 'figure', 1);
    token.block = true;
    token.map = [start, close + 1];
    token.attrSet('class', `component component-${layout}`);
    if (widget) {
      token.attrSet('data-widget', widget);
    }
    state.md.block.tokenize(state, start + 1, close);
    state.push('component_close', 'figure', -1).block = true;
    state.parentType = oldParent;
    state.lineMax = oldMax;
    state.line = close + 1;
    return true;
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });

  md.renderer.rules.table_open = () => '<div class="table-scroll" role="region" aria-label="Scrollable table" tabindex="0"><table>\n';
  md.renderer.rules.table_close = () => '</table></div>\n';
}
