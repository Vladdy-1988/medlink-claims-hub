/**
 * End-to-end test demonstrating the complete claim workflow:
 * 1. User logs in
 * 2. Creates a new claim via portal submission
 * 3. Claim appears in the claims list
 * 4. User can view claim details
 */

import { test, expect } from '@playwright/test';

test.describe('Claim Workflow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('/');
  });

  test('complete claim workflow: login → create claim → view in list', async ({ page }) => {
    // Step 1: Login (if not already authenticated)
    const isAuthenticated = await page.isVisible('[data-testid="user-menu"]');
    
    if (!isAuthenticated) {
      await page.click('a[href="/api/login"]');
      // Wait for authentication to complete and redirect back
      await page.waitForURL('/');
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    }

    // Step 2: Navigate to create new claim
    await page.click('[data-testid="nav-new-claim"]');
    await expect(page).toHaveURL(/\/claims\/new/);

    // Step 3: Fill out patient information
    await page.fill('[data-testid="input-patient-name"]', 'John Doe');
    await page.fill('[data-testid="input-patient-dob"]', '1990-01-01');
    await page.fill('[data-testid="input-patient-health-number"]', '1234567890');

    // Continue to next step
    await page.click('[data-testid="wizard-next-button"]');

    // Step 4: Fill out insurer information
    await page.selectOption('[data-testid="select-insurer"]', 'Health Insurance Co');
    await page.fill('[data-testid="input-plan-number"]', 'ABC123');

    // Continue to next step
    await page.click('[data-testid="wizard-next-button"]');

    // Step 5: Add services
    await page.click('[data-testid="add-service-button"]');
    await page.fill('[data-testid="input-procedure-code-0"]', '01202');
    await page.fill('[data-testid="input-service-description-0"]', 'Comprehensive Oral Examination');
    await page.fill('[data-testid="input-service-amount-0"]', '150.00');
    await page.fill('[data-testid="input-service-date-0"]', '2024-01-01');

    // Continue to next step
    await page.click('[data-testid="wizard-next-button"]');

    // Step 6: Review and submit
    await expect(page.locator('[data-testid="review-patient-name"]')).toHaveText('John Doe');
    await expect(page.locator('[data-testid="review-total-amount"]')).toHaveText('$150.00');

    // Select submission method
    await page.selectOption('[data-testid="select-submission-method"]', 'portal');

    // Submit the claim
    await page.click('[data-testid="wizard-submit-button"]');

    // Step 7: Verify submission success
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    const claimNumber = await page.locator('[data-testid="claim-number"]').textContent();
    expect(claimNumber).toMatch(/CLM-\d+/);

    // Step 8: Navigate to claims list
    await page.click('[data-testid="nav-claims"]');
    await expect(page).toHaveURL(/\/claims/);

    // Step 9: Verify claim appears in list
    await expect(page.locator('[data-testid="search-claims"]')).toBeVisible();
    
    // Search for the new claim
    if (claimNumber) {
      await page.fill('[data-testid="search-claims"]', claimNumber);
      await expect(page.locator(`text=${claimNumber}`)).toBeVisible();
    }

    // Verify claim data in table
    const claimRow = page.locator(`[data-testid="claim-row-${claimNumber}"]`);
    await expect(claimRow.locator('text=John Doe')).toBeVisible();
    await expect(claimRow.locator('text=Health Insurance Co')).toBeVisible();
    await expect(claimRow.locator('text=$150.00')).toBeVisible();
    await expect(claimRow.locator('text=Submitted')).toBeVisible();

    // Step 10: View claim details
    await claimRow.locator('[data-testid^="actions-"]').click();
    await page.click('text=View Details');

    // Verify claim detail page
    await expect(page).toHaveURL(/\/claims\/[^/]+$/);
    await expect(page.locator('[data-testid="claim-header-number"]')).toHaveText(claimNumber || '');
    await expect(page.locator('[data-testid="claim-patient-name"]')).toHaveText('John Doe');
    await expect(page.locator('[data-testid="claim-status"]')).toHaveText('Submitted');

    // Verify claim timeline
    await expect(page.locator('[data-testid="timeline-event-created"]')).toBeVisible();
    await expect(page.locator('[data-testid="timeline-event-submitted"]')).toBeVisible();

    // Verify services list
    const servicesTable = page.locator('[data-testid="services-table"]');
    await expect(servicesTable.locator('text=01202')).toBeVisible();
    await expect(servicesTable.locator('text=Comprehensive Oral Examination')).toBeVisible();
    await expect(servicesTable.locator('text=$150.00')).toBeVisible();
  });

  test('offline claim creation and sync', async ({ page, context }) => {
    // Start with authentication
    await page.goto('/');
    const isAuthenticated = await page.isVisible('[data-testid="user-menu"]');
    
    if (!isAuthenticated) {
      await page.click('a[href="/api/login"]');
      await page.waitForURL('/');
    }

    // Go offline
    await context.setOffline(true);
    await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible();

    // Create a draft claim while offline
    await page.click('[data-testid="nav-new-claim"]');
    
    // Fill basic information
    await page.fill('[data-testid="input-patient-name"]', 'Jane Smith');
    await page.fill('[data-testid="input-patient-dob"]', '1985-06-15');
    await page.fill('[data-testid="input-patient-health-number"]', '9876543210');
    
    // Continue through wizard
    await page.click('[data-testid="wizard-next-button"]');
    await page.selectOption('[data-testid="select-insurer"]', 'Provincial Health');
    await page.fill('[data-testid="input-plan-number"]', 'GOV456');
    await page.click('[data-testid="wizard-next-button"]');

    // Add service
    await page.click('[data-testid="add-service-button"]');
    await page.fill('[data-testid="input-procedure-code-0"]', '01110');
    await page.fill('[data-testid="input-service-description-0"]', 'Cleaning');
    await page.fill('[data-testid="input-service-amount-0"]', '75.00');
    await page.fill('[data-testid="input-service-date-0"]', '2024-01-01');

    // Save as draft (should be only option while offline)
    await page.click('[data-testid="save-draft-button"]');
    
    // Verify draft saved message
    await expect(page.locator('[data-testid="draft-saved-message"]')).toBeVisible();

    // Go back online
    await context.setOffline(false);
    
    // Wait for reconnection banner
    await expect(page.locator('[data-testid="reconnected-banner"]')).toBeVisible();

    // Navigate to claims list and verify draft appears
    await page.click('[data-testid="nav-claims"]');
    
    // Filter by draft status
    await page.click('[data-testid="filter-status"]');
    await page.click('text=Draft');
    
    // Verify draft claim appears
    await expect(page.locator('text=Jane Smith')).toBeVisible();
    await expect(page.locator('text=Provincial Health')).toBeVisible();
    await expect(page.locator('text=Draft')).toBeVisible();
  });

  test('claim validation and error handling', async ({ page }) => {
    // Authenticate first
    await page.goto('/');
    const isAuthenticated = await page.isVisible('[data-testid="user-menu"]');
    
    if (!isAuthenticated) {
      await page.click('a[href="/api/login"]');
      await page.waitForURL('/');
    }

    // Navigate to new claim
    await page.click('[data-testid="nav-new-claim"]');

    // Try to proceed without filling required fields
    await page.click('[data-testid="wizard-next-button"]');
    
    // Verify validation errors
    await expect(page.locator('[data-testid="error-patient-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-patient-dob"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-patient-health-number"]')).toBeVisible();

    // Fill invalid data
    await page.fill('[data-testid="input-patient-name"]', ''); // Empty name
    await page.fill('[data-testid="input-patient-dob"]', 'invalid-date');
    await page.fill('[data-testid="input-patient-health-number"]', '123'); // Too short

    await page.click('[data-testid="wizard-next-button"]');

    // Verify specific validation messages
    await expect(page.locator('text=Patient name is required')).toBeVisible();
    await expect(page.locator('text=Invalid date format')).toBeVisible();
    await expect(page.locator('text=Health number must be at least 10 digits')).toBeVisible();

    // Fill valid data and proceed
    await page.fill('[data-testid="input-patient-name"]', 'Valid Patient');
    await page.fill('[data-testid="input-patient-dob"]', '1990-01-01');
    await page.fill('[data-testid="input-patient-health-number"]', '1234567890');

    await page.click('[data-testid="wizard-next-button"]');
    
    // Should proceed to next step
    await expect(page.locator('text=Insurer Information')).toBeVisible();
  });

  test('role-based access control', async ({ page, context }) => {
    // Test provider role access
    await page.goto('/');
    
    // Mock provider role
    await page.evaluate(() => {
      localStorage.setItem('mockUserRole', 'provider');
    });

    // Provider should see new claim button
    await expect(page.locator('[data-testid="nav-new-claim"]')).toBeVisible();
    
    // Provider should not see admin panel
    await expect(page.locator('[data-testid="nav-admin"]')).not.toBeVisible();

    // Test billing role
    await page.evaluate(() => {
      localStorage.setItem('mockUserRole', 'billing');
    });
    await page.reload();

    // Billing should see remittances
    await expect(page.locator('[data-testid="nav-remittances"]')).toBeVisible();
    
    // Test admin role
    await page.evaluate(() => {
      localStorage.setItem('mockUserRole', 'admin');
    });
    await page.reload();

    // Admin should see everything
    await expect(page.locator('[data-testid="nav-admin"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-new-claim"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-remittances"]')).toBeVisible();
  });

  test('file upload functionality', async ({ page }) => {
    // Authenticate and create a claim
    await page.goto('/');
    const isAuthenticated = await page.isVisible('[data-testid="user-menu"]');
    
    if (!isAuthenticated) {
      await page.click('a[href="/api/login"]');
      await page.waitForURL('/');
    }

    await page.click('[data-testid="nav-new-claim"]');

    // Go to attachments step
    await page.fill('[data-testid="input-patient-name"]', 'Upload Test Patient');
    await page.fill('[data-testid="input-patient-dob"]', '1990-01-01');
    await page.fill('[data-testid="input-patient-health-number"]', '1234567890');
    await page.click('[data-testid="wizard-next-button"]');

    await page.selectOption('[data-testid="select-insurer"]', 'Health Insurance Co');
    await page.fill('[data-testid="input-plan-number"]', 'UPL123');
    await page.click('[data-testid="wizard-next-button"]');

    await page.click('[data-testid="add-service-button"]');
    await page.fill('[data-testid="input-procedure-code-0"]', '01202');
    await page.fill('[data-testid="input-service-description-0"]', 'Test Service');
    await page.fill('[data-testid="input-service-amount-0"]', '100.00');
    await page.fill('[data-testid="input-service-date-0"]', '2024-01-01');
    await page.click('[data-testid="wizard-next-button"]');

    // Now on attachments step
    await expect(page.locator('[data-testid="file-upload-area"]')).toBeVisible();

    // Create a test file
    const testFile = {
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test file content')
    };

    // Upload file
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(testFile);

    // Verify file appears in list
    await expect(page.locator('text=test-document.pdf')).toBeVisible();
    await expect(page.locator('[data-testid="upload-button"]')).toBeVisible();

    // Upload the file
    await page.click('[data-testid="upload-button"]');

    // Wait for upload completion
    await expect(page.locator('text=Upload complete')).toBeVisible();

    // Continue to review step
    await page.click('[data-testid="wizard-next-button"]');

    // Verify attachment appears in review
    await expect(page.locator('[data-testid="review-attachments"]')).toContainText('test-document.pdf');
  });
});