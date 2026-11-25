import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('searchbox', { name: 'Search tools' })).toBeVisible();
});

// The catalog grows continuously (daily automation, ongoing curation), so tests read the
// live total instead of hardcoding a count that goes stale on the next catalog update.
async function readTotal(page: Page): Promise<string> {
  const text = await page.getByText(/^\d+ \/ \d+ tools$/).textContent();
  return text!.match(/\/ (\d+) tools/)![1];
}

test('loads, searches, opens details, favorites, and restores the URL state', async ({ page }) => {
  const total = await readTotal(page);
  const search = page.getByRole('searchbox', { name: 'Search tools' });
  await search.fill('Ollama');
  await expect(page).toHaveURL(/q=Ollama/);
  await expect(page.getByText(new RegExp(`^\\d+ / ${total} tools$`))).toBeVisible();

  await page.getByRole('button', { name: 'Open details for Ollama' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Add Ollama to favorites' }).click();
  await page.getByRole('button', { name: /Show favorites/ }).click();
  await expect(page.getByText(`1 / ${total} tools`, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Search tools' })).toHaveValue('Ollama');
});

test('returns a useful empty state and can reset it', async ({ page }) => {
  const total = await readTotal(page);
  await page.getByRole('searchbox', { name: 'Search tools' }).fill('no-such-atlas-tool-xyz');
  await expect(page.getByText('No tools match your filters')).toBeVisible();
  await expect(page.getByText('0%')).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByText(`${total} / ${total} tools`, { exact: true })).toBeVisible();
});

test('has no automatically detectable serious accessibility violations', async ({ page }) => {
  const total = await readTotal(page);
  await page.getByRole('searchbox', { name: 'Search tools' }).fill('Ollama');
  await expect(page.getByText(new RegExp(`^\\d+ / ${total} tools$`))).toBeVisible();
  await page.waitForTimeout(500);
  const results = await new AxeBuilder({ page }).exclude('[data-sonner-toaster]').analyze();
  const serious = results.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''));
  expect(serious).toEqual([]);
});

for (const view of ['grid', 'table', 'analytics', 'compare'] as const) {
  for (const theme of ['dark', 'light'] as const) {
    test(`${view} view (${theme}) has no errors, overflow or serious accessibility violations`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        // Owner avatars come from github.com and may be unavailable to a test runner.
        if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) errors.push(message.text());
      });
      await page.addInitScript(value => localStorage.setItem('osi-atlas-theme-v1', value), theme);
      await page.goto(`/?view=${view}`);
      await expect(page.getByRole('searchbox', { name: 'Search tools' })).toBeVisible();
      await expect(page.getByRole('status')).toHaveCount(0);
      await page.waitForTimeout(800);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'horizontal page overflow').toBeLessThanOrEqual(0);
      const results = await new AxeBuilder({ page }).exclude('[data-sonner-toaster]').analyze();
      const serious = results.violations
        .filter(v => ['serious', 'critical'].includes(v.impact ?? ''))
        .map(v => ({ id: v.id, nodes: v.nodes.length, first: v.nodes[0]?.html }));
      expect(serious).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

test('mounts the grid one page at a time and loads more on demand', async ({ page }) => {
  const total = Number(await readTotal(page));
  const cards = page.getByRole('article');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeLessThan(total);
  const before = await cards.count();
  await page.getByRole('button', { name: /Show more/ }).scrollIntoViewIfNeeded();
  await expect.poll(() => cards.count()).toBeGreaterThan(before);
});
