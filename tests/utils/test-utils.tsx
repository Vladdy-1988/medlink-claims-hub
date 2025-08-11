import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { Toaster } from '@/components/ui/toaster';

// Custom render function that includes providers
function customRender(ui: React.ReactElement, options?: RenderOptions) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

  function AllTheProviders({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <Router>
          {children}
          <Toaster />
        </Router>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: AllTheProviders, ...options });
}

// Mock user auth data
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'provider' as const,
  profileImageUrl: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

export const mockAdminUser = {
  ...mockUser,
  role: 'admin' as const,
};

export const mockBillingUser = {
  ...mockUser,
  role: 'billing' as const,
};

// Mock claim data
export const mockClaim = {
  id: 'claim-1',
  claimNumber: 'CLM-001',
  type: 'claim' as const,
  status: 'submitted' as const,
  amount: '150.00',
  createdAt: '2024-01-01T10:00:00Z',
  updatedAt: '2024-01-01T10:00:00Z',
  patient: {
    id: 'patient-1',
    name: 'John Doe',
    dateOfBirth: '1990-01-01',
    healthNumber: '1234567890',
  },
  insurer: {
    id: 'insurer-1',
    name: 'Health Insurance Co',
    planNumber: 'ABC123',
  },
  services: [
    {
      id: 'service-1',
      procedureCode: '01202',
      description: 'Comprehensive Oral Examination',
      amount: '150.00',
      date: '2024-01-01',
      tooth: null,
      surface: null,
    },
  ],
  attachments: [],
};

// Mock draft claim for offline testing
export const mockDraftClaim = {
  id: 'draft-1',
  claimNumber: 'DRAFT-001',
  type: 'claim' as const,
  status: 'draft' as const,
  amount: '75.00',
  createdAt: '2024-01-01T09:00:00Z',
  updatedAt: '2024-01-01T09:00:00Z',
  patient: {
    id: 'patient-1',
    name: 'Jane Smith',
    dateOfBirth: '1985-06-15',
    healthNumber: '9876543210',
  },
  insurer: {
    id: 'insurer-2',
    name: 'Provincial Health',
    planNumber: 'GOV456',
  },
  services: [
    {
      id: 'service-2',
      procedureCode: '01110',
      description: 'Cleaning',
      amount: '75.00',
      date: '2024-01-01',
      tooth: null,
      surface: null,
    },
  ],
  attachments: [],
};

// Mock dashboard stats
export const mockDashboardStats = {
  totalClaims: 25,
  pendingClaims: 8,
  successRate: 85.5,
  monthlyRevenue: 12750,
};

// Mock insurers
export const mockInsurers = [
  {
    id: 'insurer-1',
    name: 'Health Insurance Co',
    type: 'private' as const,
    supportedMethods: ['portal', 'telus'] as const,
  },
  {
    id: 'insurer-2',
    name: 'Provincial Health',
    type: 'government' as const,
    supportedMethods: ['cdanet'] as const,
  },
];

// Helper to create mock file objects
export function createMockFile(
  name: string = 'test.pdf',
  size: number = 1024,
  type: string = 'application/pdf'
): File {
  const file = new File(['dummy content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

// Helper to wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock network status
export function mockNetworkStatus(isOnline: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: isOnline,
  });

  // Dispatch online/offline events
  const event = new Event(isOnline ? 'online' : 'offline');
  window.dispatchEvent(event);
}

// Mock authentication state
export function mockAuthState(user = mockUser, isAuthenticated = true) {
  const mockUseAuth = {
    user: isAuthenticated ? user : null,
    isLoading: false,
    isAuthenticated,
  };

  // Mock the useAuth hook
  jest.doMock('@/hooks/useAuth', () => ({
    useAuth: () => mockUseAuth,
  }));

  return mockUseAuth;
}

// Export everything including the custom render
export * from '@testing-library/react';
export { customRender as render };