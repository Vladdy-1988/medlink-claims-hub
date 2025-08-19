import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardKpis } from "@/components/DashboardKpis";
import { ClaimsTable } from "@/components/ClaimsTable";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Plus, CheckCircle, Upload } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "wouter";

interface DashboardStats {
  totalClaims: number;
  pendingClaims: number;
  submittedClaims: number;
  paidClaims: number;
  deniedClaims: number;
  draftClaims: number;
  successRate: number;
  monthlyRevenue: number;
}

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

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

  const { data: stats, isLoading: statsLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    retry: false,
  });

  const { data: recentClaims, isLoading: claimsLoading } = useQuery({
    queryKey: ["/api/claims"],
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount);
  };

  const currentDate = new Date().toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <>
      <OfflineBanner data-testid="offline-banner" />
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          {/* Page Header */}
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-slate-900 dark:text-slate-100 sm:text-3xl sm:truncate">
                Dashboard
              </h2>
              <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:mt-0 sm:space-x-6">
                <div className="mt-2 flex items-center text-sm text-slate-500 dark:text-slate-400">
                  <span data-testid="current-date">{currentDate}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
              <Link href="/claims/new">
                <Button data-testid="button-new-claim">
                  <Plus className="h-4 w-4 mr-2" />
                  New Claim
                </Button>
              </Link>
              <Link href="/preauths/new">
                <Button variant="outline" data-testid="button-new-preauth">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  New Pre-Auth
                </Button>
              </Link>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="mt-8">
            <DashboardKpis
              stats={{
                totalClaims: stats?.totalClaims || 0,
                pendingClaims: stats?.pendingClaims || 0,
                submittedClaims: stats?.submittedClaims || 0,
                paidClaims: stats?.paidClaims || 0,
                deniedClaims: stats?.deniedClaims || 0,
                draftClaims: stats?.draftClaims || 0,
              }}
              isLoading={statsLoading}
            />
          </div>

        {/* Recent Activity and Quick Actions */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Recent Claims */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg leading-6 font-medium text-slate-900">Recent Claims</h3>
                <Link href="/claims" className="text-sm font-medium text-primary-600 hover:text-primary-500">
                  View all
                </Link>
              </div>
              <div className="mt-6 flow-root">
                {claimsLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : (
                  <ul className="-my-5 divide-y divide-slate-200">
                    {(!recentClaims || (Array.isArray(recentClaims) && recentClaims.length === 0)) ? (
                      <li className="py-4 text-center text-slate-500">
                        No claims found. <Link href="/claims/new" className="text-primary-600 hover:underline">Create your first claim</Link>
                      </li>
                    ) : (
                      (Array.isArray(recentClaims) ? recentClaims : []).slice(0, 3).map((claim: any) => (
                        <li key={claim.id} className="py-4" data-testid={`recent-claim-${claim.id}`}>
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                                <span className="text-slate-600 font-medium text-sm">
                                  {claim.patient?.name?.split(' ').map((n: string) => n[0]).join('') || 'N/A'}
                                </span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                Patient: {claim.patient?.name || 'Unknown'}
                              </p>
                              <p className="text-sm text-slate-500 truncate">
                                {claim.codes?.join(', ') || 'No codes'}
                              </p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <StatusBadge status={claim.status}>
                                {claim.status}
                              </StatusBadge>
                              <p className="text-sm text-slate-500 mt-1">{formatCurrency(parseFloat(claim.amount))}</p>
                            </div>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg leading-6 font-medium text-slate-900">Quick Actions</h3>
              <div className="mt-6 grid grid-cols-1 gap-4">
                <Link href="/claims/new">
                  <Button
                    variant="outline"
                    className="w-full justify-start p-4 h-auto hover:bg-slate-50 dark:hover:bg-slate-800"
                    data-testid="quick-action-new-claim"
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                          <Plus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <div className="ml-4 text-left">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Create New Claim</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Submit a new insurance claim</p>
                      </div>
                    </div>
                  </Button>
                </Link>
                
                <Link href="/preauths/new">
                  <Button
                    variant="outline"
                    className="w-full justify-start p-4 h-auto hover:bg-slate-50 dark:hover:bg-slate-800"
                    data-testid="quick-action-new-preauth"
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                      <div className="ml-4 text-left">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">New Pre-Authorization</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Request treatment approval</p>
                      </div>
                    </div>
                  </Button>
                </Link>
                
                <Link href="/remittances">
                  <Button
                    variant="outline"
                    className="w-full justify-start p-4 h-auto hover:bg-slate-50 dark:hover:bg-slate-800"
                    data-testid="quick-action-upload-remittance"
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
                          <Upload className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                      </div>
                      <div className="ml-4 text-left">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Upload Remittance</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Process payment notifications</p>
                      </div>
                    </div>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </>
  );
}
