import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { Link } from "wouter";

interface DashboardStats {
  totalClaims: number;
  pendingClaims: number;
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
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Page Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">
              Dashboard
            </h2>
            <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:mt-0 sm:space-x-6">
              <div className="mt-2 flex items-center text-sm text-slate-500">
                <i className="fas fa-calendar mr-1.5 text-slate-400"></i>
                <span data-testid="current-date">{currentDate}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Link href="/claims/new">
              <Button data-testid="button-new-claim">
                <i className="fas fa-plus mr-2"></i>
                New Claim
              </Button>
            </Link>
            <Link href="/preauths/new">
              <Button variant="outline" className="ml-3" data-testid="button-new-preauth">
                <i className="fas fa-check-circle mr-2"></i>
                New Pre-Auth
              </Button>
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="mt-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Claims */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                      <i className="fas fa-file-medical text-primary-600"></i>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-slate-500 truncate">Total Claims</dt>
                      <dd className="text-2xl font-semibold text-slate-900" data-testid="kpi-total-claims">
                        {statsLoading ? '...' : stats?.totalClaims || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pending Claims */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                      <i className="fas fa-clock text-warning-600"></i>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-slate-500 truncate">Pending</dt>
                      <dd className="text-2xl font-semibold text-slate-900" data-testid="kpi-pending-claims">
                        {statsLoading ? '...' : stats?.pendingClaims || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Success Rate */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                      <i className="fas fa-check-circle text-success-600"></i>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-slate-500 truncate">Success Rate</dt>
                      <dd className="text-2xl font-semibold text-slate-900" data-testid="kpi-success-rate">
                        {statsLoading ? '...' : `${stats?.successRate?.toFixed(1) || 0}%`}
                      </dd>
                    </dl>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Revenue */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                      <i className="fas fa-dollar-sign text-success-600"></i>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-slate-500 truncate">This Month</dt>
                      <dd className="text-2xl font-semibold text-slate-900" data-testid="kpi-revenue">
                        {statsLoading ? '...' : formatCurrency(stats?.monthlyRevenue || 0)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
                    {(!recentClaims || recentClaims.length === 0) ? (
                      <li className="py-4 text-center text-slate-500">
                        No claims found. <Link href="/claims/new" className="text-primary-600 hover:underline">Create your first claim</Link>
                      </li>
                    ) : (
                      recentClaims.slice(0, 3).map((claim: any) => (
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
                    className="w-full justify-start p-4 h-auto"
                    data-testid="quick-action-new-claim"
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                          <i className="fas fa-plus text-primary-600"></i>
                        </div>
                      </div>
                      <div className="ml-4 text-left">
                        <p className="text-sm font-medium text-slate-900">Create New Claim</p>
                        <p className="text-sm text-slate-500">Submit a new insurance claim</p>
                      </div>
                    </div>
                  </Button>
                </Link>
                
                <Link href="/preauths/new">
                  <Button
                    variant="outline"
                    className="w-full justify-start p-4 h-auto"
                    data-testid="quick-action-new-preauth"
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center">
                          <i className="fas fa-check-circle text-success-600"></i>
                        </div>
                      </div>
                      <div className="ml-4 text-left">
                        <p className="text-sm font-medium text-slate-900">New Pre-Authorization</p>
                        <p className="text-sm text-slate-500">Request treatment approval</p>
                      </div>
                    </div>
                  </Button>
                </Link>
                
                <Link href="/remittances">
                  <Button
                    variant="outline"
                    className="w-full justify-start p-4 h-auto"
                    data-testid="quick-action-upload-remittance"
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-warning-100 rounded-lg flex items-center justify-center">
                          <i className="fas fa-upload text-warning-600"></i>
                        </div>
                      </div>
                      <div className="ml-4 text-left">
                        <p className="text-sm font-medium text-slate-900">Upload Remittance</p>
                        <p className="text-sm text-slate-500">Process payment notifications</p>
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
  );
}
