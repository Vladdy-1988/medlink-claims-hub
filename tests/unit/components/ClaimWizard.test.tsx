import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClaimWizard, useClaimWizard } from '../../../client/src/components/ClaimWizard';
import { describe, it, expect, vi } from 'vitest';

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Check: () => <div data-testid="check-icon" />,
  ChevronLeft: () => <div data-testid="chevron-left-icon" />,
  ChevronRight: () => <div data-testid="chevron-right-icon" />,
  User: () => <div data-testid="user-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
  Send: () => <div data-testid="send-icon" />,
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
}));

describe('ClaimWizard', () => {
  const defaultProps = {
    currentStep: 1,
    totalSteps: 3,
    onStepChange: vi.fn(),
    onComplete: vi.fn(),
    children: <div>Step content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders wizard with correct step information', () => {
    render(<ClaimWizard {...defaultProps} />);

    expect(screen.getByText('New Claim')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('33% complete')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-progress')).toBeInTheDocument();
  });

  it('displays step navigation correctly', () => {
    render(<ClaimWizard {...defaultProps} />);

    expect(screen.getByTestId('step-button-1')).toBeInTheDocument();
    expect(screen.getByTestId('step-button-2')).toBeInTheDocument();
    expect(screen.getByTestId('step-button-3')).toBeInTheDocument();

    expect(screen.getByText('Patient Information')).toBeInTheDocument();
    expect(screen.getByText('Services & Billing')).toBeInTheDocument();
    expect(screen.getByText('Review & Submit')).toBeInTheDocument();
  });

  it('handles step navigation correctly', () => {
    const onStepChange = vi.fn();
    render(<ClaimWizard {...defaultProps} currentStep={2} onStepChange={onStepChange} />);

    // Should allow going back to previous step
    const step1Button = screen.getByTestId('step-button-1');
    fireEvent.click(step1Button);
    expect(onStepChange).toHaveBeenCalledWith(1);
  });

  it('disables next button when canProceed is false', () => {
    render(<ClaimWizard {...defaultProps} canProceed={false} />);

    const nextButton = screen.getByTestId('button-next');
    expect(nextButton).toBeDisabled();
  });

  it('shows validation message when cannot proceed', () => {
    render(<ClaimWizard {...defaultProps} canProceed={false} />);

    expect(screen.getByText('Please complete all required fields before proceeding to the next step.')).toBeInTheDocument();
  });

  it('calls onComplete when on last step and next is clicked', () => {
    const onComplete = vi.fn();
    render(
      <ClaimWizard 
        {...defaultProps} 
        currentStep={3} 
        onComplete={onComplete}
        canProceed={true}
      />
    );

    const submitButton = screen.getByTestId('button-next');
    expect(submitButton).toHaveTextContent('Submit Claim');
    
    fireEvent.click(submitButton);
    expect(onComplete).toHaveBeenCalled();
  });

  it('shows loading state when submitting', () => {
    render(
      <ClaimWizard 
        {...defaultProps} 
        currentStep={3}
        isSubmitting={true}
      />
    );

    const submitButton = screen.getByTestId('button-next');
    expect(submitButton).toHaveTextContent('Submitting...');
    expect(submitButton).toBeDisabled();
  });

  it('disables previous button on first step', () => {
    render(<ClaimWizard {...defaultProps} currentStep={1} />);

    const prevButton = screen.getByTestId('button-previous');
    expect(prevButton).toBeDisabled();
  });

  it('shows cancel button when onCancel is provided', () => {
    const onCancel = vi.fn();
    render(<ClaimWizard {...defaultProps} onCancel={onCancel} />);

    const cancelButton = screen.getByTestId('button-cancel');
    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('useClaimWizard hook', () => {
  it('initializes with correct default values', () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useClaimWizard(2);
      return null;
    }

    render(<TestComponent />);

    expect(hookResult.currentStep).toBe(2);
    expect(hookResult.completedSteps.size).toBe(0);
    expect(Object.keys(hookResult.stepData)).toHaveLength(0);
  });

  it('manages step completion correctly', () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useClaimWizard();
      return null;
    }

    render(<TestComponent />);

    // Mark step as complete
    hookResult.markStepComplete(1, { field: 'value' });
    expect(hookResult.isStepComplete(1)).toBe(true);
    expect(hookResult.stepData[1]).toEqual({ field: 'value' });

    // Mark step as incomplete
    hookResult.markStepIncomplete(1);
    expect(hookResult.isStepComplete(1)).toBe(false);
  });

  it('handles step navigation', () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useClaimWizard();
      return null;
    }

    render(<TestComponent />);

    // Go to specific step
    hookResult.goToStep(3);
    expect(hookResult.currentStep).toBe(3);

    // Go to next step
    hookResult.nextStep();
    expect(hookResult.currentStep).toBe(4);

    // Go to previous step
    hookResult.previousStep();
    expect(hookResult.currentStep).toBe(3);

    // Previous step shouldn't go below 1
    hookResult.goToStep(1);
    hookResult.previousStep();
    expect(hookResult.currentStep).toBe(1);
  });

  it('resets state correctly', () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useClaimWizard();
      return null;
    }

    render(<TestComponent />);

    // Set some state
    hookResult.goToStep(3);
    hookResult.markStepComplete(1);
    hookResult.markStepComplete(2);

    // Reset
    hookResult.reset();
    expect(hookResult.currentStep).toBe(1);
    expect(hookResult.completedSteps.size).toBe(0);
    expect(Object.keys(hookResult.stepData)).toHaveLength(0);
  });
});