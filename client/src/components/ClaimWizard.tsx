import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  FileText, 
  Send,
  AlertCircle,
  Clock,
  CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isComplete?: boolean;
  isActive?: boolean;
  isDisabled?: boolean;
}

interface ClaimWizardProps {
  currentStep: number;
  totalSteps: number;
  onStepChange: (step: number) => void;
  onComplete: () => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  canProceed?: boolean;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

const defaultSteps: Step[] = [
  {
    id: 'patient',
    title: 'Patient Information',
    description: 'Enter patient details and insurance information',
    icon: User,
  },
  {
    id: 'services',
    title: 'Services & Billing',
    description: 'Add procedures, diagnosis codes, and service details',
    icon: FileText,
  },
  {
    id: 'review',
    title: 'Review & Submit',
    description: 'Review claim details and submit to insurance',
    icon: Send,
  },
];

export function ClaimWizard({
  currentStep,
  totalSteps,
  onStepChange,
  onComplete,
  onCancel,
  isSubmitting = false,
  canProceed = true,
  children,
  title = "New Claim",
  subtitle = "Follow the steps to create and submit your claim"
}: ClaimWizardProps) {
  const [steps, setSteps] = useState<Step[]>(defaultSteps);
  
  // Update step states based on current progress
  useEffect(() => {
    setSteps(defaultSteps.map((step, index) => ({
      ...step,
      isComplete: index < currentStep - 1,
      isActive: index === currentStep - 1,
      isDisabled: index > currentStep - 1 && !canProceed,
    })));
  }, [currentStep, canProceed]);

  const progress = Math.round((currentStep / totalSteps) * 100);
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  const handleNext = () => {
    if (!isLastStep && canProceed) {
      onStepChange(currentStep + 1);
    } else if (isLastStep) {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      onStepChange(currentStep - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    const targetStep = stepIndex + 1;
    // Allow going to previous steps or current step
    if (targetStep <= currentStep) {
      onStepChange(targetStep);
    }
  };

  return (
    <div className="space-y-6" data-testid="claim-wizard">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Step {currentStep} of {totalSteps}</span>
          <span className="text-muted-foreground">{progress}% complete</span>
        </div>
        <Progress value={progress} className="h-2" data-testid="wizard-progress" />
      </div>

      {/* Step Navigation */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between space-x-4">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const stepNumber = index + 1;
              
              return (
                <div key={step.id} className="flex items-center space-x-4">
                  {/* Step Circle */}
                  <button
                    onClick={() => handleStepClick(index)}
                    disabled={step.isDisabled}
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                      "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary",
                      step.isComplete && "bg-green-500 border-green-500 text-white",
                      step.isActive && !step.isComplete && "border-primary bg-primary text-primary-foreground",
                      !step.isActive && !step.isComplete && !step.isDisabled && "border-muted-foreground hover:border-primary",
                      step.isDisabled && "border-muted bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                    data-testid={`step-button-${stepNumber}`}
                  >
                    {step.isComplete ? (
                      <Check className="h-5 w-5" />
                    ) : step.isActive ? (
                      <StepIcon className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-medium">{stepNumber}</span>
                    )}
                  </button>

                  {/* Step Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className={cn(
                        "text-sm font-medium",
                        step.isActive && "text-primary",
                        step.isComplete && "text-green-600 dark:text-green-400",
                        step.isDisabled && "text-muted-foreground"
                      )}>
                        {step.title}
                      </h3>
                      {step.isComplete && (
                        <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      )}
                      {step.isActive && isSubmitting && (
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1 animate-spin" />
                          Processing
                        </Badge>
                      )}
                    </div>
                    <p className={cn(
                      "text-xs text-muted-foreground mt-1",
                      step.isDisabled && "text-muted-foreground/50"
                    )}>
                      {step.description}
                    </p>
                  </div>

                  {/* Connector Line */}
                  {index < steps.length - 1 && (
                    <div className={cn(
                      "h-px w-12 transition-colors",
                      step.isComplete ? "bg-green-500" : "bg-muted"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {steps[currentStep - 1] && (
              <>
                {React.createElement(steps[currentStep - 1].icon, { className: "h-5 w-5" })}
                <span>{steps[currentStep - 1].title}</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <div>
          {onCancel && (
            <Button 
              variant="outline" 
              onClick={onCancel}
              disabled={isSubmitting}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={isFirstStep || isSubmitting}
            data-testid="button-previous"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <Button
            onClick={handleNext}
            disabled={(!canProceed && !isLastStep) || isSubmitting}
            className={cn(
              isLastStep && "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
            )}
            data-testid="button-next"
          >
            {isSubmitting ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                {isLastStep ? 'Submitting...' : 'Processing...'}
              </>
            ) : isLastStep ? (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Claim
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Validation Messages */}
      {!canProceed && !isLastStep && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Please complete all required fields before proceeding to the next step.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Custom hook for managing wizard state
export function useClaimWizard(initialStep: number = 1) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [stepData, setStepData] = useState<Record<number, any>>({});

  const markStepComplete = (step: number, data?: any) => {
    setCompletedSteps(prev => new Set([...prev, step]));
    if (data) {
      setStepData(prev => ({ ...prev, [step]: data }));
    }
  };

  const markStepIncomplete = (step: number) => {
    setCompletedSteps(prev => {
      const newSet = new Set(prev);
      newSet.delete(step);
      return newSet;
    });
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  const nextStep = () => {
    setCurrentStep(prev => prev + 1);
  };

  const previousStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const reset = () => {
    setCurrentStep(initialStep);
    setCompletedSteps(new Set());
    setStepData({});
  };

  const isStepComplete = (step: number) => completedSteps.has(step);
  const canProceedFromStep = (step: number) => completedSteps.has(step);

  return {
    currentStep,
    completedSteps,
    stepData,
    markStepComplete,
    markStepIncomplete,
    goToStep,
    nextStep,
    previousStep,
    reset,
    isStepComplete,
    canProceedFromStep,
  };
}