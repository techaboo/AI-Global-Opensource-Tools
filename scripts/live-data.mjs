/**
 * Moves machine-generated state between the working tree and the `live-data`
 * branch, so hourly/daily bot output never lands on main.
 *
 *   node scripts/live-data.mjs pull   # copy files from origin/live-data into the tree
 *   node scripts/live-data.mjs push   # commit tree copies onto live-data and push (CI only)
 *
 * pull is safe to run anywhere (local dev, CI, deploy) and is a no-op if the branch
 * doesn't exist yet. push retries on a non-fast-forward by rebuilding on the new tip.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ROOT as REPO_ROOT } from './catalog.mjs';

// Overridable so tests can run the real push/pull against a throwaway repo.
const ROOT = process.env.LIVE_DATA_ROOT || REPO_ROOT;

export const BRANCH = 'live-data';
// Path inside the working tree -> path on the live-data branch.
export const FILES = {
  'public/live-snapshot.json': 'live-snapshot.json',
  'audits/discover-rejects.json': 'audits/discover-rejects.json',
  'audits/state.json': 'audits/state.json',
  'audits/latest-report.md': 'audits/latest-report.md',
};

const git = (args, opts = {}) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], ...opts });

function fetchBranch() {
  try {
    git(['fetch', '--quiet', 'origin', `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`]);
    return true;
  } catch {
    return false;
  }
}

function pull() {
  if (!fetchBranch()) {
    console.log(`No ${BRANCH} branch on origin yet; nothing to pull.`);
    return;
  }
  for (const [local, remote] of Object.entries(FILES)) {
    // ls-tree first so "not created yet" is distinguished from a real read failure,
    // which must fail loudly: silently skipping would reset accumulated history.
    if (!git(['ls-tree', '--name-only', `origin/${BRANCH}`, '--', remote]).trim()) continue;
    const content = execFileSync('git', ['show', `origin/${BRANCH}:${remote}`], { cwd: ROOT, maxBuffer: 512 * 1024 * 1024 });
    const target = join(ROOT, local);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
    console.log(`✓ ${local} <- ${BRANCH}:${remote}`);
  }
}

function push(message) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const exists = fetchBranch();
    const dir = join(mkdtempSync(join(tmpdir(), 'live-data-')), 'wt'); // must not pre-exist for worktree add
    try {
      if (exists) git(['worktree', 'add', '--quiet', '--detach', dir, `origin/${BRANCH}`]);
      else {
        // First run ever: start an empty orphan history for the data branch.
        git(['worktree', 'add', '--quiet', '--detach', dir]);
        git(['checkout', '--quiet', '--orphan', `${BRANCH}-init-${process.pid}`], { cwd: dir });
        git(['rm', '-rf', '--quiet', '--ignore-unmatch', '.'], { cwd: dir });
      }
      for (const [local, remote] of Object.entries(FILES)) {
        const source = join(ROOT, local);
        if (!existsSync(source)) continue;
        mkdirSync(dirname(join(dir, remote)), { recursive: true });
        copyFileSync(source, join(dir, remote));
        git(['add', remote], { cwd: dir });
      }
      const staged = git(['diff', '--cached', '--name-only'], { cwd: dir }).trim();
      if (!staged) {
        console.log('live-data unchanged; nothing to push.');
        return;
      }
      git(['commit', '--quiet', '-m', message], { cwd: dir });
      try {
        git(['push', '--quiet', 'origin', `HEAD:refs/heads/${BRANCH}`], { cwd: dir });
        console.log(`✓ Pushed ${staged.split('\n').length} file(s) to ${BRANCH}.`);
        return;
      } catch (error) {
        console.warn(`Push to ${BRANCH} rejected (attempt ${attempt}): ${error.stderr || error.message}`);
      }
    } finally {
      try { git(['worktree', 'remove', '--force', dir]); } catch { rmSync(dir, { recursive: true, force: true }); }
      try { git(['branch', '-D', `${BRANCH}-init-${process.pid}`]); } catch { /* only exists on first run */ }
    }
  }
  throw new Error(`Could not push to ${BRANCH} after 4 attempts.`);
}

const [command, ...rest] = process.argv.slice(2);
if (command === 'pull') pull();
else if (command === 'push') push(rest.join(' ') || `chore: update live data (${new Date().toISOString()})`);
else {
  console.error('Usage: node scripts/live-data.mjs pull|push [commit message]');
  process.exit(2);
}
