import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/StatusBadge";
import { ClaimsTable, type ClaimTableData } from "@/components/ClaimsTable";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Plus, X } from "lucide-react";
import { Link } from "wouter";

export default function Claims() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

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

  const { data: claims, isLoading: claimsLoading, error } = useQuery({
    queryKey: ["/api/claims"],
    retry: false,
  });

  const { data: patients } = useQuery({
    queryKey: ["/api/patients"],
    retry: false,
  });

  const { data: insurers } = useQuery({
    queryKey: ["/api/insurers"],
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

  // Transform claims data for the table component
  const tableData: ClaimTableData[] = claims?.map((claim: any) => {
    const patient = patients?.find((p: any) => p.id === claim.patientId);
    const insurer = insurers?.find((i: any) => i.id === claim.insurerId);
    
    return {
      id: claim.id,
      claimNumber: claim.id.slice(-8).toUpperCase(),
      patientName: patient?.name || 'Unknown Patient',
      insurerName: insurer?.name || 'Unknown Insurer',
      amount: new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD',
      }).format(parseFloat(claim.amount)),
      status: claim.status,
      createdAt: claim.createdAt,
      updatedAt: claim.updatedAt,
      type: claim.type,
    };
  }) || [];

  const handleClaimSelect = (claimId: string) => {
    // Navigation handled by ClaimsTable component
  };

  return (
    <>
      <OfflineBanner data-testid="offline-banner" />
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          {/* Page Header */}
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-slate-900 dark:text-slate-100 sm:text-3xl sm:truncate">
                Claims Management
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Manage and track all your insurance claims and pre-authorizations
              </p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <Link href="/claims/new">
                <Button data-testid="button-new-claim">
                  <Plus className="h-4 w-4 mr-2" />
                  New Claim
                </Button>
              </Link>
            </div>
          </div>

          {/* Claims Table with Built-in Filters */}
          <div className="mt-8">
            <ClaimsTable
              claims={tableData}
              isLoading={claimsLoading}
              onClaimSelect={handleClaimSelect}
              data-testid="claims-table"
            />
          </div>
        </div>
      </div>
    </>
  );
}
