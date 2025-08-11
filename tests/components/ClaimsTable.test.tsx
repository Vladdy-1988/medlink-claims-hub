import { screen, fireEvent, waitFor } from '@testing-library/react';
import { ClaimsTable, transformClaimsForTable } from '@/components/ClaimsTable';
import { render, mockClaim, mockDraftClaim } from '../utils/test-utils';

const mockClaims = transformClaimsForTable([mockClaim, mockDraftClaim]);

describe('ClaimsTable', () => {
  it('renders claims table with data', () => {
    render(<ClaimsTable claims={mockClaims} />);
    
    expect(screen.getByText('Claims (2)')).toBeInTheDocument();
    expect(screen.getByText('CLM-001')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Health Insurance Co')).toBeInTheDocument();
  });

  it('shows loading skeleton when loading', () => {
    render(<ClaimsTable claims={[]} isLoading={true} />);
    
    expect(screen.getByText('Claims')).toBeInTheDocument();
    // Should show skeleton loaders
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(5);
  });

  it('shows empty state when no claims', () => {
    render(<ClaimsTable claims={[]} />);
    
    expect(screen.getByText('No claims found matching your criteria.')).toBeInTheDocument();
  });

  it('filters claims by search term', async () => {
    render(<ClaimsTable claims={mockClaims} />);
    
    const searchInput = screen.getByTestId('search-claims');
    fireEvent.change(searchInput, { target: { value: 'John' } });
    
    await waitFor(() => {
      expect(screen.getByText('CLM-001')).toBeInTheDocument();
      expect(screen.queryByText('DRAFT-001')).not.toBeInTheDocument();
    });
  });

  it('filters claims by status', async () => {
    render(<ClaimsTable claims={mockClaims} />);
    
    const statusFilter = screen.getByTestId('filter-status');
    fireEvent.click(statusFilter);
    
    const draftOption = screen.getByText('Draft');
    fireEvent.click(draftOption);
    
    await waitFor(() => {
      expect(screen.getByText('DRAFT-001')).toBeInTheDocument();
      expect(screen.queryByText('CLM-001')).not.toBeInTheDocument();
    });
  });

  it('sorts claims by column headers', async () => {
    render(<ClaimsTable claims={mockClaims} />);
    
    const claimNumberHeader = screen.getByTestId('sort-claimNumber');
    fireEvent.click(claimNumberHeader);
    
    await waitFor(() => {
      // Should be sorted alphabetically by claim number
      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('CLM-001');
      expect(rows[2]).toHaveTextContent('DRAFT-001');
    });
  });

  it('handles pagination', async () => {
    // Create enough claims to trigger pagination
    const manyClaims = Array.from({ length: 15 }, (_, i) => ({
      ...mockClaims[0],
      id: `claim-${i}`,
      claimNumber: `CLM-${i.toString().padStart(3, '0')}`,
    }));

    render(<ClaimsTable claims={manyClaims} />);
    
    // Should show pagination controls
    expect(screen.getByTestId('next-page')).toBeInTheDocument();
    expect(screen.getByTestId('prev-page')).toBeInTheDocument();
    
    // Click next page
    fireEvent.click(screen.getByTestId('next-page'));
    
    await waitFor(() => {
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    });
  });

  it('shows action menu for each claim', () => {
    render(<ClaimsTable claims={mockClaims} />);
    
    const actionButton = screen.getByTestId('actions-CLM-001');
    fireEvent.click(actionButton);
    
    expect(screen.getByText('View Details')).toBeInTheDocument();
    expect(screen.getByText('Edit Claim')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('calls onClaimSelect when edit is clicked', () => {
    const onClaimSelect = jest.fn();
    render(<ClaimsTable claims={mockClaims} onClaimSelect={onClaimSelect} />);
    
    const actionButton = screen.getByTestId('actions-CLM-001');
    fireEvent.click(actionButton);
    
    const editButton = screen.getByText('Edit Claim');
    fireEvent.click(editButton);
    
    expect(onClaimSelect).toHaveBeenCalledWith('claim-1');
  });

  it('transforms claim data correctly', () => {
    const claims = [mockClaim];
    const transformed = transformClaimsForTable(claims);
    
    expect(transformed).toHaveLength(1);
    expect(transformed[0]).toEqual({
      id: 'claim-1',
      claimNumber: 'CLM-001',
      patientName: 'John Doe',
      insurerName: 'Health Insurance Co',
      amount: '150.00',
      status: 'submitted',
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:00:00Z',
      type: 'claim',
    });
  });

  it('handles responsive mobile layout', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });

    render(<ClaimsTable claims={mockClaims} />);
    
    // Mobile cards should be visible (lg:hidden class removes them on large screens)
    const mobileCards = document.querySelector('.lg\\:hidden');
    expect(mobileCards).toBeInTheDocument();
  });
});