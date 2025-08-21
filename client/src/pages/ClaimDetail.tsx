import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/StatusBadge";
import { ClaimTimeline } from "@/components/ClaimTimeline";
import { OfflineBanner } from "@/components/OfflineBanner";
import { FileText, Download, Edit2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import type { Claim, Patient, Provider, Insurer, Attachment } from "@shared/schema";

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

  const { data: claim, isLoading: claimLoading, error } = useQuery<Claim>({
    queryKey: ["/api/claims", params.id],
    retry: false,
  });

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    retry: false,
  });

  const { data: providers } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
    retry: false,
  });

  const { data: insurers } = useQuery<Insurer[]>({
    queryKey: ["/api/insurers"],
    retry: false,
  });

  const { data: attachments } = useQuery<Attachment[]>({
    queryKey: ["/api/attachments", params.id],
    enabled: !!claim,
    retry: false,
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
      <>
        <OfflineBanner />
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </>
    );
  }

  if (!claim) {
    return (
      <>
        <OfflineBanner />
        <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
          <h2 className="text-2xl font-semibold">Claim Not Found</h2>
          <p className="text-muted-foreground">The requested claim could not be found.</p>
          <Button asChild>
            <Link href="/claims">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return to Claims
            </Link>
          </Button>
        </div>
      </>
    );
  }

  const patient = patients?.find((p) => p.id === claim.patientId);
  const provider = providers?.find((p) => p.id === claim.providerId);
  const insurer = insurers?.find((i) => i.id === claim.insurerId);

  return (
    <>
      <OfflineBanner />
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/claims">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Claims
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Claim #{claim.id.slice(-8).toUpperCase()}
              </h1>
              <p className="text-muted-foreground mt-1">
                {claim.type === 'preauth' ? 'Pre-Authorization' : 'Insurance Claim'} • 
                Submitted {claim.createdAt ? new Date(claim.createdAt).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <StatusBadge status={claim.status} />
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Claim Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Claim Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="font-medium mb-3">Patient Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">{patient?.name || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date of Birth:</span>
                        <span className="font-medium">
                          {patient?.dob ? new Date(patient.dob).toLocaleDateString() : 'Not provided'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Health Card:</span>
                        <span className="font-medium">
                          {(patient?.identifiers as any)?.healthCardNumber || 'Not provided'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-3">Provider Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">{provider?.name || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">License:</span>
                        <span className="font-medium">{provider?.licenceNumber || 'Not provided'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Discipline:</span>
                        <span className="font-medium">{provider?.discipline || 'Not provided'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-3">Insurer Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">{insurer?.name || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rail:</span>
                        <span className="font-medium">{insurer?.rail || 'Not provided'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-3">Financial Details</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount:</span>
                        <span className="font-medium text-lg">
                          {new Intl.NumberFormat('en-CA', {
                            style: 'currency',
                            currency: 'CAD',
                          }).format(parseFloat(claim.amount))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Service Date:</span>
                        <span className="font-medium">
                          {claim.appointmentId ? 'Appointment linked' : 'Not provided'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {claim.notes && (
                  <div>
                    <h3 className="font-medium mb-3">Notes</h3>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                      {claim.notes}
                    </p>
                  </div>
                )}

                {claim.codes && Array.isArray(claim.codes) && (claim.codes as string[]).length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3">Service Codes</h3>
                    <div className="flex flex-wrap gap-2">
                      {(claim.codes as string[]).map((code: string, index: number) => (
                        <Badge key={index} variant="secondary">
                          {code}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Attachments */}
            {attachments && attachments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Attachments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{attachment.kind}</p>
                            <p className="text-xs text-muted-foreground">
                              {attachment.mime}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status & Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Status Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ClaimTimeline 
                  claim={{
                    id: claim.id,
                    status: claim.status,
                    createdAt: claim.createdAt,
                    updatedAt: claim.updatedAt,
                    notes: claim.notes || undefined
                  }}
                />
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  disabled={['paid', 'denied'].includes(claim.status)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Claim
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  asChild
                >
                  <Link href={`/claims/${params.id}/duplicate`}>
                    <FileText className="h-4 w-4 mr-2" />
                    Duplicate Claim
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}