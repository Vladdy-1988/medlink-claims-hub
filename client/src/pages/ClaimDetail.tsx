import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { Link } from "wouter";

interface ClaimDetailProps {
  params: { id: string };
}

export default function ClaimDetail({ params }: ClaimDetailProps) {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

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

  const { data: claim, isLoading: claimLoading, error } = useQuery({
    queryKey: ["/api/claims", params.id],
    retry: false,
  });

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

  const submitClaimMutation = useMutation({
    mutationFn: async (rail: string) => {
      await apiRequest("POST", "/api/connectors/submit", { claimId: params.id, rail });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Claim submitted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/claims", params.id] });
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
        description: "Failed to submit claim",
        variant: "destructive",
      });
    },
  });

  const checkStatusMutation = useMutation({
    mutationFn: async () => {
      // Simulate status check
      return await new Promise(resolve => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Claim status has been refreshed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/claims", params.id] });
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
        description: "Failed to check status",
        variant: "destructive",
      });
    },
  });

  if (error && isUnauthorizedError(error as Error)) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
    return null;
  }

  if (claimLoading) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-slate-500">Loading claim details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <Card>
            <CardContent className="p-8 text-center">
              <i className="fas fa-exclamation-triangle text-4xl text-yellow-500 mb-4"></i>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Claim Not Found</h3>
              <p className="text-slate-500 mb-4">The claim you're looking for doesn't exist or you don't have access to it.</p>
              <Link href="/claims">
                <Button>Back to Claims</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getPatientName = (patientId: string) => {
    const patient = patients?.find((p: any) => p.id === patientId);
    return patient?.name || 'Unknown Patient';
  };

  const getProviderName = (providerId: string) => {
    const provider = providers?.find((p: any) => p.id === providerId);
    return provider?.name || 'Unknown Provider';
  };

  const getInsurerName = (insurerId: string) => {
    const insurer = insurers?.find((i: any) => i.id === insurerId);
    return insurer?.name || 'Unknown Insurer';
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return 'fas fa-edit';
      case 'submitted': return 'fas fa-paper-plane';
      case 'pending': return 'fas fa-clock';
      case 'infoRequested': return 'fas fa-question-circle';
      case 'paid': return 'fas fa-check-circle';
      case 'denied': return 'fas fa-times-circle';
      default: return 'fas fa-file';
    }
  };

  // Mock timeline events based on claim status
  const getTimelineEvents = () => {
    const events = [
      {
        title: 'Claim Created',
        description: `Initial ${claim.type} created by ${getProviderName(claim.providerId)}`,
        time: formatDate(claim.createdAt),
        icon: 'fas fa-plus-circle',
        color: 'bg-success-600',
      },
    ];

    if (claim.status !== 'draft') {
      events.push({
        title: 'Submitted to Insurer',
        description: `${claim.type} transmitted to ${getInsurerName(claim.insurerId)}`,
        time: formatDate(claim.updatedAt),
        icon: 'fas fa-paper-plane',
        color: 'bg-primary-600',
      });
    }

    if (['pending', 'infoRequested', 'paid', 'denied'].includes(claim.status)) {
      events.push({
        title: 'Under Review',
        description: 'Claim is being processed by the insurance provider',
        time: formatDate(claim.updatedAt),
        icon: 'fas fa-search',
        color: 'bg-warning-600',
      });
    }

    return events;
  };

  const timelineEvents = getTimelineEvents();

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Breadcrumb */}
        <nav className="flex mb-8" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            <li className="inline-flex items-center">
              <Link href="/" className="inline-flex items-center text-sm font-medium text-slate-700 hover:text-primary-600">
                <i className="fas fa-home mr-2"></i>
                Dashboard
              </Link>
            </li>
            <li>
              <div className="flex items-center">
                <i className="fas fa-chevron-right text-slate-400 mx-2"></i>
                <Link href="/claims" className="text-sm font-medium text-slate-700 hover:text-primary-600">
                  Claims
                </Link>
              </div>
            </li>
            <li aria-current="page">
              <div className="flex items-center">
                <i className="fas fa-chevron-right text-slate-400 mx-2"></i>
                <span className="text-sm font-medium text-slate-500" data-testid="breadcrumb-claim-id">
                  {claim.id.slice(-8)}
                </span>
              </div>
            </li>
          </ol>
        </nav>

        {/* Claim Header */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="sm:flex sm:items-center sm:justify-between">
              <div className="sm:flex sm:space-x-5">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center">
                    <span className="text-slate-600 font-medium text-lg" data-testid="patient-initials">
                      {getPatientName(claim.patientId).split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                </div>
                <div className="mt-4 text-center sm:mt-0 sm:pt-1 sm:text-left">
                  <p className="text-xl font-bold text-slate-900 sm:text-2xl" data-testid="patient-name">
                    {getPatientName(claim.patientId)}
                  </p>
                  <p className="text-sm font-medium text-slate-600" data-testid="claim-type">
                    {claim.type === 'claim' ? 'Treatment Claim' : 'Pre-Authorization'}
                  </p>
                  <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:space-x-6">
                    <div className="mt-2 flex items-center text-sm text-slate-500">
                      <i className="fas fa-id-card mr-1.5 text-slate-400"></i>
                      <span data-testid="claim-id">{claim.id.slice(-8)}</span>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-slate-500">
                      <i className="fas fa-calendar mr-1.5 text-slate-400"></i>
                      <span data-testid="claim-date">{formatDate(claim.createdAt)}</span>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-slate-500">
                      <i className="fas fa-dollar-sign mr-1.5 text-slate-400"></i>
                      <span data-testid="claim-amount">{formatCurrency(claim.amount)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex justify-center sm:mt-0">
                <StatusBadge status={claim.status}>
                  <i className={`${getStatusIcon(claim.status)} mr-2`}></i>
                  {claim.status.replace(/([A-Z])/g, ' $1').trim()}
                </StatusBadge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Claim Timeline */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg leading-6 font-medium text-slate-900 mb-6">Claim Timeline</h3>
                <div className="flow-root">
                  <ul className="-mb-8">
                    {timelineEvents.map((event, index) => (
                      <li key={index} className="relative">
                        <div className="relative flex items-start space-x-3">
                          <div className="relative">
                            <div className={`w-4 h-4 ${event.color} border-2 border-white rounded-full flex items-center justify-center ring-8 ring-white`}>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1 py-1.5">
                            <div className="text-sm text-slate-700">
                              <span className="font-medium text-slate-900" data-testid={`timeline-event-${index}-title`}>
                                {event.title}
                              </span>
                              <span className="whitespace-nowrap text-slate-500 ml-2" data-testid={`timeline-event-${index}-time`}>
                                {event.time}
                              </span>
                            </div>
                            <div className="mt-2 text-sm text-slate-600" data-testid={`timeline-event-${index}-description`}>
                              {event.description}
                            </div>
                          </div>
                        </div>
                        {index < timelineEvents.length - 1 && (
                          <div className="absolute left-2 top-8 bottom-0 w-0.5 bg-slate-200"></div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Claim Details & Attachments */}
          <div className="space-y-8">
            {/* Claim Details */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg leading-6 font-medium text-slate-900 mb-4">Claim Details</h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Service Codes</dt>
                    <dd className="text-sm text-slate-900" data-testid="service-codes">
                      {claim.codes?.join(', ') || 'No codes specified'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Provider</dt>
                    <dd className="text-sm text-slate-900" data-testid="provider-name">
                      {getProviderName(claim.providerId)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Insurance</dt>
                    <dd className="text-sm text-slate-900" data-testid="insurer-name">
                      {getInsurerName(claim.insurerId)}
                    </dd>
                  </div>
                  {claim.referenceNumber && (
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Reference Number</dt>
                      <dd className="text-sm text-slate-900" data-testid="reference-number">
                        {claim.referenceNumber}
                      </dd>
                    </div>
                  )}
                  {claim.notes && (
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Notes</dt>
                      <dd className="text-sm text-slate-900" data-testid="claim-notes">
                        {claim.notes}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Attachments */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-slate-900">Attachments</h3>
                </div>
                <div className="text-center py-4">
                  {claim.attachments && claim.attachments.length > 0 ? (
                    <ul className="space-y-3">
                      {claim.attachments.map((attachment: any) => (
                        <li key={attachment.id} className="flex items-center justify-between" data-testid={`attachment-${attachment.id}`}>
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                                <i className={`fas ${attachment.mime.includes('pdf') ? 'fa-file-pdf text-red-500' : 'fa-image text-blue-500'} text-sm`}></i>
                              </div>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-slate-900">{attachment.url.split('/').pop()}</p>
                              <p className="text-xs text-slate-500">{attachment.mime}</p>
                            </div>
                          </div>
                          <button className="text-primary-600 hover:text-primary-500 text-sm">
                            <i className="fas fa-download"></i>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-slate-500">
                      <i className="fas fa-paperclip text-2xl mb-2 text-slate-300"></i>
                      <p>No attachments</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg leading-6 font-medium text-slate-900 mb-4">Actions</h3>
                <div className="space-y-3">
                  <Button
                    onClick={() => checkStatusMutation.mutate()}
                    disabled={checkStatusMutation.isPending}
                    className="w-full"
                    data-testid="button-check-status"
                  >
                    {checkStatusMutation.isPending ? (
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                    ) : (
                      <i className="fas fa-sync mr-2"></i>
                    )}
                    Check Status
                  </Button>
                  
                  {claim.status === 'draft' && (
                    <Button
                      onClick={() => submitClaimMutation.mutate('telusEclaims')}
                      disabled={submitClaimMutation.isPending}
                      variant="outline"
                      className="w-full"
                      data-testid="button-submit-claim"
                    >
                      {submitClaimMutation.isPending ? (
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                      ) : (
                        <i className="fas fa-paper-plane mr-2"></i>
                      )}
                      Submit Claim
                    </Button>
                  )}
                  
                  <Button variant="outline" className="w-full" data-testid="button-print-claim">
                    <i className="fas fa-print mr-2"></i>
                    Print Claim
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
