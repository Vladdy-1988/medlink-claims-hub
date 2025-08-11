import { test, expect } from '@playwright/test';

test.describe('Claim Workflow', () => {
  test('complete claim creation workflow via portal', async ({ page }) => {
    // Start at the landing page
    await page.goto('/');

    // Should see landing page for unauthenticated users
    await expect(page.getByTestId('landing-page')).toBeVisible();
    await expect(page.getByText('MedLink Claims Hub')).toBeVisible();

    // Click login button
    await page.getByTestId('button-login').click();

    // Mock authentication by navigating directly to dashboard
    // In real app, this would go through Replit Auth flow
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    // Should be on dashboard after login
    await expect(page.getByTestId('dashboard-kpis')).toBeVisible();
    await expect(page.getByText('Dashboard')).toBeVisible();

    // Navigate to create new claim
    await page.getByTestId('button-new-claim').click();

    // Should be on new claim page with wizard
    await expect(page.getByTestId('claim-wizard')).toBeVisible();
    await expect(page.getByText('New Claim')).toBeVisible();
    await expect(page.getByText('Step 1 of 3')).toBeVisible();

    // Fill out patient information (Step 1)
    await page.getByTestId('input-patient-first-name').fill('John');
    await page.getByTestId('input-patient-last-name').fill('Doe');
    await page.getByTestId('input-patient-dob').fill('1990-01-01');
    await page.getByTestId('input-patient-health-card').fill('1234567890');
    await page.getByTestId('select-insurance-carrier').click();
    await page.getByText('Blue Cross').click();

    // Proceed to next step
    await page.getByTestId('button-next').click();

    // Should be on step 2 - Services & Billing
    await expect(page.getByText('Step 2 of 3')).toBeVisible();
    await expect(page.getByText('Services & Billing')).toBeVisible();

    // Fill out service information
    await page.getByTestId('input-service-date').fill('2024-01-15');
    await page.getByTestId('input-diagnosis-code').fill('Z00.00');
    await page.getByTestId('input-procedure-code').fill('99213');
    await page.getByTestId('input-service-amount').fill('150.00');
    await page.getByTestId('textarea-service-description').fill('Office visit for routine checkup');

    // Upload a file attachment
    const fileInput = page.getByTestId('input-file-hidden');
    await fileInput.setInputFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Mock PDF content for testing')
    });

    // Wait for file upload to complete
    await expect(page.getByText('Upload complete')).toBeVisible({ timeout: 10000 });

    // Proceed to review step
    await page.getByTestId('button-next').click();

    // Should be on step 3 - Review & Submit
    await expect(page.getByText('Step 3 of 3')).toBeVisible();
    await expect(page.getByText('Review & Submit')).toBeVisible();

    // Review information is displayed
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('$150.00')).toBeVisible();
    await expect(page.getByText('99213')).toBeVisible();

    // Choose portal submission method
    await page.getByTestId('select-submission-method').click();
    await page.getByText('Portal Upload').click();

    // Submit the claim
    await page.getByTestId('button-next').click();

    // Should see submission confirmation
    await expect(page.getByText('Claim submitted successfully')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Portal upload required')).toBeVisible();

    // Go to claims list to verify claim appears
    await page.getByTestId('link-claims').click();

    // Should be on claims list page
    await expect(page.getByTestId('claims-table')).toBeVisible();

    // Look for the newly created claim
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('Upload Required')).toBeVisible();

    // Click on the claim to view details
    await page.getByTestId('button-view-claim').first().click();

    // Should be on claim detail page
    await expect(page.getByText('Claim Details')).toBeVisible();
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('Portal upload required')).toBeVisible();

    // Should see timeline with creation event
    await expect(page.getByTestId('claim-timeline')).toBeVisible();
    await expect(page.getByText('Claim created')).toBeVisible();

    // Verify file attachment is listed
    await expect(page.getByText('test-document.pdf')).toBeVisible();

    // Mark as submitted via portal
    await page.getByTestId('button-mark-submitted').click();

    // Fill out submission confirmation
    await page.getByTestId('input-confirmation-number').fill('PORTAL-12345');
    await page.getByTestId('textarea-submission-notes').fill('Submitted via carrier portal');
    await page.getByTestId('button-confirm-submission').click();

    // Should see updated status
    await expect(page.getByText('Submitted')).toBeVisible();
    await expect(page.getByText('PORTAL-12345')).toBeVisible();

    // Timeline should show submission event
    await expect(page.getByText('Claim submitted via portal')).toBeVisible();

    // Go back to claims list
    await page.getByTestId('link-claims').click();

    // Claim should now show as submitted
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('Submitted')).toBeVisible();
  });

  test('handles authentication requirement', async ({ page }) => {
    // Try to access protected page without authentication
    await page.goto('/claims');

    // Should redirect to login or show unauthorized message
    await expect(page.getByText('Authentication Required')).toBeVisible();
    await expect(page.getByTestId('button-sign-in')).toBeVisible();
  });

  test('supports offline functionality', async ({ page }) => {
    // Mock authenticated state
    await page.goto('/dashboard');

    // Go offline
    await page.context().setOffline(true);

    // Try to create a claim offline
    await page.getByTestId('button-new-claim').click();

    // Should see offline banner
    await expect(page.getByTestId('offline-banner')).toBeVisible();
    await expect(page.getByText('Offline Mode')).toBeVisible();

    // Should still be able to fill out form
    await page.getByTestId('input-patient-first-name').fill('Jane');
    await page.getByTestId('input-patient-last-name').fill('Smith');

    // Form should save locally
    await expect(page.getByDisplayValue('Jane')).toBeVisible();
    await expect(page.getByDisplayValue('Smith')).toBeVisible();

    // Go back online
    await page.context().setOffline(false);

    // Should see sync notification
    await expect(page.getByText('Connection restored')).toBeVisible();
    await expect(page.getByText('Syncing pending changes')).toBeVisible();
  });

  test('enforces role-based access control', async ({ page }) => {
    // Mock provider role access
    await page.goto('/dashboard');

    // Provider should be able to create claims
    await expect(page.getByTestId('button-new-claim')).toBeVisible();

    // But should not be able to access admin features
    await page.goto('/admin');
    await expect(page.getByText('Access Denied')).toBeVisible();
    await expect(page.getByText('Required Access Level')).toBeVisible();
  });
});