#!/usr/bin/env node
/**
 * build-watch.mjs — monitor the latest Docker Hub release workflow on GitHub Actions
 *
 * Usage:
 *   node scripts/build-watch.mjs          # watch the latest run
 *   node scripts/build-watch.mjs --list   # list recent runs without watching
 *
 * Prerequisites:
 *   gh auth login   (GitHub CLI, one-time setup)
 *
 * The release workflow triggers automatically when a vX.Y.Z tag is pushed.
 * Use this after `node scripts/release.mjs <version>` to watch the build.
 */

import { execSync, spawnSync } from 'child_process';

const LIST_ONLY = process.argv.includes('--list');

const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';

// Check gh is available
try {
  execSync('gh --version', { stdio: 'ignore' });
} catch {
  console.error('GitHub CLI (gh) is not installed.');
  console.error('Install: https://cli.github.com/');
  process.exit(1);
}

// Check gh is authenticated
try {
  execSync('gh auth status', { stdio: 'ignore' });
} catch {
  console.error(`Not authenticated. Run: ${BOLD}gh auth login${RESET}`);
  process.exit(1);
}

// Get recent runs for the release workflow
let runs;
try {
  const out = execSync(
    'gh run list --workflow=release.yml --limit=5 --json databaseId,displayTitle,status,conclusion,createdAt,url',
    { stdio: ['ignore', 'pipe', 'pipe'] }
  ).toString();
  runs = JSON.parse(out);
} catch (err) {
  console.error('Failed to fetch workflow runs. Is this a GitHub repo with gh configured?');
  console.error(err.message);
  process.exit(1);
}

if (runs.length === 0) {
  console.log('No release workflow runs found.');
  process.exit(0);
}

function statusColor(status, conclusion) {
  if (status === 'completed') {
    if (conclusion === 'success') return GREEN;
    if (conclusion === 'failure') return RED;
    return YELLOW;
  }
  if (status === 'in_progress') return YELLOW;
  return DIM;
}

function statusLabel(status, conclusion) {
  if (status === 'completed') return conclusion ?? status;
  if (status === 'in_progress') return 'running';
  return status;
}

console.log(`\n${BOLD}Recent release runs:${RESET}`);
for (const run of runs) {
  const color  = statusColor(run.status, run.conclusion);
  const label  = statusLabel(run.status, run.conclusion).padEnd(10);
  const date   = new Date(run.createdAt).toLocaleString();
  console.log(`  ${color}${label}${RESET}  ${run.displayTitle}  ${DIM}${date}${RESET}`);
}
console.log();

if (LIST_ONLY) process.exit(0);

const latest = runs[0];
const isActive = latest.status === 'queued' || latest.status === 'in_progress';
const isDone   = latest.status === 'completed';

if (isDone) {
  const color = statusColor(latest.status, latest.conclusion);
  console.log(`Latest run already completed: ${color}${latest.conclusion}${RESET}`);
  console.log(`${DIM}${latest.url}${RESET}\n`);
  process.exit(latest.conclusion === 'success' ? 0 : 1);
}

if (isActive) {
  console.log(`${YELLOW}Watching run: ${latest.displayTitle}${RESET}`);
  console.log(`${DIM}${latest.url}${RESET}\n`);
}

// gh run watch streams live logs and exits when done
const result = spawnSync('gh', ['run', 'watch', String(latest.databaseId), '--exit-status'], {
  stdio: 'inherit',
});

process.exit(result.status ?? 0);
