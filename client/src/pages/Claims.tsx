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

  const filteredClaims = claims?.filter((claim: any) => {
    if (statusFilter !== "all" && claim.status !== statusFilter) return false;
    if (dateFilter && !claim.createdAt.includes(dateFilter)) return false;
    return true;
  });

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPatientName = (patientId: string) => {
    const patient = patients?.find((p: any) => p.id === patientId);
    return patient?.name || 'Unknown Patient';
  };

  const getInsurerName = (insurerId: string) => {
    const insurer = insurers?.find((i: any) => i.id === insurerId);
    return insurer?.name || 'Unknown Insurer';
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Page Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">
              Claims Management
            </h2>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Link href="/claims/new">
              <Button data-testid="button-new-claim">
                <i className="fas fa-plus mr-2"></i>
                New Claim
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-1" data-testid="filter-status">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="infoRequested">Info Requested</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="denied">Denied</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700">Date Range</label>
                <Input
                  type="date"
                  className="mt-1"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  data-testid="filter-date"
                />
              </div>
              
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setStatusFilter("all");
                    setDateFilter("");
                  }}
                  data-testid="button-clear-filters"
                >
                  <i className="fas fa-times mr-2"></i>
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Claims Table */}
        <Card className="mt-8">
          <CardContent className="p-6">
            {claimsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-slate-500">Loading claims...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Claim ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Service
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Payer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {(!filteredClaims || filteredClaims.length === 0) ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center">
                          <div className="text-slate-500">
                            <i className="fas fa-file-medical text-4xl mb-4 text-slate-300"></i>
                            <p className="text-lg font-medium">No claims found</p>
                            <p className="text-sm">
                              {statusFilter !== "all" || dateFilter ? 
                                "Try adjusting your filters or " : 
                                ""
                              }
                              <Link href="/claims/new" className="text-primary-600 hover:underline">
                                create your first claim
                              </Link>
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredClaims.map((claim: any) => (
                        <tr key={claim.id} className="hover:bg-slate-50" data-testid={`claim-row-${claim.id}`}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                            {claim.id.slice(-8)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center mr-3">
                                <span className="text-slate-600 font-medium text-sm">
                                  {getPatientName(claim.patientId).split(' ').map(n => n[0]).join('')}
                                </span>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-slate-900">
                                  {getPatientName(claim.patientId)}
                                </div>
                                <div className="text-sm text-slate-500">
                                  ID: {claim.patientId.slice(-8)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-slate-900">
                              {claim.type === 'claim' ? 'Treatment Claim' : 'Pre-Authorization'}
                            </div>
                            <div className="text-sm text-slate-500">
                              Codes: {claim.codes?.join(', ') || 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                            {getInsurerName(claim.insurerId)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                            {formatCurrency(claim.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={claim.status}>
                              {claim.status.replace(/([A-Z])/g, ' $1').trim()}
                            </StatusBadge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            {formatDate(claim.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link 
                              href={`/claims/${claim.id}`}
                              className="text-primary-600 hover:text-primary-900"
                              data-testid={`button-view-claim-${claim.id}`}
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
