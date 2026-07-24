import { test, expect } from '@playwright/test';

test('the app loads and reaches the API', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('ok')).toBeVisible({ timeout: 10_000 });
});
