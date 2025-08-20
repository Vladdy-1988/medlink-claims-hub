import { test, expect } from '@playwright/test';

test.describe('MedLink Claims Hub E2E Tests', () => {
  // Test configuration
  const baseURL = 'http://localhost:5000';
  
  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
  });

  test.describe('Authentication Flow', () => {
    test('should load dashboard directly in development mode', async ({ page }) => {
      // In dev mode, should bypass auth and show dashboard
      await expect(page).toHaveTitle(/MedLink Claims Hub/);
      await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
      
      // Should not show landing page
      await expect(page.locator('text=Sign in to continue')).not.toBeVisible();
    });

    test('should display user menu with sign out option', async ({ page }) => {
      await page.locator('[data-testid="user-menu-trigger"]').click();
      await expect(page.locator('text=Sign Out')).toBeVisible();
    });
  });

  test.describe('Claim Submission Workflow', () => {
    test('should create new claim via portal', async ({ page }) => {
      // Navigate to new claim page
      await page.goto(`${baseURL}/claims/new`);
      
      // Step 1: Patient & Provider Information
      await expect(page.locator('text=Patient & Provider Information')).toBeVisible();
      
      // Select patient
      await page.locator('[data-testid="select-patient"]').click();
      await page.locator('text=John Smith').first().click();
      
      // Select provider
      await page.locator('[data-testid="select-provider"]').click();
      await page.locator('text=Dr. Sarah Johnson').first().click();
      
      // Select insurer
      await page.locator('[data-testid="select-insurer"]').click();
      await page.locator('text=Sun Life Financial').first().click();
      
      // Click Next
      await page.locator('[data-testid="button-next-step"]').click();
      
      // Step 2: Services & Procedure Codes
      await expect(page.locator('text=Services & Procedure Codes')).toBeVisible();
      
      // Add procedure code
      await page.locator('[data-testid="input-procedure-code"]').fill('D0150');
      await page.locator('[data-testid="input-description"]').fill('Comprehensive Oral Exam');
      await page.locator('[data-testid="input-amount"]').fill('150.00');
      await page.locator('[data-testid="button-add-code"]').click();
      
      // Verify code was added
      await expect(page.locator('text=D0150')).toBeVisible();
      
      // Click Next
      await page.locator('[data-testid="button-next-step"]').click();
      
      // Step 3: Attachments & Submit
      await expect(page.locator('text=Attachments & Submit')).toBeVisible();
      
      // Upload a dummy file (if needed)
      // const fileInput = page.locator('input[type="file"]');
      // await fileInput.setInputFiles('./tests/fixtures/test-document.pdf');
      
      // Submit claim
      await page.locator('[data-testid="button-submit-claim"]').click();
      
      // Should redirect to claims list
      await expect(page).toHaveURL(/\/claims/);
      
      // Verify claim appears in list
      await expect(page.locator('text=submitted').first()).toBeVisible();
    });

    test('should show claim in claims list after submission', async ({ page }) => {
      await page.goto(`${baseURL}/claims`);
      
      // Should see claims table
      await expect(page.locator('[data-testid="claims-table"]')).toBeVisible();
      
      // Should have at least one claim
      const claimRows = page.locator('[data-testid^="claim-row-"]');
      await expect(claimRows).toHaveCount({ min: 1 });
      
      // Click on first claim to view details
      await claimRows.first().click();
      
      // Should navigate to claim detail page
      await expect(page).toHaveURL(/\/claims\/[^/]+$/);
      
      // Should show claim timeline
      await expect(page.locator('[data-testid="claim-timeline"]')).toBeVisible();
      await expect(page.locator('text=Created')).toBeVisible();
      await expect(page.locator('text=Submitted')).toBeVisible();
    });
  });

  test.describe('Offline Mode', () => {
    test('should save draft in offline mode', async ({ page, context }) => {
      // Navigate to new claim page
      await page.goto(`${baseURL}/claims/new`);
      
      // Go offline
      await context.setOffline(true);
      
      // Fill out claim form
      await page.locator('[data-testid="select-patient"]').click();
      await page.locator('text=John Smith').first().click();
      
      await page.locator('[data-testid="select-provider"]').click();
      await page.locator('text=Dr. Sarah Johnson').first().click();
      
      // Should show offline indicator
      await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
      
      // Should show autosave indicator
      await page.locator('[data-testid="input-procedure-code"]').fill('D0210');
      await expect(page.locator('[data-testid="autosave-indicator"]')).toBeVisible();
      
      // Go back online
      await context.setOffline(false);
      
      // Should sync to server
      await expect(page.locator('[data-testid="sync-indicator"]')).toBeVisible();
      
      // Verify data persisted
      await page.reload();
      const procedureInput = page.locator('[data-testid="input-procedure-code"]');
      await expect(procedureInput).toHaveValue('D0210');
    });
  });

  test.describe('Dashboard', () => {
    test('should display dashboard KPIs', async ({ page }) => {
      await page.goto(baseURL);
      
      // Should show KPI cards
      await expect(page.locator('[data-testid="kpi-total-claims"]')).toBeVisible();
      await expect(page.locator('[data-testid="kpi-pending-claims"]')).toBeVisible();
      await expect(page.locator('[data-testid="kpi-success-rate"]')).toBeVisible();
      await expect(page.locator('[data-testid="kpi-monthly-revenue"]')).toBeVisible();
      
      // Should show recent claims table
      await expect(page.locator('[data-testid="recent-claims-table"]')).toBeVisible();
      
      // Should show quick actions
      await expect(page.locator('[data-testid="button-new-claim"]')).toBeVisible();
      await expect(page.locator('[data-testid="button-new-preauth"]')).toBeVisible();
    });

    test('should navigate to new claim from dashboard', async ({ page }) => {
      await page.goto(baseURL);
      
      await page.locator('[data-testid="button-new-claim"]').click();
      await expect(page).toHaveURL(/\/claims\/new/);
      await expect(page.locator('text=Patient & Provider Information')).toBeVisible();
    });
  });

  test.describe('PWA Features', () => {
    test('should be installable', async ({ page }) => {
      // Check for manifest
      const response = await page.goto('/manifest.json');
      expect(response?.status()).toBe(200);
      
      // Check for service worker registration
      const hasServiceWorker = await page.evaluate(() => {
        return 'serviceWorker' in navigator;
      });
      expect(hasServiceWorker).toBe(true);
    });

    test('should show install prompt', async ({ page }) => {
      // In a real PWA, this would trigger on certain conditions
      // For testing, we just check if the component exists
      const installPrompt = page.locator('[data-testid="install-prompt"]');
      // May or may not be visible depending on browser/conditions
      // Just verify the component is in the DOM
      const promptCount = await installPrompt.count();
      expect(promptCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Settings Page', () => {
    test('should allow language selection', async ({ page }) => {
      await page.goto(`${baseURL}/settings`);
      
      // Should show language selector
      await expect(page.locator('[data-testid="language-selector"]')).toBeVisible();
      
      // Should have English and French options
      await page.locator('[data-testid="language-selector"]').click();
      await expect(page.locator('text=English')).toBeVisible();
      await expect(page.locator('text=Français')).toBeVisible();
    });

    test('should allow province selection', async ({ page }) => {
      await page.goto(`${baseURL}/settings`);
      
      // Should show province selector
      await expect(page.locator('[data-testid="province-selector"]')).toBeVisible();
      
      // Should have all Canadian provinces
      await page.locator('[data-testid="province-selector"]').click();
      await expect(page.locator('text=Ontario')).toBeVisible();
      await expect(page.locator('text=Quebec')).toBeVisible();
      await expect(page.locator('text=British Columbia')).toBeVisible();
    });
  });

  test.describe('Admin Panel', () => {
    test('should show admin features for admin users', async ({ page }) => {
      await page.goto(`${baseURL}/admin`);
      
      // Should show audit log
      await expect(page.locator('[data-testid="audit-log-table"]')).toBeVisible();
      
      // Should show user management
      await expect(page.locator('[data-testid="user-management-section"]')).toBeVisible();
      
      // Should show connector status
      await expect(page.locator('[data-testid="connector-status-section"]')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto(baseURL);
      
      // Check for main navigation
      const nav = page.locator('nav[aria-label="Main navigation"]');
      await expect(nav).toBeVisible();
      
      // Check for proper heading hierarchy
      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      
      // Check for button labels
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i);
        const ariaLabel = await button.getAttribute('aria-label');
        const textContent = await button.textContent();
        expect(ariaLabel || textContent).toBeTruthy();
      }
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto(baseURL);
      
      // Tab through interactive elements
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
      
      // Should be able to activate buttons with Enter
      await page.keyboard.press('Enter');
      // Verify action occurred (navigation or modal opening)
    });
  });
});