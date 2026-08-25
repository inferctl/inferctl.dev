#!/usr/bin/env node
// Build the Astro docs collection from inferctl's code-repository docs. The
// generated directory is recreated on each run. Network failures use committed
// fallback pages; invalid source pages remain build failures.

import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = process.env.INFERCTL_DOCS_REPO ?? 'inferctl/inferctl';
const ref = process.env.INFERCTL_DOCS_REF ?? 'main';
const docsSubdir = process.env.INFERCTL_DOCS_DIR ?? 'docs';
const localRepo = process.env.INFERCTL_LOCAL_REPO;
const siteRoot = fileURLToPath(new URL('..', import.meta.url));
const buildDir = join(siteRoot, '.docs-build');
const fallbackDir = join(siteRoot, 'src', 'content', '_docs-fallback');
const seedFallback = process.argv.includes('--seed-fallback');

const pages = [
  ['overview', 'repo.md', 'Project Overview', 'Learn what inferctl does and where its source code lives.', 'project', 5],
  ['landscape', 'top/landscape.md', 'Landscape', 'See where inferctl fits in the local inference tooling stack.', 'project', 10],
  ['comparison', 'top/comparison.md', 'Comparison', 'Compare inferctl with local inference CLIs, process swappers, and proxies.', 'project', 20],
  ['install', 'install.md', 'Install', 'Install inferctl from source or with the Go toolchain.', 'guides', 10],
  ['agent-guide', 'agent-guide.md', 'Agent Guide', 'Use inferctl safely from automated and agent-driven workflows.', 'guides', 20],
  ['verbs', 'verbs.md', 'Command Reference', 'Review inferctl commands, arguments, flags, and examples.', 'guides', 30],
  ['robot-docs-guide', 'cmd/robot-docs-guide.md', 'Robot Docs Guide', 'Use the inferctl machine-readable documentation interface.', 'guides', 40],
  ['examples/agent-discovery', 'examples/agent-discovery.md', 'Agent Discovery Demo', 'Use inferctl discovery in an agent workflow.', 'guides', 50],
  ['examples/agent-drift-debug', 'examples/agent-drift-debug.md', 'Agent Drift Debug', 'Explain routing changes with inferctl snapshots.', 'guides', 51],
  ['examples/ci-markdown-summary', 'examples/ci-markdown-summary.md', 'CI Markdown Summary', 'Add inferctl preflight results to CI output.', 'guides', 52],
  ['examples/editor-configs', 'examples/editor-configs.md', 'Editor Config Generator', 'Generate local model settings from inferctl output.', 'guides', 53],
  ['examples/preflight-gate', 'examples/preflight-gate.md', 'Preflight Gate', 'Check local inference readiness before an automated task.', 'guides', 54],
  ['examples/routing-explainer', 'examples/routing-explainer.md', 'Routing Explainer', 'Explain local inference routing decisions in the terminal.', 'guides', 55],
  ['examples/status-dashboard', 'examples/status-dashboard.md', 'Status Dashboard', 'Explore a deterministic inferctl status scenario.', 'guides', 56],
  ['examples/team-requirements', 'examples/team-requirements.md', 'Team Requirements', 'Verify team local inference requirements.', 'guides', 57],
  ['errors', 'errors.md', 'Error Catalog', 'Find inferctl error and warning codes with remediation guidance.', 'project', 40],
  ['roadmap', 'top/roadmap.md', 'Roadmap', 'Track delivered work, current work, and planned inferctl changes.', 'project', 50],
  ['public-readiness', 'public-readiness.md', 'Public Readiness', 'Review the current public release posture for inferctl.', 'project', 60],
  ['releasing', 'top/releasing.md', 'Releasing', 'Review the inferctl release procedure and constraints.', 'project', 65],
  ['lineage', 'lineage.md', 'Lineage', 'Learn how inferctl relates to the Ozhiaki tool family.', 'project', 70],
  ['security', 'top/security.md', 'Security', 'Learn how to report an inferctl security issue.', 'project', 75],
  ['contributing', 'top/contributing.md', 'Contributing', 'Learn how to contribute to inferctl.', 'project', 80],
  ['verified-runs', 'verified-runs/README.md', 'Verified Runs', 'Review curated public provider validation evidence.', 'project', 90],
  ['verified-runs/ollama', 'verified-runs/2026-06-25-ollama-linux-local/summary.md', 'Ollama Verified Run', 'Review the curated local Ollama validation result.', 'project', 91],
  ['verified-runs/llama-cpp', 'verified-runs/2026-06-25-llamacpp-qwen25-linux-local/summary.md', 'llama.cpp Verified Run', 'Review the curated local llama.cpp validation result.', 'project', 92],
  ['verified-runs/openai-compatible', 'verified-runs/2026-06-25-openai-compat-qwen25-linux-local/summary.md', 'OpenAI-Compatible Verified Run', 'Review the curated OpenAI-compatible validation result.', 'project', 93],
  ['verified-runs/lm-studio', '../verified-runs/2026-06-25-lmstudio-qwen25-linux-local/summary.md', 'LM Studio Verified Run', 'Review the curated local LM Studio validation result.', 'project', 94],
  ['verified-runs/mlx', 'verified-runs/2026-06-25-mlx-qwen25-macos-local/summary.md', 'MLX Verified Run', 'Review the curated local MLX validation result.', 'project', 95],
  ['changelog', '../CHANGELOG.md', 'Changelog', 'Read the inferctl release history.', 'project', 99],
].map(([id, source, title, description, bucket, order]) => ({ id, source, title, description, bucket, order }));

const bySource = new Map(pages.map((page) => [page.source, page.id]));
// The local MkDocs link still uses an older macOS directory name. Its artifact
// was recorded under the Linux directory below, so keep that published route.
bySource.set('verified-runs/2026-06-25-lmstudio-qwen25-macos-local/summary.md', 'verified-runs/lm-studio');
bySource.set('verified-runs/2026-06-25-lmstudio-qwen25-linux-local/summary.md', 'verified-runs/lm-studio');
const warning = (message) => console.warn(`[sync-docs] ${message}`);

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, '');
}

function sourceMetadata(markdown, source) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) throw new Error(`missing frontmatter in ${source}`);
  const values = Object.fromEntries(match[1].split(/\r?\n/).map((line) => {
    const separator = line.indexOf(':');
    return separator === -1 ? [line, ''] : [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^"|"$/g, '')];
  }));
  for (const key of ['title', 'description', 'bucket', 'order']) {
    if (!values[key]) throw new Error(`missing ${key} frontmatter in ${source}`);
  }
  if (!['guides', 'concepts', 'project'].includes(values.bucket)) {
    throw new Error(`invalid bucket frontmatter in ${source}`);
  }
  if (!Number.isFinite(Number(values.order))) {
    throw new Error(`invalid order frontmatter in ${source}`);
  }
  return values;
}

function frontmatter(page) {
  return [
    '---',
    `title: ${JSON.stringify(page.title)}`,
    `description: ${JSON.stringify(page.description)}`,
    `bucket: ${page.bucket}`,
    `order: ${page.order}`,
    '---',
    '',
  ].join('\n');
}

function rewriteLinks(markdown, source, pageIdsBySource) {
  return markdown.replace(/(!?)\]\(([^)\s#]+)(#[^)\s]+)?\)/g, (full, image, target, anchor = '') => {
    if (target.startsWith('/') || /^[a-z]+:/i.test(target)) return full;

    const targetPath = posix.normalize(posix.join(posix.dirname(source), target));
    const docsPath = targetPath.startsWith(`${docsSubdir}/`)
      ? targetPath.slice(docsSubdir.length + 1)
      : `../${targetPath}`;
    const id = target.endsWith('.md')
      ? pageIdsBySource.get(targetPath) ?? bySource.get(docsPath)
      : undefined;
    if (id) return `${image}](/docs/${id}/${anchor})`;

    const baseUrl = image
      ? `https://raw.githubusercontent.com/${repo}/${ref}/${targetPath}`
      : `https://github.com/${repo}/blob/${ref}/${targetPath}`;
    return `${image}](${baseUrl}${anchor})`;
  });
}

function writePages(repoRoot) {
  const sourceDocs = join(repoRoot, docsSubdir);
  if (!existsSync(sourceDocs)) throw new Error(`missing ${docsSubdir}/ in selected source`);
  const pageIdsBySource = new Map();
  for (const page of pages) {
    const sourcePath = page.source.startsWith('../')
      ? join(repoRoot, page.source.slice(3))
      : join(sourceDocs, page.source);
    if (!existsSync(sourcePath)) throw new Error(`missing allowlisted source ${page.source}`);
    pageIdsBySource.set(relative(realpathSync(repoRoot), realpathSync(sourcePath)).replaceAll('\\', '/'), page.id);
  }
  for (const page of pages) {
    const sourcePath = page.source.startsWith('../')
      ? join(repoRoot, page.source.slice(3))
      : join(sourceDocs, page.source);
    if (!existsSync(sourcePath)) throw new Error(`missing allowlisted source ${page.source}`);
    const markdown = readFileSync(sourcePath, 'utf8');
    const source = relative(realpathSync(repoRoot), realpathSync(sourcePath)).replaceAll('\\', '/');
    // Direct docs must declare their own typed metadata. Symlink pages retain
    // the manifest metadata because their targets are code artifacts outside
    // docs/ (README, release guides, and runnable examples).
    if (!page.source.startsWith('../') && !lstatSync(sourcePath).isSymbolicLink()) {
      const metadata = sourceMetadata(markdown, page.source);
      for (const key of ['title', 'description', 'bucket', 'order']) {
        if (String(metadata[key]) !== String(page[key])) {
          throw new Error(`${key} in ${page.source} differs from the page manifest`);
        }
      }
    }
    const output = join(buildDir, `${page.id}.md`);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, frontmatter(page) + rewriteLinks(stripFrontmatter(markdown), source, pageIdsBySource));
  }
}

async function fetchRemoteSource() {
  const url = `https://codeload.github.com/${repo}/tar.gz/refs/heads/${ref}`;
  let archive;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      warning(`fetch ${url} returned ${response.status}`);
      return null;
    }
    archive = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    warning(`fetch failed: ${error?.message ?? error}`);
    return null;
  }

  const work = mkdtempSync(join(tmpdir(), 'inferctl-docs-'));
  try {
    const tarball = join(work, 'repo.tar.gz');
    writeFileSync(tarball, archive);
    const listing = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' });
    const top = listing.split('\n', 1)[0]?.split('/', 1)[0];
    if (!top) throw new Error('empty tarball');
    // Extract the full repository so allowed docs symlinks can resolve safely.
    execFileSync('tar', ['-xzf', tarball, '-C', work], { stdio: 'pipe' });
    return { root: join(work, top), cleanup: () => rmSync(work, { recursive: true, force: true }) };
  } catch (error) {
    warning(`extract failed: ${error?.message ?? error}`);
    rmSync(work, { recursive: true, force: true });
    return null;
  }
}

function useFallback() {
  if (!existsSync(fallbackDir)) throw new Error('committed docs fallback is missing');
  cpSync(fallbackDir, buildDir, { recursive: true });
  console.log('[sync-docs] built .docs-build from committed fallback');
}

async function main() {
  rmSync(buildDir, { recursive: true, force: true });
  mkdirSync(buildDir, { recursive: true });

  if (localRepo) {
    writePages(localRepo);
    console.log(`[sync-docs] built .docs-build from local source ${localRepo}`);
  } else {
    const remote = await fetchRemoteSource();
    if (!remote) {
      useFallback();
      return;
    }
    try {
      writePages(remote.root);
      console.log(`[sync-docs] built .docs-build from ${repo}@${ref}`);
    } finally {
      remote.cleanup();
    }
  }

  if (seedFallback) {
    rmSync(fallbackDir, { recursive: true, force: true });
    mkdirSync(dirname(fallbackDir), { recursive: true });
    cpSync(buildDir, fallbackDir, { recursive: true });
    console.log('[sync-docs] refreshed committed fallback from selected source');
  }
}

try {
  await main();
} catch (error) {
  console.error(`[sync-docs] ${error?.message ?? error}`);
  process.exit(1);
}
