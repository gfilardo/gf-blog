import { readFile, writeFile, mkdir, readdir, stat, chmod } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import YAML from 'yaml';

export const OTS_HEADER_BYTES = Buffer.from('004f70656e54696d657374616d7073000050726f6f6600bf89e2e884e892940108', 'hex');

export function wrapDetachedProof(rawHashBytes, payloadBuffer) {
  if (!payloadBuffer) return null;
  // If already prefixed with OTS header magic (first 31 bytes), return as is
  if (payloadBuffer.length >= 31 && payloadBuffer.subarray(0, 31).equals(OTS_HEADER_BYTES.subarray(0, 31))) {
    return payloadBuffer;
  }
  return Buffer.concat([OTS_HEADER_BYTES, rawHashBytes, payloadBuffer]);
}

export const DEFAULT_CALENDARS = [
  'https://a.pool.opentimestamps.org/digest',
  'https://b.pool.opentimestamps.org/digest',
  'https://alice.btc.calendar.opentimestamps.org/digest',
  'https://bob.btc.calendar.opentimestamps.org/digest'
];

let _ots = null;
export async function getOpenTimestamps() {
  if (_ots) return _ots;
  try {
    const { createRequire } = await import('node:module');
    const req = createRequire(import.meta.url);
    _ots = req('opentimestamps');
    return _ots;
  } catch {
    return null;
  }
}

export async function loadManifest(root) {
  const manifestPath = path.join(root, 'static/proofs/manifest.json');
  try {
    const raw = await readFile(manifestPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { version: 1, articles: {} };
    }
    throw err;
  }
}

export async function saveManifest(root, manifest) {
  const proofsDir = path.join(root, 'static/proofs');
  await mkdir(proofsDir, { recursive: true });
  const manifestPath = path.join(proofsDir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

export function computeSha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function getGitCommit(root, filePath) {
  try {
    const commit = execSync(`git log -1 --format=%H -- "${filePath}"`, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim();
    if (commit) return commit;
  } catch {}

  try {
    const head = execSync('git rev-parse HEAD', {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim();
    if (head) return head;
  } catch {}

  return null;
}

export async function scanArticles(root) {
  const manifest = await loadManifest(root);
  const postsDir = path.join(root, 'content/posts');
  const files = (await readdir(postsDir)).filter(f => f.endsWith('.md')).sort();
  const results = [];
  const scannedIds = new Set();
  let manifestUpdated = false;

  for (const filename of files) {
    const filePath = path.join(postsDir, filename);
    const relPath = path.relative(root, filePath);
    const rawBuffer = await readFile(filePath);
    const rawText = rawBuffer.toString('utf8');
    const hash = computeSha256(rawBuffer);

    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(rawText);
    if (!match) continue;

    let frontmatter;
    try {
      frontmatter = YAML.parse(match[1]);
    } catch {
      continue;
    }

    const id = frontmatter.id;
    if (!id) continue;
    scannedIds.add(id);

    const isEnabled = frontmatter.timestamp !== false;
    const entry = manifest.articles?.[id];
    const latest = entry?.versions?.[entry.versions.length - 1];

    let status = 'UNTRACKED';
    let proposedVersion = 1;

    if (!isEnabled) {
      status = 'DISABLED';
      proposedVersion = latest ? latest.version : 1;
    } else if (latest) {
      if (latest.fileHash === hash) {
        status = 'UP_TO_DATE';
        proposedVersion = latest.version;
        // If file was renamed or moved but content is identical, sync currentPath in manifest
        if (entry.currentPath !== relPath) {
          entry.currentPath = relPath;
          delete entry.path;
          manifestUpdated = true;
        }
      } else {
        status = 'MODIFIED';
        proposedVersion = latest.version + 1;
      }
    }

    results.push({
      id,
      title: frontmatter.title || id,
      filename,
      filePath,
      relPath,
      fileHash: hash,
      status,
      timestampEnabled: isEnabled,
      proposedVersion,
      latestVersion: latest ? latest.version : null,
      proofStatus: latest ? latest.status : null,
      bitcoinBlock: latest ? latest.bitcoinBlock : null,
      bitcoinBlockTime: latest ? latest.bitcoinBlockTime : null,
      proofFile: latest ? latest.proofFile : null,
      previousPath: latest?.path || entry?.currentPath || null
    });
  }

  // Detect missing/deleted articles that still exist in the manifest
  for (const [manifestId, entry] of Object.entries(manifest.articles || {})) {
    if (!scannedIds.has(manifestId)) {
      const latest = entry.versions?.[entry.versions.length - 1];
      results.push({
        id: manifestId,
        title: manifestId,
        filename: path.basename(entry.currentPath || ''),
        filePath: path.join(root, entry.currentPath || ''),
        relPath: entry.currentPath || '',
        fileHash: latest?.fileHash || null,
        status: 'MISSING',
        proposedVersion: latest ? latest.version : 1,
        latestVersion: latest ? latest.version : null,
        proofStatus: latest ? latest.status : null,
        bitcoinBlock: latest ? latest.bitcoinBlock : null,
        bitcoinBlockTime: latest ? latest.bitcoinBlockTime : null,
        proofFile: latest ? latest.proofFile : null,
        previousPath: entry.currentPath || null
      });
    }
  }

  if (manifestUpdated) {
    await saveManifest(root, manifest);
  }

  return results;
}

export async function submitToCalendars(hashBuffer, calendars = DEFAULT_CALENDARS) {
  for (const url of calendars) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-sha256',
          'User-Agent': 'gf-blog-timestamp/1.0'
        },
        body: hashBuffer
      });
      if (response.ok) {
        const ab = await response.arrayBuffer();
        const buf = Buffer.from(ab);
        if (buf.length > 0) {
          return { buffer: buf, calendar: url };
        }
      }
    } catch (e) {
      // Continue to next calendar
    }
  }
  throw new Error(`Failed to submit hash to any OpenTimestamps calendar: ${calendars.join(', ')}`);
}

export async function stampArticle(root, targetIdOrPath, options = {}) {
  const articles = await scanArticles(root);
  const target = articles.find(a => a.id === targetIdOrPath || a.filename === targetIdOrPath || a.relPath === targetIdOrPath);

  if (!target) {
    throw new Error(`Article not found: "${targetIdOrPath}". Available IDs: ${articles.map(a => a.id).join(', ')}`);
  }

  if (!target.timestampEnabled && !options.force) {
    return {
      id: target.id,
      version: target.latestVersion || 1,
      skipped: true,
      reason: 'Timestamping disabled in frontmatter (timestamp: false)'
    };
  }

  if (target.status === 'UP_TO_DATE' && !options.force) {
    return {
      id: target.id,
      version: target.latestVersion,
      skipped: true,
      reason: `Already up-to-date at v${target.latestVersion} (${target.proofStatus})`
    };
  }

  const manifest = await loadManifest(root);
  const entry = manifest.articles[target.id] || {
    currentPath: target.relPath,
    versions: []
  };

  const newVersion = target.proposedVersion;
  const rawBuffer = await readFile(target.filePath);
  const rawHashBytes = createHash('sha256').update(rawBuffer).digest();
  const hexHash = rawHashBytes.toString('hex');

  let proofBuffer;
  let usedCalendar = null;

  if (options.mock) {
    // Deterministic mock OTS proof format for tests/offline
    proofBuffer = wrapDetachedProof(rawHashBytes, Buffer.from([0x00, 0x01, 0x02, 0x03]));
    usedCalendar = 'mock://local';
  } else {
    let stampedWithLibrary = false;
    const OpenTimestamps = await getOpenTimestamps();

    if (OpenTimestamps && !options.useFetch) {
      try {
        const detached = OpenTimestamps.DetachedTimestampFile.fromBytes(
          new OpenTimestamps.Ops.OpSHA256(),
          rawBuffer
        );
        const calendars = options.calendars || [
          'https://alice.btc.calendar.opentimestamps.org',
          'https://bob.btc.calendar.opentimestamps.org',
          'https://a.pool.opentimestamps.org',
          'https://b.pool.opentimestamps.org'
        ];
        await OpenTimestamps.stamp(detached, { calendars, m: 1 });
        proofBuffer = Buffer.from(detached.serializeToBytes());

        const attestations = Array.from(detached.timestamp.allAttestations().values());
        const uris = attestations
          .filter(a => a instanceof OpenTimestamps.Notary.PendingAttestation)
          .map(a => a.uri);
        usedCalendar = uris.join(', ') || 'opentimestamps-pool';
        stampedWithLibrary = true;
      } catch (libErr) {
        // Fallback to ots CLI or fetch below
      }
    }

    if (!stampedWithLibrary) {
      // Check if ots CLI exists
      let otsCliFound = false;
      try {
        execSync('which ots', { stdio: 'ignore' });
        otsCliFound = true;
      } catch {}

      if (otsCliFound && !options.useFetch) {
        const tempFile = path.join(root, `.temp-stamp-${target.id}-${Date.now()}`);
        try {
          await writeFile(tempFile, rawBuffer);
          execSync(`ots stamp "${tempFile}"`, { cwd: root, stdio: 'pipe' });
          proofBuffer = await readFile(`${tempFile}.ots`);
          usedCalendar = 'ots-cli';
        } finally {
          try { await stat(tempFile); await writeFile(tempFile, ''); } catch {}
          try { execSync(`rm -f "${tempFile}" "${tempFile}.ots"`); } catch {}
        }
      } else {
        const result = await submitToCalendars(rawHashBytes, options.calendars || DEFAULT_CALENDARS);
        proofBuffer = wrapDetachedProof(rawHashBytes, result.buffer);
        usedCalendar = result.calendar;
      }
    }
  }

  const proofDir = path.join(root, 'static/proofs', target.id);
  await mkdir(proofDir, { recursive: true });
  const proofFileName = `v${newVersion}.ots`;
  const proofRelPath = `static/proofs/${target.id}/${proofFileName}`;
  const proofAbsPath = path.join(proofDir, proofFileName);
  await writeFile(proofAbsPath, proofBuffer);

  const gitCommit = getGitCommit(root, target.filePath);

  const versionRecord = {
    version: newVersion,
    path: target.relPath,
    fileHash: hexHash,
    proofFile: proofRelPath,
    otsUrl: `/proofs/${target.id}/${proofFileName}`,
    stampedAt: new Date().toISOString(),
    status: options.initialStatus || 'pending',
    gitCommit: gitCommit || null,
    bitcoinBlock: options.bitcoinBlock || null,
    bitcoinBlockTime: options.bitcoinBlockTime || null
  };

  entry.currentPath = target.relPath;
  entry.versions.push(versionRecord);
  manifest.articles[target.id] = entry;
  await saveManifest(root, manifest);

  return {
    id: target.id,
    version: newVersion,
    proofFile: proofRelPath,
    calendar: usedCalendar,
    skipped: false
  };
}

export async function upgradeProofs(root, targetId = null, options = {}) {
  const OpenTimestamps = await getOpenTimestamps();
  if (!OpenTimestamps) {
    throw new Error('The "opentimestamps" npm package is required for proof upgrades. Run "npm install -D opentimestamps".');
  }

  const manifest = await loadManifest(root);
  const results = [];
  let manifestUpdated = false;

  for (const [id, article] of Object.entries(manifest.articles || {})) {
    if (targetId && id !== targetId) continue;
    const latest = article.versions?.[article.versions.length - 1];
    if (!latest) continue;

    const proofAbsPath = path.join(root, latest.proofFile);
    let proofBuf;
    try {
      proofBuf = await readFile(proofAbsPath);
    } catch {
      results.push({ id, version: latest.version, upgraded: false, status: latest.status, error: 'Proof file missing' });
      continue;
    }

    let detached;
    try {
      detached = OpenTimestamps.DetachedTimestampFile.deserialize(proofBuf);
    } catch (err) {
      results.push({ id, version: latest.version, upgraded: false, status: latest.status, error: `Invalid proof format: ${err.message}` });
      continue;
    }

    if (detached.timestamp.isTimestampComplete()) {
      const attestations = Array.from(detached.timestamp.allAttestations().values());
      const btc = attestations.find(a => a instanceof OpenTimestamps.Notary.BitcoinBlockHeaderAttestation);
      if (btc && (latest.status !== 'anchored' || latest.bitcoinBlock !== btc.height)) {
        latest.status = 'anchored';
        latest.bitcoinBlock = btc.height;
        manifestUpdated = true;
      }
      results.push({ id, version: latest.version, upgraded: false, status: 'anchored', alreadyComplete: true, bitcoinBlock: latest.bitcoinBlock || btc?.height });
      continue;
    }

    try {
      const changed = await OpenTimestamps.upgrade(detached);
      if (changed) {
        const upgradedBuf = Buffer.from(detached.serializeToBytes());
        await writeFile(proofAbsPath, upgradedBuf);

        const attestations = Array.from(detached.timestamp.allAttestations().values());
        const btc = attestations.find(a => a instanceof OpenTimestamps.Notary.BitcoinBlockHeaderAttestation);

        if (btc) {
          latest.status = 'anchored';
          latest.bitcoinBlock = btc.height;
        } else if (detached.timestamp.isTimestampComplete()) {
          latest.status = 'anchored';
        }

        manifestUpdated = true;
        results.push({ id, version: latest.version, upgraded: true, status: latest.status, bitcoinBlock: latest.bitcoinBlock });
      } else {
        results.push({ id, version: latest.version, upgraded: false, status: latest.status, bitcoinBlock: latest.bitcoinBlock, pending: true });
      }
    } catch (err) {
      results.push({ id, version: latest.version, upgraded: false, status: latest.status, error: err.message });
    }
  }

  if (manifestUpdated) {
    await saveManifest(root, manifest);
  }

  return results;
}

export async function getProofInfo(root, targetIdOrPath) {
  const OpenTimestamps = await getOpenTimestamps();
  if (!OpenTimestamps) {
    throw new Error('The "opentimestamps" npm package is required for inspecting proofs. Run "npm install -D opentimestamps".');
  }

  const manifest = await loadManifest(root);
  const entry = manifest.articles?.[targetIdOrPath];
  let proofRelPath;

  if (entry) {
    const latest = entry.versions?.[entry.versions.length - 1];
    proofRelPath = latest?.proofFile;
  } else if (targetIdOrPath.endsWith('.ots')) {
    proofRelPath = targetIdOrPath;
  } else {
    const articles = await scanArticles(root);
    const found = articles.find(a => a.id === targetIdOrPath || a.filename === targetIdOrPath || a.relPath === targetIdOrPath);
    if (found?.proofFile) {
      proofRelPath = found.proofFile;
    }
  }

  if (!proofRelPath) {
    throw new Error(`Proof not found for "${targetIdOrPath}".`);
  }

  const proofAbsPath = path.isAbsolute(proofRelPath) ? proofRelPath : path.join(root, proofRelPath);
  const proofBuf = await readFile(proofAbsPath);
  const detached = OpenTimestamps.DetachedTimestampFile.deserialize(proofBuf);
  return OpenTimestamps.info(detached);
}

export function generatePostId(title, existingIds = new Set()) {
  let base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[-\s]+/g, '-');

  if (!base) base = 'post';

  let candidate = base;
  let counter = 1;
  while (existingIds.has(candidate)) {
    counter++;
    candidate = `${base}-${counter}`;
  }
  return candidate;
}

export async function installGitHook(root) {
  const gitDir = path.join(root, '.git');
  try {
    const st = await stat(gitDir);
    if (!st.isDirectory()) return { skipped: true, reason: '.git is not a directory' };
  } catch {
    return { skipped: true, reason: 'Not a git repository (missing .git directory)' };
  }

  const hooksDir = path.join(gitDir, 'hooks');
  await mkdir(hooksDir, { recursive: true });

  // Pre-push hook: strictly blocks pushing unanchored articles to public remote
  const prePushPath = path.join(hooksDir, 'pre-push');
  const prePushContent = `#!/bin/sh
# OpenTimestamps pre-push check: block public leak of unanchored content
node scripts/timestamp.mjs check --push
`;
  await writeFile(prePushPath, prePushContent, 'utf8');
  await chmod(prePushPath, 0o755);

  // If a pre-commit hook exists from previous setup, remove it so local commits are completely unhindered
  const preCommitPath = path.join(hooksDir, 'pre-commit');
  try {
    const existing = await readFile(preCommitPath, 'utf8');
    if (existing.includes('timestamp.mjs')) {
      const { rm } = await import('node:fs/promises');
      await rm(preCommitPath, { force: true });
    }
  } catch {}

  return { skipped: false, prePushPath };
}

// CLI Router
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'status';
  const root = path.resolve(fileURLToPath(import.meta.url), '../..');

  if (cmd === 'status') {
    const articles = await scanArticles(root);
    console.log('\nOpenTimestamps Provenance Status:\n' + '─'.repeat(78));

    let okCount = 0;
    let modCount = 0;
    let untrackedCount = 0;

    for (const a of articles) {
      if (a.status === 'UP_TO_DATE') {
        okCount++;
        const block = a.bitcoinBlock ? ` #Block ${a.bitcoinBlock}` : ' (pending confirmation)';
        console.log(`  ✓ \x1b[32m${a.id.padEnd(35)}\x1b[0m v${a.latestVersion} [${a.proofStatus}${block}]`);
      } else if (a.status === 'MODIFIED') {
        modCount++;
        console.log(`  ! \x1b[33m${a.id.padEnd(35)}\x1b[0m MODIFIED (current hash differs from v${a.latestVersion}) -> Propose v${a.proposedVersion}`);
      } else if (a.status === 'DISABLED') {
        console.log(`  ⊘ \x1b[90m${a.id.padEnd(35)}\x1b[0m OPTED OUT (timestamp: false)`);
      } else if (a.status === 'MISSING') {
        console.log(`  ? \x1b[31m${a.id.padEnd(35)}\x1b[0m MISSING on disk (last known at ${a.relPath})`);
      } else {
        untrackedCount++;
        console.log(`  + \x1b[36m${a.id.padEnd(35)}\x1b[0m UNTRACKED -> Propose v1`);
      }
    }

    console.log('─'.repeat(78));
    console.log(`Summary: ${okCount} up-to-date, ${modCount} modified, ${untrackedCount} untracked.`);
    if (modCount > 0 || untrackedCount > 0) {
      console.log('\nTo stamp pending changes, run:');
      console.log('  npm run timestamp:stamp -- --all');
    }
    console.log();
    return;
  }

  if (cmd === 'stamp') {
    const targetArg = args.find(a => !a.startsWith('-') && a !== 'stamp');
    const isAll = args.includes('--all');
    const isMock = args.includes('--mock');
    const isForce = args.includes('--force');

    const articles = await scanArticles(root);
    const targets = [];

    if (targetArg) {
      const match = articles.find(a => a.id === targetArg || a.filename === targetArg || a.relPath === targetArg);
      if (!match) {
        console.error(`Article "${targetArg}" not found.`);
        process.exit(1);
      }
      targets.push(match);
    } else if (isAll) {
      for (const a of articles) {
        if (a.status !== 'UP_TO_DATE' || isForce) {
          targets.push(a);
        }
      }
    } else {
      console.log('Usage:');
      console.log('  node scripts/timestamp.mjs stamp <article-id> [--mock] [--force]');
      console.log('  node scripts/timestamp.mjs stamp --all [--mock] [--force]');
      console.log('\nRun "node scripts/timestamp.mjs status" to inspect current articles.');
      return;
    }

    if (targets.length === 0) {
      console.log('All articles are already up-to-date with OpenTimestamps.');
      return;
    }

    console.log(`Stamping ${targets.length} article(s)...`);
    for (const t of targets) {
      try {
        const result = await stampArticle(root, t.id, { mock: isMock, force: isForce });
        if (result.skipped) {
          console.log(`  - ${result.id}: ${result.reason}`);
        } else {
          console.log(`  ✓ ${result.id} -> v${result.version} (${result.proofFile}) via ${result.calendar}`);
        }
      } catch (err) {
        console.error(`  ✖ Failed to stamp ${t.id}: ${err.message}`);
      }
    }
    console.log('\nDone. Proofs written to static/proofs/ and updated in manifest.json.');
    return;
  }

  if (cmd === 'check') {
    const isPush = args.includes('--push');
    const isStrict = args.includes('--strict') || isPush;
    const articles = await scanArticles(root);
    const unanchored = articles.filter(a => a.status === 'MODIFIED' || a.status === 'UNTRACKED');

    if (unanchored.length === 0) {
      console.log('✓ OpenTimestamps check: All articles are anchored and up-to-date.');
      return;
    }

    console.error('\n\x1b[31m========================================================================\x1b[0m');
    console.error(`\x1b[31m[OpenTimestamps] ${isPush ? 'PUSH BLOCKED: Public repository protection' : 'VERIFICATION NOTICE'}\x1b[0m`);
    console.error('\x1b[31m========================================================================\x1b[0m');
    console.error(`The following ${unanchored.length} article(s) have unanchored content:`);
    for (const a of unanchored) {
      if (a.status === 'MODIFIED') {
        console.error(`  - \x1b[33m${a.relPath}\x1b[0m: modified since v${a.latestVersion} (propose v${a.proposedVersion})`);
      } else {
        console.error(`  - \x1b[36m${a.relPath}\x1b[0m: untracked (propose v1)`);
      }
    }
    console.error('\n\x1b[1mDo not push unanchored content to a public repository!\x1b[0m');
    console.error('Anyone observing your commits could submit the same hash to the same block.');
    console.error('\nTo anchor before pushing:');
    console.error('  1. npm run timestamp:stamp -- --all');
    console.error('  2. git add static/proofs/ content/posts/ && git commit -m "docs: anchor in OpenTimestamps"');
    console.error('  3. git push');
    console.error('\x1b[31m========================================================================\x1b[0m\n');

    if (isStrict) {
      process.exit(1);
    }
    return;
  }

  if (cmd === 'upgrade') {
    const targetArg = args.find(a => !a.startsWith('-') && a !== 'upgrade');
    console.log('Checking OpenTimestamps calendars for Bitcoin confirmation...');
    const results = await upgradeProofs(root, targetArg);
    let upgradedCount = 0;
    for (const r of results) {
      if (r.upgraded) {
        upgradedCount++;
        console.log(`  ✓ \x1b[32m${r.id.padEnd(35)}\x1b[0m UPGRADED -> anchored on Bitcoin block #${r.bitcoinBlock}`);
      } else if (r.alreadyComplete) {
        console.log(`  ✓ \x1b[32m${r.id.padEnd(35)}\x1b[0m already anchored (block #${r.bitcoinBlock})`);
      } else if (r.error) {
        console.log(`  ! \x1b[33m${r.id.padEnd(35)}\x1b[0m error: ${r.error}`);
      } else {
        console.log(`  ⏳ \x1b[36m${r.id.padEnd(35)}\x1b[0m pending confirmation on Bitcoin (calendars batch every ~2 hours)`);
      }
    }
    console.log(`\nSummary: ${upgradedCount} proof(s) upgraded.`);
    return;
  }

  if (cmd === 'info') {
    const targetArg = args.find(a => !a.startsWith('-') && a !== 'info');
    if (!targetArg) {
      console.log('Usage:');
      console.log('  node scripts/timestamp.mjs info <article-id|path/to/proof.ots>');
      return;
    }
    try {
      const infoText = await getProofInfo(root, targetArg);
      console.log(infoText);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  if (cmd === 'hook:install') {
    try {
      const res = await installGitHook(root);
      if (res.skipped) {
        console.log(`ℹ Git hooks skipped: ${res.reason}`);
      } else {
        console.log(`✓ Git pre-push hook installed at ${res.prePushPath}`);
      }
    } catch (err) {
      console.warn(`ℹ Git hook installation note: ${err.message}`);
    }
    return;
  }

  if (cmd === 'new-id') {
    const isUuid = args.includes('--uuid');
    if (isUuid) {
      console.log(randomUUID());
      return;
    }
    const titleArg = args.slice(1).filter(a => !a.startsWith('-')).join(' ');
    if (!titleArg) {
      console.log('Usage: node scripts/timestamp.mjs new-id "Article Title"');
      console.log('       node scripts/timestamp.mjs new-id --uuid');
      return;
    }
    const articles = await scanArticles(root);
    const existingIds = new Set(articles.map(a => a.id));
    const newId = generatePostId(titleArg, existingIds);
    console.log(newId);
    return;
  }

  console.error(`Unknown command: "${cmd}". Available commands: status, stamp, upgrade, info, check, hook:install, new-id`);
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
