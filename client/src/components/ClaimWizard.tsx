import { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ClaimWizardStep {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
  isValid?: boolean;
  isOptional?: boolean;
}

interface ClaimWizardProps {
  steps: ClaimWizardStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onComplete: () => void;
  isSubmitting?: boolean;
  canProceed?: boolean;
  className?: string;
}

/**
 * ClaimWizard - A multi-step form wizard component
 * 
 * Features:
 * - Visual progress indicator with step numbers and completion states
 * - Navigation between steps with validation
 * - Accessible keyboard navigation
 * - Responsive design for mobile and desktop
 */
export function ClaimWizard({
  steps,
  currentStep,
  onStepChange,
  onComplete,
  isSubmitting = false,
  canProceed = true,
  className,
}: ClaimWizardProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const handleNext = () => {
    if (currentStep < steps.length - 1 && canProceed) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      onStepChange(currentStep + 1);
    } else if (currentStep === steps.length - 1) {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      onStepChange(currentStep - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    // Allow clicking on previous steps or current step
    if (stepIndex <= currentStep || completedSteps.has(stepIndex)) {
      onStepChange(stepIndex);
    }
  };

  const currentStepData = steps[currentStep];

  return (
    <div className={cn("w-full max-w-4xl mx-auto", className)}>
      {/* Progress Steps Header */}
      <div className="mb-8">
        <nav aria-label="Progress" className="mb-4">
          <ol role="list" className="flex items-center justify-between">
            {steps.map((step, index) => {
              const isCompleted = completedSteps.has(index) || index < currentStep;
              const isCurrent = index === currentStep;
              const isAccessible = index <= currentStep || completedSteps.has(index);

              return (
                <li key={step.id} className="relative flex-1">
                  {index !== steps.length - 1 && (
                    <div
                      className={cn(
                        "absolute top-4 left-1/2 w-full h-0.5 -translate-x-1/2 translate-y-1/2",
                        isCompleted ? "bg-primary-600" : "bg-slate-200"
                      )}
                      aria-hidden="true"
                    />
                  )}
                  
                  <button
                    type="button"
                    onClick={() => handleStepClick(index)}
                    disabled={!isAccessible}
                    className={cn(
                      "relative flex flex-col items-center group",
                      isAccessible ? "cursor-pointer" : "cursor-not-allowed"
                    )}
                    aria-current={isCurrent ? "step" : undefined}
                    data-testid={`wizard-step-${index}`}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold",
                        isCompleted
                          ? "border-primary-600 bg-primary-600 text-white"
                          : isCurrent
                          ? "border-primary-600 bg-white text-primary-600"
                          : "border-slate-300 bg-white text-slate-500 group-hover:border-slate-400"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </span>
                    
                    <span className="mt-2 text-xs font-medium text-slate-900 text-center max-w-20">
                      {step.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Current Step Info */}
        <div className="text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            {currentStepData.title}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {currentStepData.description}
          </p>
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          <div role="tabpanel" aria-labelledby={`step-${currentStep}-heading`}>
            {currentStepData.component}
          </div>
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
          className="flex items-center"
          data-testid="wizard-back-button"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <div className="flex items-center space-x-3">
          <span className="text-sm text-slate-500">
            Step {currentStep + 1} of {steps.length}
          </span>

          <Button
            type="button"
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            className="flex items-center"
            data-testid={currentStep === steps.length - 1 ? "wizard-submit-button" : "wizard-next-button"}
          >
            {isSubmitting ? (
              "Submitting..."
            ) : currentStep === steps.length - 1 ? (
              "Complete"
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper hook for managing wizard state
 */
export function useClaimWizard(initialStep = 0) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  const nextStep = () => {
    setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  const reset = () => {
    setCurrentStep(initialStep);
    setIsSubmitting(false);
  };

  return {
    currentStep,
    isSubmitting,
    setIsSubmitting,
    goToStep,
    nextStep,
    prevStep,
    reset,
  };
}