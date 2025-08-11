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

interface PreAuthFormData {
  patientId: string;
  providerId: string;
  insurerId: string;
  amount: string;
  codes: string[];
  notes: string;
  treatmentPlan: string;
  sessionCount: string;
  startDate: string;
  endDate: string;
}

const DRAFT_KEY = 'new-preauth-draft';

export default function NewPreAuth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<PreAuthFormData>({
    patientId: '',
    providerId: '',
    insurerId: '',
    amount: '',
    codes: [''],
    notes: '',
    treatmentPlan: '',
    sessionCount: '',
    startDate: '',
    endDate: '',
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
          lastSaved: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to save draft:', error);
      }
    }, 2000);

    return () => clearTimeout(saveTimer);
  }, [formData, attachments]);

  const { data: patients } = useQuery({
    queryKey: ["/api/patients"],
    retry: false,
  });

  const { data: providers } = useQuery({
    queryKey: ["/api/providers"],
    retry: false,
  });

  const { data: insurers } = useQuery({
    queryKey: ["/api/insurers"],
    retry: false,
  });

  const createPreAuthMutation = useMutation({
    mutationFn: async (preAuthData: any) => {
      const response = await apiRequest("POST", "/api/claims", preAuthData);
      return response.json();
    },
    onSuccess: async (preAuth) => {
      // Create attachments
      for (const attachment of attachments) {
        await apiRequest("POST", "/api/attachments", {
          claimId: preAuth.id,
          url: attachment.url,
          mime: attachment.type,
          kind: attachment.type.includes('pdf') ? 'pdf' : 'photo',
        });
      }

      await clearOfflineDraft(DRAFT_KEY);
      
      toast({
        title: "Success",
        description: "Pre-authorization created successfully",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/claims"] });
      setLocation(`/claims/${preAuth.id}`);
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
        description: "Failed to create pre-authorization",
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
    const preAuthData = {
      ...formData,
      type: 'preauth' as const,
      amount: parseFloat(formData.amount),
      codes: formData.codes.filter(code => code.trim() !== ''),
      notes: `${formData.notes}\n\nTreatment Plan: ${formData.treatmentPlan}\nSessions: ${formData.sessionCount}\nDuration: ${formData.startDate} to ${formData.endDate}`.trim(),
    };

    createPreAuthMutation.mutate(preAuthData);
  };

  const canSubmit = formData.patientId && formData.providerId && formData.insurerId && 
                   formData.amount && formData.codes.some(code => code.trim() !== '') &&
                   formData.treatmentPlan && formData.sessionCount;

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
          <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl">New Pre-Authorization</h2>
          <p className="mt-1 text-sm text-slate-600">Request approval for treatment services before proceeding</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-8">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-4">Basic Information</h3>
                
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
                    <Label htmlFor="amount">Total Estimated Amount *</Label>
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
                </div>

                <div className="mt-6">
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
              </div>

              {/* Treatment Plan */}
              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-4">Treatment Plan</h3>
                
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="sessionCount">Number of Sessions *</Label>
                    <Input
                      id="sessionCount"
                      type="number"
                      placeholder="e.g., 12"
                      value={formData.sessionCount}
                      onChange={(e) => updateFormData('sessionCount', e.target.value)}
                      className="mt-1"
                      data-testid="input-sessions"
                    />
                  </div>

                  <div>
                    <Label htmlFor="startDate">Treatment Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => updateFormData('startDate', e.target.value)}
                      className="mt-1"
                      data-testid="input-start-date"
                    />
                  </div>

                  <div>
                    <Label htmlFor="endDate">Estimated End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => updateFormData('endDate', e.target.value)}
                      className="mt-1"
                      data-testid="input-end-date"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <Label htmlFor="treatmentPlan">Treatment Plan Details *</Label>
                  <Textarea
                    id="treatmentPlan"
                    rows={4}
                    placeholder="Describe the proposed treatment plan, goals, and expected outcomes..."
                    value={formData.treatmentPlan}
                    onChange={(e) => updateFormData('treatmentPlan', e.target.value)}
                    className="mt-1"
                    data-testid="textarea-treatment-plan"
                  />
                </div>
              </div>

              {/* Attachments */}
              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-4">Supporting Documentation</h3>
                
                <div className="mb-6">
                  <ObjectUploader
                    maxNumberOfFiles={5}
                    maxFileSize={10485760}
                    onGetUploadParameters={handleGetUploadParameters}
                    onComplete={handleUploadComplete}
                    accept=".pdf,.jpg,.jpeg,.png"
                  >
                    <i className="fas fa-cloud-upload-alt mr-2"></i>
                    Upload Documents
                  </ObjectUploader>
                  <p className="mt-2 text-sm text-slate-500">
                    Upload treatment plans, medical reports, or other supporting documentation
                  </p>
                </div>

                {attachments.length > 0 && (
                  <div>
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
              </div>

              {/* Additional Notes */}
              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="Any additional information or special considerations..."
                  value={formData.notes}
                  onChange={(e) => updateFormData('notes', e.target.value)}
                  className="mt-1"
                  data-testid="textarea-notes"
                />
              </div>
            </div>

            {/* Auto-save indicator */}
            <div className="mt-6 flex items-center text-sm text-slate-500">
              <i className="fas fa-save mr-2"></i>
              <span>Draft saved automatically</span>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex justify-end space-x-3">
              <Link href="/claims">
                <Button variant="outline" data-testid="button-cancel">
                  Cancel
                </Button>
              </Link>

              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || createPreAuthMutation.isPending}
                data-testid="button-submit"
              >
                {createPreAuthMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Creating...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check mr-2"></i>
                    Submit Pre-Authorization
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
