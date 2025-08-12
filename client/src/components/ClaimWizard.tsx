import { useState, useEffect, useCallback } from "react";
import { Check, ChevronLeft, ChevronRight, Save, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { saveDraft, getDraft } from "@/lib/indexeddb";

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
  draftId?: string;
  onDataChange?: (stepId: string, data: any) => void;
  showProgressIndicator?: boolean;
  allowSkipOptional?: boolean;
}

/**
 * ClaimWizard - A multi-step form wizard component with autosave
 * 
 * Features:
 * - Visual progress indicator with step numbers and completion states
 * - Navigation between steps with validation
 * - Auto-save draft to IndexedDB every 2 seconds
 * - Skip optional steps
 * - Accessible keyboard navigation
 * - Responsive design for mobile and desktop
 * - Loading states and error handling
 */
export function ClaimWizard({
  steps,
  currentStep,
  onStepChange,
  onComplete,
  isSubmitting = false,
  canProceed = true,
  className,
  draftId = 'claim-wizard-draft',
  onDataChange,
  showProgressIndicator = true,
  allowSkipOptional = true,
}: ClaimWizardProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [stepData, setStepData] = useState<Record<string, any>>({});
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load draft data on mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await getDraft(draftId);
        if (draft) {
          setStepData(draft.data || {});
          setLastSavedAt(new Date(draft.lastSaved));
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
      }
    };

    loadDraft();
  }, [draftId]);

  // Auto-save every 2 seconds when data changes
  useEffect(() => {
    if (Object.keys(stepData).length === 0) return;

    const saveTimer = setTimeout(() => {
      saveDraftData();
    }, 2000);

    return () => clearTimeout(saveTimer);
  }, [stepData]);

  const saveDraftData = useCallback(async () => {
    if (Object.keys(stepData).length === 0) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await saveDraft(draftId, {
        currentStep,
        completedSteps: Array.from(completedSteps),
        data: stepData,
        lastSaved: new Date().toISOString(),
      });
      setLastSavedAt(new Date());
    } catch (error) {
      console.error('Failed to save draft:', error);
      setSaveError('Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  }, [draftId, currentStep, completedSteps, stepData]);

  const handleStepDataChange = useCallback((data: any) => {
    const currentStepId = steps[currentStep]?.id;
    if (!currentStepId) return;

    setStepData(prev => ({
      ...prev,
      [currentStepId]: { ...prev[currentStepId], ...data }
    }));

    if (onDataChange) {
      onDataChange(currentStepId, data);
    }
  }, [currentStep, steps, onDataChange]);

  const canSkipCurrentStep = () => {
    return allowSkipOptional && steps[currentStep]?.isOptional;
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1 && (canProceed || canSkipCurrentStep())) {
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

  const handleSkip = () => {
    if (canSkipCurrentStep() && currentStep < steps.length - 1) {
      onStepChange(currentStep + 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    // Allow clicking on previous steps, current step, or completed steps
    if (stepIndex <= currentStep || completedSteps.has(stepIndex)) {
      onStepChange(stepIndex);
    }
  };

  const currentStepData = steps[currentStep];

  return (
    <div className={cn("w-full max-w-4xl mx-auto", className)}>
      {/* Auto-save Status */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          {isSaving && (
            <>
              <Save className="h-3 w-3 animate-pulse" />
              <span>Saving draft...</span>
            </>
          )}
          {lastSavedAt && !isSaving && (
            <>
              <Check className="h-3 w-3 text-green-600" />
              <span>Saved {lastSavedAt.toLocaleTimeString()}</span>
            </>
          )}
          {saveError && (
            <>
              <AlertCircle className="h-3 w-3 text-red-600" />
              <span className="text-red-600">{saveError}</span>
            </>
          )}
        </div>
        
        {showProgressIndicator && (
          <div className="text-xs text-slate-500">
            Step {currentStep + 1} of {steps.length}
          </div>
        )}
      </div>

      {/* Progress Steps Header */}
      {showProgressIndicator && (
        <div className="mb-8">
          <nav aria-label="Progress" className="mb-4">
            <ol role="list" className="flex items-center justify-between">
              {steps.map((step, index) => {
                const isActive = index === currentStep;
                const isCompleted = completedSteps.has(index);
                const isAccessible = index <= currentStep || completedSteps.has(index);
                
                return (
                  <li key={step.id} className="relative flex-1">
                    {index > 0 && (
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="h-0.5 w-full bg-slate-200">
                          <div 
                            className={cn(
                              "h-0.5 bg-blue-600 transition-all duration-500",
                              isCompleted || index <= currentStep ? "w-full" : "w-0"
                            )} 
                          />
                        </div>
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => handleStepClick(index)}
                      disabled={!isAccessible}
                      className={cn(
                        "relative w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold transition-all duration-200",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                        isActive && "bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2",
                        isCompleted && !isActive && "bg-green-600 text-white",
                        !isActive && !isCompleted && isAccessible && "bg-slate-200 text-slate-600 hover:bg-slate-300",
                        !isAccessible && "bg-slate-100 text-slate-400 cursor-not-allowed"
                      )}
                      aria-current={isActive ? "step" : undefined}
                      data-testid={`step-${index}`}
                    >
                      {isCompleted ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </button>
                    
                    <div className="mt-2 text-center">
                      <div className={cn(
                        "text-xs font-medium transition-colors duration-200",
                        isActive && "text-blue-600",
                        isCompleted && "text-green-600",
                        !isActive && !isCompleted && "text-slate-500"
                      )}>
                        {step.title}
                        {step.isOptional && (
                          <Badge variant="secondary" className="ml-1 text-xs">
                            Optional
                          </Badge>
                        )}
                      </div>
                      {step.description && (
                        <div className="text-xs text-slate-400 mt-1 max-w-24 truncate">
                          {step.description}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
      )}

      {/* Step Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <span>{currentStepData.title}</span>
                {currentStepData.isOptional && (
                  <Badge variant="outline">Optional</Badge>
                )}
              </CardTitle>
              {currentStepData.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {currentStepData.description}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Step Component */}
          <div data-testid={`step-content-${currentStepData.id}`}>
            {currentStepData.component}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
              data-testid="button-back"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            <div className="flex items-center space-x-2">
              {canSkipCurrentStep() && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkip}
                  data-testid="button-skip"
                >
                  Skip Step
                </Button>
              )}
              
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canProceed && !canSkipCurrentStep() && !isSubmitting}
                data-testid={currentStep === steps.length - 1 ? "button-submit" : "button-next"}
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : currentStep === steps.length - 1 ? (
                  'Submit Claim'
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}