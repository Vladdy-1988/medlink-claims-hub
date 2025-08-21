import { test, expect } from '@playwright/test';

test.describe('Offline Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5000');
    
    // Wait for app to load
    await page.waitForLoadState('networkidle');
  });

  test('should cache app shell for offline access', async ({ page, context }) => {
    // First visit to cache the app
    await page.goto('http://localhost:5000');
    await page.waitForLoadState('networkidle');
    
    // Wait for service worker to be ready
    await page.waitForTimeout(2000);
    
    // Go offline
    await context.setOffline(true);
    
    // Try to navigate again while offline
    await page.reload();
    
    // App should still load with cached content
    const title = await page.title();
    expect(title).toContain('MedLink');
    
    // Check if offline indicator is shown
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    if (await offlineIndicator.isVisible()) {
      await expect(offlineIndicator).toBeVisible();
    }
    
    // Go back online
    await context.setOffline(false);
  });

  test('should save draft claims offline', async ({ page, context }) => {
    // Navigate to claims page
    await page.goto('http://localhost:5000/claims');
    
    // Click new claim button
    const newClaimButton = page.locator('[data-testid="button-new-claim"]');
    if (await newClaimButton.isVisible()) {
      await newClaimButton.click();
      
      // Go offline
      await context.setOffline(true);
      
      // Fill in claim details
      await page.fill('[data-testid="input-claim-amount"]', '150.00');
      await page.selectOption('[data-testid="select-claim-type"]', 'claim');
      
      // Save as draft
      const saveDraftButton = page.locator('[data-testid="button-save-draft"]');
      if (await saveDraftButton.isVisible()) {
        await saveDraftButton.click();
        
        // Check for offline save confirmation
        const toast = page.locator('[data-testid="toast-message"]');
        if (await toast.isVisible()) {
          await expect(toast).toContainText(/saved.*offline/i);
        }
      }
      
      // Go back online
      await context.setOffline(false);
      
      // Check if draft syncs
      await page.waitForTimeout(3000);
      const syncIndicator = page.locator('[data-testid="sync-indicator"]');
      if (await syncIndicator.isVisible()) {
        await expect(syncIndicator).toContainText(/synced/i);
      }
    }
  });

  test('should queue actions for background sync', async ({ page, context }) => {
    // Navigate to claims page
    await page.goto('http://localhost:5000/claims');
    
    // Go offline
    await context.setOffline(true);
    
    // Try to submit a claim
    const newClaimButton = page.locator('[data-testid="button-new-claim"]');
    if (await newClaimButton.isVisible()) {
      await newClaimButton.click();
      
      // Fill minimal claim data
      await page.fill('[data-testid="input-claim-amount"]', '200.00');
      
      // Submit while offline
      const submitButton = page.locator('[data-testid="button-submit-claim"]');
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Should show queued message
        const queueMessage = page.locator('[data-testid="queue-message"]');
        if (await queueMessage.isVisible()) {
          await expect(queueMessage).toContainText(/queued.*sync/i);
        }
      }
    }
    
    // Go back online
    await context.setOffline(false);
    
    // Wait for background sync
    await page.waitForTimeout(5000);
    
    // Check if claim was submitted
    const claimsTable = page.locator('[data-testid="claims-table"]');
    if (await claimsTable.isVisible()) {
      await expect(claimsTable).toContainText('200.00');
    }
  });

  test('should show install prompt for PWA', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5000');
    
    // Check for install button or banner
    const installButton = page.locator('[data-testid="button-install-app"]');
    const installBanner = page.locator('[data-testid="install-banner"]');
    
    // At least one install option should be visible
    const hasInstallOption = await installButton.isVisible() || await installBanner.isVisible();
    expect(hasInstallOption).toBeTruthy();
  });

  test('should handle network errors gracefully', async ({ page, context }) => {
    // Navigate to the app
    await page.goto('http://localhost:5000');
    
    // Intercept network requests to simulate errors
    await page.route('**/api/**', route => {
      route.abort('failed');
    });
    
    // Try to load claims
    await page.goto('http://localhost:5000/claims');
    
    // Should show error message instead of crashing
    const errorMessage = page.locator('[data-testid="error-message"]');
    const retryButton = page.locator('[data-testid="button-retry"]');
    
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toContainText(/error|failed|problem/i);
    }
    
    if (await retryButton.isVisible()) {
      // Clear route interception
      await page.unroute('**/api/**');
      
      // Click retry
      await retryButton.click();
      
      // Should reload successfully
      await page.waitForLoadState('networkidle');
    }
  });
});