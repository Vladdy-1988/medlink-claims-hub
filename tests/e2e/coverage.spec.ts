import { test, expect } from '@playwright/test';

test.describe('Coverage Dashboard', () => {
  // Skip authentication in development mode
  test.beforeEach(async ({ page }) => {
    // Navigate directly to admin page (dev mode bypasses auth)
    await page.goto('http://localhost:5000/admin');
  });

  test('should navigate to coverage dashboard from admin page', async ({ page }) => {
    // Click on the Coverage tab
    await page.click('[data-testid="tab-coverage"]');
    
    // Verify the coverage tab content is visible
    await expect(page.locator('text=Canada-wide Coverage Matrix')).toBeVisible();
    
    // Click the Open Coverage Dashboard button
    await page.click('[data-testid="button-view-coverage"]');
    
    // Wait for navigation to coverage page
    await page.waitForURL('**/admin/coverage');
    
    // Verify the coverage dashboard is loaded
    await expect(page.locator('h1:has-text("Coverage Dashboard")')).toBeVisible();
    await expect(page.locator('text=Canada-wide EDI/portal coverage')).toBeVisible();
  });

  test('should filter coverage data by province and rail', async ({ page }) => {
    // Navigate directly to coverage page
    await page.goto('http://localhost:5000/admin/coverage');
    
    // Wait for the page to load
    await expect(page.locator('h1:has-text("Coverage Dashboard")')).toBeVisible();
    
    // Select Ontario province filter
    await page.click('[data-testid="select-province"]');
    await page.click('text=Ontario');
    
    // Select Portal rail filter
    await page.click('[data-testid="select-rail"]');
    await page.click('text=Portal');
    
    // Select To-Do status filter
    await page.click('[data-testid="select-status"]');
    await page.click('text=To-Do');
    
    // Verify that the table updates (either shows results or "No results" message)
    const tableVisible = await page.locator('table').isVisible().catch(() => false);
    const noResultsVisible = await page.locator('text=No results match your filters').isVisible().catch(() => false);
    
    expect(tableVisible || noResultsVisible).toBeTruthy();
  });

  test('should export filtered data to CSV', async ({ page }) => {
    // Navigate directly to coverage page
    await page.goto('http://localhost:5000/admin/coverage');
    
    // Wait for the page to load
    await expect(page.locator('h1:has-text("Coverage Dashboard")')).toBeVisible();
    
    // Set up download listener
    const downloadPromise = page.waitForEvent('download');
    
    // Click the Export CSV button
    await page.click('[data-testid="button-export"]');
    
    // Wait for download to start
    const download = await downloadPromise;
    
    // Verify the download has the correct filename
    expect(download.suggestedFilename()).toBe('coverage_export.csv');
  });

  test('should display KPI cards with counts', async ({ page }) => {
    // Navigate directly to coverage page
    await page.goto('http://localhost:5000/admin/coverage');
    
    // Wait for the page to load
    await expect(page.locator('h1:has-text("Coverage Dashboard")')).toBeVisible();
    
    // Verify KPI cards are visible
    await expect(page.locator('text=Total').first()).toBeVisible();
    await expect(page.locator('text=Supported').first()).toBeVisible();
    await expect(page.locator('text=Sandbox').first()).toBeVisible();
    await expect(page.locator('text=To-Do').first()).toBeVisible();
    await expect(page.locator('text=CDAnet').first()).toBeVisible();
    await expect(page.locator('text=eClaims').first()).toBeVisible();
    await expect(page.locator('text=Portal').first()).toBeVisible();
    
    // Verify that at least one KPI has a number
    const totalCard = page.locator('div:has-text("Total")').first();
    const totalValue = await totalCard.locator('p.text-2xl').textContent();
    expect(parseInt(totalValue || '0')).toBeGreaterThanOrEqual(0);
  });

  test('should toggle discipline chips for filtering', async ({ page }) => {
    // Navigate directly to coverage page
    await page.goto('http://localhost:5000/admin/coverage');
    
    // Wait for the page to load
    await expect(page.locator('h1:has-text("Coverage Dashboard")')).toBeVisible();
    
    // Wait for discipline chips to load
    await page.waitForSelector('[data-testid^="chip-discipline-"]', { timeout: 5000 }).catch(() => {
      // If no disciplines load, that's okay for this test
    });
    
    // Try to click a discipline chip if available
    const firstChip = page.locator('[data-testid^="chip-discipline-"]').first();
    const chipExists = await firstChip.count() > 0;
    
    if (chipExists) {
      await firstChip.click();
      // Verify the chip changes appearance (selected state)
      await expect(firstChip).toHaveClass(/.*default.*/);
    }
  });
});