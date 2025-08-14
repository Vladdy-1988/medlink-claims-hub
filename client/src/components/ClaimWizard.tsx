import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "./FileUpload";
import { ChevronLeft, ChevronRight, Check, Upload, User, FileText, Send } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { get, set, clear } from "idb-keyval";
import { useLocation } from "wouter";

interface Patient {
  id: string;
  name: string;
  dob?: string;
  identifiers?: any;
}

interface Provider {
  id: string;
  name: string;
  discipline?: string;
}

interface Insurer {
  id: string;
  name: string;
  rail: string;
}

interface ClaimData {
  patientId: string;
  providerId: string;
  insurerId: string;
  type: 'claim' | 'preauth';
  amount: string;
  codes: any[];
  notes: string;
  attachmentIds: string[];
}

interface ClaimWizardProps {
  type?: 'claim' | 'preauth';
  initialData?: Partial<ClaimData>;
  onComplete?: (claimId: string) => void;
}

const AUTOSAVE_KEY = 'medlink-claim-draft';
const AUTOSAVE_INTERVAL = 2000; // 2 seconds

export function ClaimWizard({ type = 'claim', initialData, onComplete }: ClaimWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [claimData, setClaimData] = useState<ClaimData>({
    patientId: '',
    providerId: '',
    insurerId: '',
    type,
    amount: '',
    codes: [],
    notes: '',
    attachmentIds: [],
    ...initialData
  });

  const [procedureCode, setProcedureCode] = useState('');
  const [procedureDescription, setProcedureDescription] = useState('');
  const [procedureAmount, setProcedureAmount] = useState('');

  // Load draft data from IndexedDB
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await get(AUTOSAVE_KEY);
        if (draft && !initialData) {
          setClaimData(draft);
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
      }
    };
    loadDraft();
  }, [initialData]);

  // Auto-save to IndexedDB
  useEffect(() => {
    const saveInterval = setInterval(async () => {
      try {
        await set(AUTOSAVE_KEY, claimData);
      } catch (error) {
        console.error('Failed to auto-save draft:', error);
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(saveInterval);
  }, [claimData]);

  const { data: patients, isLoading: loadingPatients } = useQuery({
    queryKey: ['/api/patients'],
  });

  const { data: providers, isLoading: loadingProviders } = useQuery({
    queryKey: ['/api/providers'],
  });

  const { data: insurers, isLoading: loadingInsurers } = useQuery({
    queryKey: ['/api/insurers'],
  });

  const submitMutation = useMutation({
    mutationFn: async (data: ClaimData) => {
      return apiRequest(`/api/claims`, 'POST', {
        ...data,
        amount: parseFloat(data.amount),
      });
    },
    onSuccess: async (response: any) => {
      await clear(AUTOSAVE_KEY); // Clear draft after successful submission
      toast({
        title: "Success",
        description: `${type === 'preauth' ? 'Pre-authorization' : 'Claim'} submitted successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/claims'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      if (onComplete) {
        onComplete(response.id);
      } else {
        setLocation(`/claims/${response.id}`);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || `Failed to submit ${type}`,
        variant: "destructive",
      });
    },
  });

  const totalSteps = type === 'preauth' ? 2 : 3; // Pre-auth skips attachments step

  const updateClaimData = (updates: Partial<ClaimData>) => {
    setClaimData(prev => ({ ...prev, ...updates }));
  };

  const addProcedureCode = () => {
    if (!procedureCode || !procedureAmount) return;
    
    const newCode = {
      code: procedureCode,
      description: procedureDescription || '',
      amount: parseFloat(procedureAmount),
    };

    updateClaimData({
      codes: [...claimData.codes, newCode],
      amount: (parseFloat(claimData.amount || '0') + newCode.amount).toString(),
    });

    setProcedureCode('');
    setProcedureDescription('');
    setProcedureAmount('');
  };

  const removeProcedureCode = (index: number) => {
    const removedCode = claimData.codes[index];
    const newCodes = claimData.codes.filter((_, i) => i !== index);
    const newAmount = (parseFloat(claimData.amount) - removedCode.amount).toString();
    
    updateClaimData({
      codes: newCodes,
      amount: newAmount,
    });
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return claimData.patientId && claimData.providerId && claimData.insurerId;
      case 2:
        return claimData.codes.length > 0 && parseFloat(claimData.amount) > 0;
      case 3:
        return true; // Attachments are optional
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceedToNext() && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    if (!canProceedToNext()) return;
    submitMutation.mutate(claimData);
  };

  const steps = [
    { number: 1, title: "Patient & Provider", icon: User },
    { number: 2, title: "Services & Codes", icon: FileText },
    ...(type === 'claim' ? [{ number: 3, title: "Attachments", icon: Upload }] : [])
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.number;
          const isCompleted = currentStep > step.number;
          
          return (
            <div key={step.number} className="flex items-center">
              <div className={`
                flex items-center justify-center w-10 h-10 rounded-full border-2
                ${isCompleted ? 'bg-green-500 border-green-500 text-white' : 
                  isActive ? 'bg-blue-500 border-blue-500 text-white' : 
                  'border-gray-300 text-gray-400'}
              `} data-testid={`step-${step.number}`}>
                {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                  Step {step.number}
                </p>
                <p className={`text-xs ${isActive ? 'text-blue-500' : isCompleted ? 'text-green-500' : 'text-gray-400'}`}>
                  {step.title}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-px mx-4 ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            {currentStep === 1 && "Patient & Provider Information"}
            {currentStep === 2 && "Services & Procedure Codes"}
            {currentStep === 3 && "Attachments & Submit"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Patient & Provider */}
          {currentStep === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="patient">Patient *</Label>
                <Select 
                  value={claimData.patientId} 
                  onValueChange={(value) => updateClaimData({ patientId: value })}
                  disabled={loadingPatients}
                >
                  <SelectTrigger data-testid="select-patient">
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients && Array.isArray(patients) && patients.map((patient: Patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="provider">Provider *</Label>
                <Select 
                  value={claimData.providerId} 
                  onValueChange={(value) => updateClaimData({ providerId: value })}
                  disabled={loadingProviders}
                >
                  <SelectTrigger data-testid="select-provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers && Array.isArray(providers) && providers.map((provider: Provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name} {provider.discipline && `(${provider.discipline})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="insurer">Insurance Provider *</Label>
                <Select 
                  value={claimData.insurerId} 
                  onValueChange={(value) => updateClaimData({ insurerId: value })}
                  disabled={loadingInsurers}
                >
                  <SelectTrigger data-testid="select-insurer">
                    <SelectValue placeholder="Select insurer" />
                  </SelectTrigger>
                  <SelectContent>
                    {insurers && Array.isArray(insurers) && insurers.map((insurer: Insurer) => (
                      <SelectItem key={insurer.id} value={insurer.id}>
                        {insurer.name}
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {insurer.rail}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 2: Services & Codes */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Add Procedure Code */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
                <div className="space-y-2">
                  <Label htmlFor="code">Procedure Code *</Label>
                  <Input
                    id="code"
                    value={procedureCode}
                    onChange={(e) => setProcedureCode(e.target.value)}
                    placeholder="e.g., D0150"
                    data-testid="input-procedure-code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={procedureDescription}
                    onChange={(e) => setProcedureDescription(e.target.value)}
                    placeholder="e.g., Comprehensive exam"
                    data-testid="input-procedure-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={procedureAmount}
                    onChange={(e) => setProcedureAmount(e.target.value)}
                    placeholder="0.00"
                    data-testid="input-procedure-amount"
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={addProcedureCode}
                    disabled={!procedureCode || !procedureAmount}
                    data-testid="button-add-procedure"
                  >
                    Add Code
                  </Button>
                </div>
              </div>

              {/* Added Codes List */}
              {claimData.codes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium">Added Procedures:</h3>
                  {claimData.codes.map((code, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`procedure-${index}`}>
                      <div className="flex-1">
                        <div className="font-mono text-sm font-semibold">{code.code}</div>
                        {code.description && <div className="text-sm text-muted-foreground">{code.description}</div>}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">${code.amount.toFixed(2)}</div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removeProcedureCode(index)}
                          className="text-red-600 hover:text-red-800"
                          data-testid={`button-remove-procedure-${index}`}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="text-right pt-3 border-t">
                    <div className="text-lg font-bold">Total: ${parseFloat(claimData.amount || '0').toFixed(2)}</div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={claimData.notes}
                  onChange={(e) => updateClaimData({ notes: e.target.value })}
                  placeholder="Any additional information or special instructions..."
                  className="min-h-[100px]"
                  data-testid="textarea-notes"
                />
              </div>
            </div>
          )}

          {/* Step 3: Attachments (only for claims, not pre-auths) */}
          {currentStep === 3 && type === 'claim' && (
            <div className="space-y-6">
              <FileUpload
                onUpload={(files) => {
                  const fileIds = files.map(f => f.id);
                  updateClaimData({ 
                    attachmentIds: [...claimData.attachmentIds, ...fileIds] 
                  });
                }}
                maxFiles={10}
                accept="image/*,application/pdf"
                data-testid="file-upload"
              />
              
              {claimData.attachmentIds.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">Attached Files:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {claimData.attachmentIds.map((fileId, index) => (
                      <div key={fileId} className="flex items-center justify-between p-3 border rounded-lg">
                        <span className="text-sm">Attachment {index + 1}</span>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            updateClaimData({
                              attachmentIds: claimData.attachmentIds.filter(id => id !== fileId)
                            });
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handleBack}
          disabled={currentStep === 1}
          data-testid="button-back"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="space-x-2">
          {currentStep === totalSteps ? (
            <Button 
              onClick={handleSubmit}
              disabled={!canProceedToNext() || submitMutation.isPending}
              data-testid="button-submit"
            >
              {submitMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit {type === 'preauth' ? 'Pre-authorization' : 'Claim'}
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={handleNext}
              disabled={!canProceedToNext()}
              data-testid="button-next"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}