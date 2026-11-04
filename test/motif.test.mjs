import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { XMLValidator, XMLParser } from 'fast-xml-parser';
import { render } from '../src/render.mjs';
import {
  fnv1a,
  mulberry32,
  ALGORITHMS,
  assertRegistryInvariants,
  isKnownAlgorithm,
  resolveMotifParameters,
  generateArticleMotif,
  renderTruchet,
  renderGuilloche,
  renderSubdivision,
  renderAutomata,
  renderFlowField
} from '../src/motif.mjs';

test('registry maintains monotonic since dates, unique IDs, and valid draw functions', () => {
  assertRegistryInvariants();
  assert.deepEqual(ALGORITHMS.map(a => a.id), ['truchet', 'guilloche', 'subdivision', 'supershape', 'automata', 'flow-field', 'switchyard']);
  assert.equal(isKnownAlgorithm('truchet'), true);
  assert.equal(isKnownAlgorithm('guilloche'), true);
  assert.equal(isKnownAlgorithm('subdivision'), true);
  assert.equal(isKnownAlgorithm('unknown-algo'), false);
});

test('registry rejects broken invariants', () => {
  // Non-monotonic
  const nonMonotonic = [
    { id: 'b', since: '2027-01-01', draw: () => '' },
    { id: 'a', since: '2026-01-01', draw: () => '' },
  ];
  assert.throws(() => assertRegistryInvariants(nonMonotonic), /breaks monotonicity/);

  // Duplicate ID
  const duplicateId = [
    { id: 'a', since: '2026-01-01', draw: () => '' },
    { id: 'a', since: '2026-06-01', draw: () => '' },
  ];
  assert.throws(() => assertRegistryInvariants(duplicateId), /Duplicate algorithm ID/);

  // Missing draw function
  const missingDraw = [
    { id: 'a', since: '2026-01-01' },
  ];
  assert.throws(() => assertRegistryInvariants(missingDraw), /missing draw function/);
});

test('deterministic seed derivation and hashing', () => {
  const hash1 = fnv1a('how-this-blog-is-built');
  const hash2 = fnv1a('how-this-blog-is-built');
  assert.equal(hash1, hash2);
  assert.equal(typeof hash1, 'number');
  assert(hash1 > 0);

  const hashOther = fnv1a('webmcp-people-and-agents');
  assert.notEqual(hash1, hashOther);
});

test('PRNG stream reproducibility', () => {
  const rng1 = mulberry32(12345);
  const rng2 = mulberry32(12345);
  const seq1 = [rng1(), rng1(), rng1()];
  const seq2 = [rng2(), rng2(), rng2()];
  assert.deepEqual(seq1, seq2);
});

test('date-epoch selection remains stable for historical articles', () => {
  const doc = { slug: 'test-article', date: '2026-10-25' };
  const res1 = resolveMotifParameters(doc);

  // Simulating future registry extension
  const extendedRegistry = [
    ...ALGORITHMS,
    { id: 'future-algo', since: '2027-01-01', draw: () => '<path d="M0,0"/>' }
  ];

  const res2 = resolveMotifParameters(doc, extendedRegistry);
  assert.equal(res1.algorithm.id, res2.algorithm.id);
  assert.equal(res1.seed, res2.seed);
});

test('draft preview policy gives access to latest epoch without requiring past date', () => {
  const futureRegistry = [
    ...ALGORITHMS,
    { id: 'future-algo', since: '2028-01-01', draw: () => '<path d="M0,0"/>' }
  ];

  const draftDoc = { slug: 'wip-post', draft: true };
  const res = resolveMotifParameters(draftDoc, futureRegistry);
  assert.ok(res.algorithm);
  assert.equal(typeof res.seed, 'number');
});

test('article and series frontmatter overrides take precedence', () => {
  // String shorthand
  const docString = { slug: 'test-1', date: '2026-10-25', motif: 'guilloche' };
  assert.equal(resolveMotifParameters(docString).algorithm.id, 'guilloche');

  // Object override with explicit seed
  const docObject = { slug: 'test-2', date: '2026-10-25', motif: { algorithm: 'truchet', seed: 9999 } };
  const resObj = resolveMotifParameters(docObject);
  assert.equal(resObj.algorithm.id, 'truchet');
  assert.equal(resObj.seed, 9999);

  // Explicit seed: 0 must not be treated as falsy
  const docZeroSeed = { slug: 'test-3', date: '2026-10-25', motif: { seed: 0 } };
  const resZero = resolveMotifParameters(docZeroSeed);
  assert.equal(resZero.seed, 0);

  // Series-level override
  const docSeries = { slug: 'test-4', date: '2026-10-25', series: { id: 's', title: 'S', part: 1, motif: 'subdivision' } };
  assert.equal(resolveMotifParameters(docSeries).algorithm.id, 'subdivision');

  // Post-level override wins over series-level override
  const docBoth = { slug: 'test-5', date: '2026-10-25', motif: 'truchet', series: { id: 's', title: 'S', part: 1, motif: 'subdivision' } };
  assert.equal(resolveMotifParameters(docBoth).algorithm.id, 'truchet');

  // Unknown algorithm throws
  assert.throws(() => resolveMotifParameters({ slug: 'test-6', date: '2026-10-25', motif: 'non-existent' }), /Unknown motif algorithm/);
});

test('all generators produce valid SVG with unified design tokens', () => {
  const seed = 3365405519;

  for (const { draw } of ALGORITHMS) {
    const heroSvg = draw(seed, { width: 360, height: 80, form: 'hero' });
    const markSvg = draw(seed, { width: 120, height: 120, form: 'mark' });

    for (const svg of [heroSvg, markSvg]) {
      assert(svg.length > 100, 'SVG geometry meets minimum complexity');
      assert.match(svg, /var\(--accent\)/, 'Contains focal accent token');
      assert.match(svg, /vector-effect="non-scaling-stroke"/, 'Unified drafting weight constraint');
      assert(!svg.includes('NaN'), 'No NaN coordinates');
      assert(!svg.includes('undefined'), 'No undefined coordinates');
    }
  }
});

test('generateArticleMotif wraps pure inline SVG with accessible attributes', () => {
  const doc = { slug: 'how-this-blog-is-built', date: '2026-10-23' };
  const svg = generateArticleMotif(doc);

  assert.match(svg, /^<svg class="article-motif" viewBox="0 0 360 80" width="360" height="80"/);
  assert.match(svg, /aria-hidden="true"/);
  assert.match(svg, /<\/svg>$/);
});

test('complexity floor and deterministic perturbation across diverse seeds', () => {
  for (let s = 1; s <= 30; s++) {
    const doc = { slug: `article-sample-${s}`, date: '2026-10-25' };
    const svg = generateArticleMotif(doc);
    assert(svg.length >= 200, `Article ${doc.slug} produced substantial SVG (${svg.length} chars)`);
  }
});

test('render produces /motifs/ recap page including both published articles and drafts', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const site = {
    title: "Giovanni's blog",
    author: 'Giovanni Filardo',
    description: 'Notes on software architecture',
    language: 'en',
    origin: 'https://example.com',
    basePath: '',
    copyrightYear: '2026',
    navigation: [{ title: 'Articles', path: '/' }]
  };
  const documents = [
    {
      source: 'test.md',
      kind: 'post',
      title: 'Published Article',
      slug: 'published-article',
      date: '2026-10-25',
      description: 'A published article',
      draft: false,
      tags: ['software'],
      route: '/posts/published-article/',
      url: '/posts/published-article/',
      body: '<p>Hello</p>'
    },
    {
      source: 'draft.md',
      kind: 'post',
      title: 'Draft Article',
      slug: 'draft-article',
      date: '2026-11-01',
      description: 'A draft article',
      draft: true,
      tags: ['software'],
      route: '/posts/draft-article/',
      url: '/preview/draft-article/',
      body: '<p>Draft</p>'
    }
  ];
  const files = render(root, site, documents);
  assert.ok(files.has('motifs/index.html'));

  const recapHtml = files.get('motifs/index.html');
  assert.match(recapHtml, /Article Motifs/);
  assert.match(recapHtml, /Published Article/);
  assert.match(recapHtml, /Draft Article/);
  assert.match(recapHtml, /Draft preview/);
  assert.match(recapHtml, /motif-widget/);
  assert.match(recapHtml, /motif-select-algo/);
  assert.match(recapHtml, /motif-select-seed/);
  assert.match(recapHtml, /Hero Frieze/);
  assert.match(recapHtml, /Compact Mark/);
  assert.match(recapHtml, /List Mark/);
  for (const { id } of ALGORITHMS) assert.ok(recapHtml.includes(`<option value="${id}"`));

  const indexHtml = files.get('index.html');
  assert.match(indexHtml, /class="article-motif-mark"/);
});


// Captured before extraction; Truchet and guilloché now have dedicated geometry tests.
test('unchanged original algorithms retain byte-identical hero and mark geometry', () => {
  const digests = {
    subdivision: '8b214c15299c7a8c6ecb31b04fa2350686f72fec3e2fc30c6148260e62d6ea03'
  };
  for (const { id, draw } of ALGORITHMS.filter(a => a.id in digests)) {
    const geometry = [0, 42, 4294967295].flatMap(seed => [
      { width: 360, height: 80, form: 'hero' },
      { width: 120, height: 120, form: 'mark' }
    ].map(bounds => draw(seed, bounds))).join('');
    assert.equal(createHash('sha256').update(geometry).digest('hex'), digests[id]);
  }
});

test('new epoch preserves historical selection and makes every new algorithm reachable', () => {
  const epochs = [...new Set(ALGORITHMS.map(a => a.since))];
  assert.ok(epochs.length >= 2, 'registry includes a later algorithm epoch');
  for (const since of epochs.slice(1)) {
    const previousDate = new Date(Date.parse(`${since}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
    const previousAlgorithms = ALGORITHMS.filter(a => a.since < since);
    const availableAlgorithms = ALGORITHMS.filter(a => a.since <= since);
    const before = new Set();
    const after = new Set();
    for (let i = 0; i < 100; i++) {
      const doc = { slug: `epoch-${i}`, date: previousDate };
      const old = resolveMotifParameters(doc, previousAlgorithms);
      assert.equal(resolveMotifParameters(doc).algorithm.id, old.algorithm.id);
      before.add(old.algorithm.id);
      after.add(resolveMotifParameters({ ...doc, date: since }).algorithm.id);
    }
    assert.deepEqual(before, new Set(previousAlgorithms.map(a => a.id)));
    assert.deepEqual(after, new Set(availableAlgorithms.map(a => a.id)));
  }
  for (const { id } of ALGORITHMS.filter(a => a.since > epochs[0])) {
    const doc = { slug: 'old-post', date: epochs[0], motif: { algorithm: id, seed: 0 } };
    assert.equal(resolveMotifParameters(doc).algorithm.id, id);
    assert.ok(generateArticleMotif(doc).includes('var(--accent)'));
  }
});

test('new algorithms are reproducible, bounded, valid XML, and have one accent stroke', () => {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  for (const { id, draw } of ALGORITHMS.slice(3)) {
    for (const bounds of [
      { width: 360, height: 80, form: 'hero' },
      { width: 120, height: 120, form: 'mark' },
      { width: 240, height: 100, form: 'hero' }
    ]) {
      const variants = new Set();
      for (const seed of [0, 1, 42, 12345, 2147483647, 4294967295]) {
        const geometry = draw(seed, bounds);
        variants.add(geometry);
        assert.equal(geometry, draw(seed, bounds), `${id} deterministic`);
        assert.doesNotMatch(geometry, /NaN|Infinity|undefined/);
        const svg = `<svg>${geometry}</svg>`;
        assert.equal(XMLValidator.validate(svg), true);
        assert.equal((geometry.match(/stroke="var\(--accent\)"/g) ?? []).length, 1);
        const parsed = parser.parse(svg).svg;
        for (const circle of [parsed.circle ?? []].flat()) {
          assert.ok(circle.cx - circle.r >= 0 && Number(circle.cx) + Number(circle.r) <= bounds.width);
          assert.ok(circle.cy - circle.r >= 0 && Number(circle.cy) + Number(circle.r) <= bounds.height);
        }
        for (const p of [parsed.path ?? []].flat()) {
          for (const match of p.d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)) {
            assert.ok(+match[1] >= 0 && +match[1] <= bounds.width, `${id} x within canvas`);
            assert.ok(+match[2] >= 0 && +match[2] <= bounds.height, `${id} y within canvas`);
          }
        }
      }
      assert.ok(variants.size >= 4, `${id} provides seed variety`);
    }
  }
});

test('automata seals keep their topology across forms and have mirrored, unique contour edges', () => {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  function contour(bounds, seed) {
    const { path } = parser.parse(`<svg>${renderAutomata(seed, bounds)}</svg>`).svg;
    const focal = path.find(p => p.stroke === 'var(--accent)');
    const segments = [...focal.d.matchAll(/M([\d.]+),([\d.]+)L([\d.]+),([\d.]+)/g)]
      .map(m => m.slice(1).map(Number));
    const minX = Math.min(...segments.flatMap(([x1, , x2]) => [x1, x2]));
    const minY = Math.min(...segments.flatMap(([, y1, , y2]) => [y1, y2]));
    const [x1, y1, x2, y2] = segments[0];
    const cell = Math.hypot(x2 - x1, y2 - y1);
    return segments.map(edge => edge.map((v, i) => Math.round((v - (i % 2 ? minY : minX)) / cell)));
  }
  const key = ([x1, y1, x2, y2]) => [[x1, y1].join(','), [x2, y2].join(',')].sort().join(':');
  for (const seed of [0, 1, 42, 12345]) {
    const hero = contour({ width: 360, height: 80, form: 'hero' }, seed);
    const mark = contour({ width: 120, height: 120, form: 'mark' }, seed);
    assert.deepEqual(hero, mark, 'hero nucleus and compact mark share the same cell contours');
    const edges = new Set(mark.map(key));
    assert.equal(edges.size, mark.length, 'shared cell edges are absent');
    const maxY = Math.max(...mark.flatMap(([, y1, , y2]) => [y1, y2]));
    for (const [x1, y1, x2, y2] of mark) {
      assert.ok(edges.has(key([x1, maxY - y1, x2, maxY - y2])), 'seal is mirrored about its equator');
    }
  }
});

test('flow fields stay substantial and bounded across seeds, including Bézier controls', () => {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  for (const bounds of [
    { width: 360, height: 80, form: 'hero' },
    { width: 120, height: 120, form: 'mark' }
  ]) {
    for (let seed = 0; seed < 64; seed++) {
      const geometry = renderFlowField(seed, bounds);
      const paths = parser.parse(`<svg>${geometry}</svg>`).svg.path;
      assert.ok(paths.length >= 4, `seed ${seed} fills the canvas with several streamlines`);
      assert.ok(geometry.length < 35000, 'SVG output stays compact');
      for (const path of paths) {
        assert.match(path.d, /Q/, 'streamlines use smooth quadratic curves');
        const points = [...path.d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => m.slice(1).map(Number));
        assert.ok(points.length >= 5);
        for (const [x, y] of points) {
          assert.ok(x >= 0 && x <= bounds.width && y >= 0 && y <= bounds.height,
            'endpoints and control points stay inside the canvas');
        }
      }
    }
  }
});
