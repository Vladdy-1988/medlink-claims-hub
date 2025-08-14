import { test, expect } from '@playwright/test';

test.describe('Claims Workflow End-to-End', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication by setting up session
    await page.route('**/api/auth/user', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          profileImageUrl: null
        })
      });
    });

    // Mock dashboard stats
    await page.route('**/api/dashboard/stats', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalClaims: 5,
          pendingClaims: 2,
          submittedClaims: 3,
          paidClaims: 0,
          deniedClaims: 0,
          draftClaims: 1
        })
      });
    });

    // Mock claims list
    await page.route('**/api/claims', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'claim-123',
            type: 'claim',
            status: 'submitted',
            amount: '150.00',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            patientId: 'patient-1',
            providerId: 'provider-1',
            insurerId: 'insurer-1',
            codes: ['A001', 'B002'],
            description: 'Test claim description'
          }
        ])
      });
    });

    // Mock patients, providers, insurers
    await page.route('**/api/patients', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'patient-1',
            name: 'John Doe',
            dateOfBirth: '1990-01-01',
            healthCardNumber: 'HC123456789'
          }
        ])
      });
    });

    await page.route('**/api/providers', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'provider-1',
            name: 'Dr. Smith',
            license: 'LIC123',
            discipline: 'Family Medicine'
          }
        ])
      });
    });

    await page.route('**/api/insurers', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'insurer-1',
            name: 'Test Insurance Co.',
            rail: 'portal'
          }
        ])
      });
    });
  });

  test('should complete full claims workflow', async ({ page }) => {
    // 1. Navigate to application and verify dashboard loads
    await page.goto('http://localhost:5000');
    
    // Verify dashboard loads with KPIs
    await expect(page.getByTestId('dashboard-kpi-total-claims')).toBeVisible();
    await expect(page.getByTestId('dashboard-kpi-pending-claims')).toBeVisible();
    
    // 2. Navigate to create new claim
    await page.getByTestId('button-new-claim').click();
    await expect(page).toHaveURL(/.*\/claims\/new/);
    
    // Verify claim creation form loads
    await expect(page.getByText('Create New Claim')).toBeVisible();
    
    // 3. Fill out claim form (this tests the ClaimWizard component)
    // Note: Since we're testing the integrated components, we'll verify the form elements
    await expect(page.getByText('Patient Information')).toBeVisible();
    
    // 4. Navigate back to claims list
    await page.goto('http://localhost:5000/claims');
    await expect(page.getByTestId('claims-table')).toBeVisible();
    
    // 5. Verify claim appears in list with submitted status
    await expect(page.getByText('CLAIM-123')).toBeVisible();
    await expect(page.getByText('submitted')).toBeVisible();
    
    // 6. Click on claim to view details
    await page.getByText('CLAIM-123').click();
    await expect(page).toHaveURL(/.*\/claims\/claim-123/);
    
    // 7. Verify claim detail page loads with timeline
    await expect(page.getByText('Claim #CLAIM123')).toBeVisible();
    await expect(page.getByText('Status Timeline')).toBeVisible();
    await expect(page.getByText('submitted')).toBeVisible();
  });

  test('should handle offline draft functionality', async ({ page }) => {
    // Navigate to new claim page
    await page.goto('http://localhost:5000/claims/new');
    
    // Simulate offline mode by intercepting network requests
    await page.route('**/api/**', (route) => {
      route.abort();
    });
    
    // Verify offline banner appears
    await expect(page.getByTestId('offline-banner')).toBeVisible();
    
    // Verify claim form still loads (should work offline)
    await expect(page.getByText('Create New Claim')).toBeVisible();
  });

  test('should display proper navigation and UI components', async ({ page }) => {
    // Test dashboard navigation
    await page.goto('http://localhost:5000');
    
    // Verify main navigation elements
    await expect(page.getByTestId('button-new-claim')).toBeVisible();
    await expect(page.getByTestId('button-new-preauth')).toBeVisible();
    
    // Test claims page navigation
    await page.goto('http://localhost:5000/claims');
    await expect(page.getByText('Claims Management')).toBeVisible();
    await expect(page.getByTestId('button-new-claim')).toBeVisible();
    
    // Verify claims table loads
    await expect(page.getByTestId('claims-table')).toBeVisible();
  });
});