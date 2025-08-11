import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { saveOfflineDraft, getOfflineDraft, clearOfflineDraft } from "@/lib/indexeddb";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Link, useLocation } from "wouter";

interface ClaimFormData {
  patientId: string;
  providerId: string;
  insurerId: string;
  type: 'claim' | 'preauth';
  amount: string;
  codes: string[];
  notes: string;
  diagnosis: string;
  referralRequired: string;
}

const DRAFT_KEY = 'new-claim-draft';

export default function NewClaim() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ClaimFormData>({
    patientId: '',
    providerId: '',
    insurerId: '',
    type: 'claim',
    amount: '',
    codes: [''],
    notes: '',
    diagnosis: '',
    referralRequired: 'no',
  });
  const [attachments, setAttachments] = useState<Array<{ url: string; name: string; size: number; type: string }>>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Load draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await getOfflineDraft(DRAFT_KEY);
        if (draft) {
          setFormData(draft.formData || formData);
          setAttachments(draft.attachments || []);
          setCurrentStep(draft.currentStep || 1);
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
      }
    };
    loadDraft();
  }, []);

  // Auto-save every 2 seconds
  useEffect(() => {
    const saveTimer = setTimeout(async () => {
      try {
        await saveOfflineDraft(DRAFT_KEY, {
          formData,
          attachments,
          currentStep,
          lastSaved: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to save draft:', error);
      }
    }, 2000);

    return () => clearTimeout(saveTimer);
  }, [formData, attachments, currentStep]);

  const { data: patients = [] } = useQuery({
    queryKey: ["/api/patients"],
    retry: false,
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["/api/providers"],
    retry: false,
  });

  const { data: insurers = [] } = useQuery({
    queryKey: ["/api/insurers"],
    retry: false,
  });

  const createClaimMutation = useMutation({
    mutationFn: async (claimData: any) => {
      const response = await apiRequest("POST", "/api/claims", claimData);
      return response.json();
    },
    onSuccess: async (claim) => {
      // Create attachments
      for (const attachment of attachments) {
        await apiRequest("POST", "/api/attachments", {
          claimId: claim.id,
          url: attachment.url,
          mime: attachment.type,
          kind: attachment.type.includes('pdf') ? 'pdf' : 'photo',
        });
      }

      await clearOfflineDraft(DRAFT_KEY);
      
      toast({
        title: "Success",
        description: "Claim created successfully",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/claims"] });
      setLocation(`/claims/${claim.id}`);
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create claim",
        variant: "destructive",
      });
    },
  });

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addCode = () => {
    setFormData(prev => ({ ...prev, codes: [...prev.codes, ''] }));
  };

  const updateCode = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      codes: prev.codes.map((code, i) => i === index ? value : code)
    }));
  };

  const removeCode = (index: number) => {
    if (formData.codes.length > 1) {
      setFormData(prev => ({
        ...prev,
        codes: prev.codes.filter((_, i) => i !== index)
      }));
    }
  };

  const handleGetUploadParameters = async () => {
    const response = await apiRequest("POST", "/api/objects/upload", {});
    const data = await response.json();
    return { method: "PUT" as const, url: data.uploadURL };
  };

  const handleUploadComplete = (files: Array<{ url: string; name: string; size: number; type: string }>) => {
    setAttachments(prev => [...prev, ...files]);
    toast({
      title: "Files uploaded",
      description: `${files.length} file(s) uploaded successfully`,
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    const claimData = {
      ...formData,
      amount: parseFloat(formData.amount),
      codes: formData.codes.filter(code => code.trim() !== ''),
    };

    createClaimMutation.mutate(claimData);
  };

  const canProceedToStep2 = formData.patientId && formData.providerId && formData.insurerId && formData.amount;
  const canProceedToStep3 = true; // Step 2 is optional
  const canSubmit = canProceedToStep2 && formData.codes.some(code => code.trim() !== '');

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="py-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl">Create New Claim</h2>
          
          {/* Progress Steps */}
          <nav aria-label="Progress" className="mt-6">
            <ol className="flex items-center">
              <li className="relative pr-8 sm:pr-20">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className={`h-0.5 w-full ${currentStep > 1 ? 'bg-primary-600' : 'bg-slate-200'}`}></div>
                </div>
                <div className={`relative w-8 h-8 flex items-center justify-center rounded-full border-2 ${
                  currentStep >= 1 ? 'bg-primary-600 border-primary-600' : 'bg-white border-slate-300'
                }`}>
                  {currentStep > 1 ? (
                    <i className="fas fa-check text-white text-sm"></i>
                  ) : (
                    <span className={`text-sm font-medium ${currentStep === 1 ? 'text-primary-600' : 'text-slate-500'}`}>1</span>
                  )}
                </div>
              </li>
              <li className="relative pr-8 sm:pr-20">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className={`h-0.5 w-full ${currentStep > 2 ? 'bg-primary-600' : 'bg-slate-200'}`}></div>
                </div>
                <div className={`relative w-8 h-8 flex items-center justify-center rounded-full border-2 ${
                  currentStep >= 2 ? 'bg-primary-600 border-primary-600' : 'bg-white border-slate-300'
                }`}>
                  {currentStep > 2 ? (
                    <i className="fas fa-check text-white text-sm"></i>
                  ) : (
                    <span className={`text-sm font-medium ${currentStep === 2 ? 'text-primary-600' : 'text-slate-500'}`}>2</span>
                  )}
                </div>
              </li>
              <li className="relative">
                <div className={`relative w-8 h-8 flex items-center justify-center rounded-full border-2 ${
                  currentStep >= 3 ? 'bg-primary-600 border-primary-600' : 'bg-white border-slate-300'
                }`}>
                  <span className={`text-sm font-medium ${currentStep === 3 ? 'text-primary-600' : 'text-slate-500'}`}>3</span>
                </div>
              </li>
            </ol>
            <div className="mt-4 flex justify-between text-sm font-medium text-slate-900">
              <span className={currentStep === 1 ? 'text-primary-600' : ''}>Patient & Service</span>
              <span className={currentStep === 2 ? 'text-primary-600' : ''}>Attachments</span>
              <span className={currentStep === 3 ? 'text-primary-600' : ''}>Review & Submit</span>
            </div>
          </nav>
        </div>

        <Card>
          <CardContent className="p-6">
            {/* Step 1: Patient & Service */}
            {currentStep === 1 && (
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-slate-900">Step 1: Patient & Service Information</h3>
                  <p className="mt-1 text-sm text-slate-600">Enter the basic claim information</p>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="patient">Patient *</Label>
                    <Select value={formData.patientId} onValueChange={(value) => updateFormData('patientId', value)}>
                      <SelectTrigger className="mt-1" data-testid="select-patient">
                        <SelectValue placeholder="Select a patient" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients?.map((patient: any) => (
                          <SelectItem key={patient.id} value={patient.id}>
                            {patient.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="provider">Provider *</Label>
                    <Select value={formData.providerId} onValueChange={(value) => updateFormData('providerId', value)}>
                      <SelectTrigger className="mt-1" data-testid="select-provider">
                        <SelectValue placeholder="Select a provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {providers?.map((provider: any) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.name} - {provider.discipline}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="insurer">Insurance Provider *</Label>
                    <Select value={formData.insurerId} onValueChange={(value) => updateFormData('insurerId', value)}>
                      <SelectTrigger className="mt-1" data-testid="select-insurer">
                        <SelectValue placeholder="Select insurance provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {insurers?.map((insurer: any) => (
                          <SelectItem key={insurer.id} value={insurer.id}>
                            {insurer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="amount">Claim Amount *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => updateFormData('amount', e.target.value)}
                      className="mt-1"
                      data-testid="input-amount"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label>Service Codes *</Label>
                    <div className="mt-1 space-y-2">
                      {formData.codes.map((code, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <Input
                            placeholder="Enter service code"
                            value={code}
                            onChange={(e) => updateCode(index, e.target.value)}
                            data-testid={`input-code-${index}`}
                          />
                          {formData.codes.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeCode(index)}
                              data-testid={`remove-code-${index}`}
                            >
                              <i className="fas fa-times"></i>
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addCode}
                        data-testid="add-code"
                      >
                        <i className="fas fa-plus mr-2"></i>
                        Add Service Code
                      </Button>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      rows={3}
                      placeholder="Any additional notes about this claim..."
                      value={formData.notes}
                      onChange={(e) => updateFormData('notes', e.target.value)}
                      className="mt-1"
                      data-testid="textarea-notes"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center text-sm text-slate-500">
                  <i className="fas fa-save mr-2"></i>
                  <span>Draft saved automatically</span>
                </div>
              </div>
            )}

            {/* Step 2: Attachments */}
            {currentStep === 2 && (
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-slate-900">Step 2: Attachments & Documentation</h3>
                  <p className="mt-1 text-sm text-slate-600">Upload supporting documents for your claim</p>
                </div>

                <div className="mb-8">
                  <ObjectUploader
                    maxNumberOfFiles={5}
                    maxFileSize={10485760}
                    onGetUploadParameters={handleGetUploadParameters}
                    onComplete={handleUploadComplete}
                    accept=".pdf,.jpg,.jpeg,.png"
                  >
                    <i className="fas fa-cloud-upload-alt mr-2"></i>
                    Upload Files
                  </ObjectUploader>
                </div>

                {attachments.length > 0 && (
                  <div className="mb-8">
                    <h4 className="text-sm font-medium text-slate-900 mb-3">Uploaded Files ({attachments.length})</h4>
                    <ul className="divide-y divide-slate-200">
                      {attachments.map((attachment, index) => (
                        <li key={index} className="py-3 flex items-center justify-between" data-testid={`attachment-${index}`}>
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                                <i className={`fas ${attachment.type.includes('pdf') ? 'fa-file-pdf text-red-500' : 'fa-image text-blue-500'} text-sm`}></i>
                              </div>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-slate-900">{attachment.name}</p>
                              <p className="text-xs text-slate-500">{formatFileSize(attachment.size)}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttachment(index)}
                            data-testid={`remove-attachment-${index}`}
                          >
                            <i className="fas fa-trash text-slate-400"></i>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="diagnosis">Primary Diagnosis</Label>
                    <Input
                      id="diagnosis"
                      placeholder="e.g., Lower back pain"
                      value={formData.diagnosis}
                      onChange={(e) => updateFormData('diagnosis', e.target.value)}
                      className="mt-1"
                      data-testid="input-diagnosis"
                    />
                  </div>

                  <div>
                    <Label htmlFor="referral">Referral Required</Label>
                    <Select value={formData.referralRequired} onValueChange={(value) => updateFormData('referralRequired', value)}>
                      <SelectTrigger className="mt-1" data-testid="select-referral">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="physician">Yes - Physician</SelectItem>
                        <SelectItem value="specialist">Yes - Specialist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 flex items-center text-sm text-slate-500">
                  <i className="fas fa-save mr-2"></i>
                  <span>Draft saved automatically</span>
                </div>
              </div>
            )}

            {/* Step 3: Review & Submit */}
            {currentStep === 3 && (
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-slate-900">Step 3: Review & Submit</h3>
                  <p className="mt-1 text-sm text-slate-600">Review your claim details before submitting</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-slate-900 mb-3">Claim Information</h4>
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm font-medium text-slate-500">Patient</dt>
                        <dd className="text-sm text-slate-900" data-testid="review-patient">
                          {patients?.find((p: any) => p.id === formData.patientId)?.name || 'Not selected'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-slate-500">Provider</dt>
                        <dd className="text-sm text-slate-900" data-testid="review-provider">
                          {providers?.find((p: any) => p.id === formData.providerId)?.name || 'Not selected'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-slate-500">Insurance</dt>
                        <dd className="text-sm text-slate-900" data-testid="review-insurer">
                          {insurers?.find((i: any) => i.id === formData.insurerId)?.name || 'Not selected'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-slate-500">Amount</dt>
                        <dd className="text-sm text-slate-900" data-testid="review-amount">
                          ${formData.amount || '0.00'}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-slate-500">Service Codes</dt>
                        <dd className="text-sm text-slate-900" data-testid="review-codes">
                          {formData.codes.filter(code => code.trim() !== '').join(', ') || 'None'}
                        </dd>
                      </div>
                      {formData.notes && (
                        <div className="sm:col-span-2">
                          <dt className="text-sm font-medium text-slate-500">Notes</dt>
                          <dd className="text-sm text-slate-900" data-testid="review-notes">{formData.notes}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {attachments.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-900 mb-3">Attachments ({attachments.length})</h4>
                      <ul className="text-sm text-slate-700">
                        {attachments.map((attachment, index) => (
                          <li key={index} data-testid={`review-attachment-${index}`}>
                            • {attachment.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex justify-between">
              <div>
                {currentStep > 1 && (
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    data-testid="button-previous"
                  >
                    <i className="fas fa-arrow-left mr-2"></i>
                    Previous
                  </Button>
                )}
              </div>

              <div className="flex space-x-3">
                <Link href="/claims">
                  <Button variant="outline" data-testid="button-cancel">
                    Cancel
                  </Button>
                </Link>

                {currentStep < 3 ? (
                  <Button
                    onClick={() => setCurrentStep(currentStep + 1)}
                    disabled={currentStep === 1 && !canProceedToStep2}
                    data-testid="button-next"
                  >
                    Continue
                    <i className="fas fa-arrow-right ml-2"></i>
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit || createClaimMutation.isPending}
                    data-testid="button-submit"
                  >
                    {createClaimMutation.isPending ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Creating...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-check mr-2"></i>
                        Create Claim
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
