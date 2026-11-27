import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';
import { ROOT } from './catalog.mjs';

// A workflow file that fails to parse silently disables a scheduled bot
// (GitHub just records a "workflow file issue"), so parse every one in CI.
const dir = join(ROOT, '.github/workflows');

describe('GitHub workflow files', () => {
  it('publishes the stats snapshot even when some repos failed to refresh', () => {
    const wf = parseDocument(readFileSync(join(dir, 'refresh-stars.yml'), 'utf8')).toJS();
    const publish = wf.jobs.refresh.steps.find(s => s.name === 'Publish snapshot to live-data');
    // fetch-stars exits 1 after writing a partial snapshot, which holds the 404 history.
    expect(publish.if).toBe("${{ !cancelled() && steps.fetch.conclusion != 'skipped' }}");
  });

  it('alerts from a separate job, so a timeout or bad token is still reported', () => {
    for (const file of ['discover-tools.yml', 'refresh-stars.yml', 'deploy-pages.yml']) {
      const { alert } = parseDocument(readFileSync(join(dir, file), 'utf8')).toJS().jobs;
      expect(alert.needs, file).toBeTruthy();
      expect(alert.steps[0].with?.token, file).toBeUndefined();
    }
  });

  it('pins every action to a commit SHA', () => {
    for (const file of readdirSync(dir)) {
      for (const [, ref] of readFileSync(join(dir, file), 'utf8').matchAll(/uses:\s*(\S+)/g)) expect(ref, file).toMatch(/@[0-9a-f]{40}$/);
    }
  });

  it('never interpolates untrusted input into a shell script', () => {
    for (const file of readdirSync(dir)) {
      const wf = parseDocument(readFileSync(join(dir, file), 'utf8')).toJS();
      for (const job of Object.values(wf.jobs)) {
        for (const step of job.steps ?? []) expect(step.run ?? '', file).not.toMatch(/\$\{\{\s*(inputs|github\.event)\./);
      }
    }
  });

  it('runs the daily pipeline in order: pull, re-check, prune, discover, verify, publish', () => {
    const wf = parseDocument(readFileSync(join(dir, 'discover-tools.yml'), 'utf8')).toJS();
    const runs = wf.jobs.pipeline.steps.map(s => s.run ?? '').join('\n');
    const order = ['live-data.mjs pull', 'fetch-stars.mjs --update', 'prune-stale.mjs', 'discover-tools.mjs', 'verify-catalog.mjs', 'open-bot-pr.sh', 'check-live.mjs'];
    const at = order.map(marker => runs.indexOf(marker));
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(at[0]).toBeGreaterThanOrEqual(0);
  });

  // An expired PAT stopped every bot run on 2026-11-26: `secrets.PAT || GITHUB_TOKEN`
  // only falls back when the secret is empty, not when GitHub rejects it.
  for (const [file, job] of [['discover-tools.yml', 'pipeline'], ['refresh-stars.yml', 'refresh']]) {
    it(`${file} checks the PAT before checkout and falls back to the built-in token`, () => {
      const text = readFileSync(join(dir, file), 'utf8');
      const wf = parseDocument(text).toJS();
      const [pick, checkout] = wf.jobs[job].steps;
      expect(pick.name).toBe('Pick a working bot token');
      expect(pick.env.PAT).toBe('${{ secrets.KIMI_GITHUB_API }}');
      expect(pick.env.FALLBACK).toBe('${{ github.token }}');
      expect(pick.run).toContain('BOT_TOKEN_KIND=');
      expect(checkout.uses).toMatch(/^actions\/checkout@/);
      expect(checkout.with.token).toBe('${{ env.BOT_TOKEN }}');
      // The PAT is read in exactly one place; everything else uses the checked token.
      expect(text.match(/secrets\.KIMI_GITHUB_API/g)).toHaveLength(1);
      expect(wf.jobs[job].outputs.pat).toBe('${{ steps.token.outputs.pat }}');
      expect(wf.jobs['token-alert'].if).toContain(`needs.${job}.outputs.pat == 'failed'`);
      expect(wf.permissions.actions).toBe('write');
    });
  }

  it('lets the bot start CI, whose checks branch protection requires', () => {
    const wf = parseDocument(readFileSync(join(dir, 'ci.yml'), 'utf8')).toJS();
    expect(Object.keys(wf.on)).toContain('workflow_dispatch');
  });

  for (const file of readdirSync(dir).filter(f => /\.ya?ml$/.test(f))) {
    it(`${file} is valid YAML with triggers and jobs`, () => {
      const doc = parseDocument(readFileSync(join(dir, file), 'utf8'));
      expect(doc.errors.map(e => e.message)).toEqual([]);
      const wf = doc.toJS();
      expect(wf.on).toBeTruthy();
      expect(Object.keys(wf.jobs ?? {}).length).toBeGreaterThan(0);
    });
  }
});

// Runs open-bot-pr.sh against stub git/gh/npm that log their arguments.
function runBotPr(env) {
  const bin = mkdtempSync(join(tmpdir(), 'bot-pr-'));
  const log = join(bin, 'calls.log');
  const stub = body => `#!/usr/bin/env bash\necho "$(basename "$0") $*" >> "$STUB_LOG"\n${body}\n`;
  const stubs = {
    // `git diff --quiet` fails: there is a catalog change to publish.
    git: stub('case "$1" in diff) exit 1 ;; rev-parse) echo abc123 ;; esac; exit 0'),
    gh: stub('case "$*" in *"--state open"*) echo "" ;; *"--state all"*) echo MERGED ;; esac; exit 0'),
    npm: stub('exit 0'),
  };
  for (const [name, body] of Object.entries(stubs)) {
    writeFileSync(join(bin, name), body);
    chmodSync(join(bin, name), 0o755);
  }
  try {
    // cygpath only exists in Git Bash on Windows; on Linux the path is already POSIX.
    const script = 'stubs="$(cygpath -u "$STUBS" 2>/dev/null || echo "$STUBS")"; export STUB_LOG="$stubs/calls.log"; '
      + 'PATH="$stubs:$PATH" bash scripts/open-bot-pr.sh bot/test "test title"';
    const result = spawnSync('bash', ['-c', script], {
      cwd: ROOT, encoding: 'utf8', env: { ...process.env, STUBS: bin, BOT_TOKEN_KIND: '', SKIP_DEPLOY_DISPATCH: '', ...env },
    });
    return { status: result.status, output: result.stdout + result.stderr, calls: readFileSync(log, 'utf8') };
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
}

describe('open-bot-pr.sh', () => {
  it('starts CI and the Pages deploy itself on the built-in token', () => {
    const { status, output, calls } = runBotPr({ BOT_TOKEN_KIND: 'github' });
    expect(status, output).toBe(0);
    expect(calls).toContain('gh workflow run ci.yml --ref bot/test');
    expect(calls).toContain('gh workflow run deploy-pages.yml --ref main');
  });

  it('leaves the deploy to the caller when asked', () => {
    const { status, output, calls } = runBotPr({ BOT_TOKEN_KIND: 'github', SKIP_DEPLOY_DISPATCH: '1' });
    expect(status, output).toBe(0);
    expect(calls).toContain('gh workflow run ci.yml --ref bot/test');
    expect(calls).not.toContain('deploy-pages.yml');
  });

  it('relies on the PAT triggering CI and the deploy', () => {
    const { status, output, calls } = runBotPr({ BOT_TOKEN_KIND: 'pat' });
    expect(status, output).toBe(0);
    expect(calls).toContain('gh pr create --base main --head bot/test');
    expect(calls).not.toContain('gh workflow run');
  });
});
