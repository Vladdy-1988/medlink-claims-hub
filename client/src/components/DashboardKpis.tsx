import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  DollarSign, 
  TrendingUp,
  AlertTriangle,
  Calendar
} from "lucide-react";

interface KpiData {
  totalClaims: number;
  pendingClaims: number;
  approvedClaims: number;
  rejectedClaims: number;
  totalAmount: number;
  approvedAmount: number;
  averageProcessingTime: number;
  thisMonthClaims: number;
  lastMonthClaims: number;
  urgentClaims: number;
}

export function DashboardKpis() {
  const { data: kpiData, isLoading, error } = useQuery<KpiData>({
    queryKey: ['/api/dashboard/kpis'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return <KpiSkeleton />;
  }

  if (error || !kpiData) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-600 dark:text-red-400">
                Unable to load dashboard metrics
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const monthlyGrowth = kpiData.lastMonthClaims > 0 
    ? ((kpiData.thisMonthClaims - kpiData.lastMonthClaims) / kpiData.lastMonthClaims) * 100 
    : 0;

  const approvalRate = kpiData.totalClaims > 0 
    ? (kpiData.approvedClaims / kpiData.totalClaims) * 100 
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="dashboard-kpis">
      {/* Total Claims */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-total-claims">
            {kpiData.totalClaims.toLocaleString()}
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <Badge variant={monthlyGrowth >= 0 ? "default" : "destructive"} className="text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              {monthlyGrowth >= 0 ? '+' : ''}{monthlyGrowth.toFixed(1)}%
            </Badge>
            <p className="text-xs text-muted-foreground">vs last month</p>
          </div>
        </CardContent>
      </Card>

      {/* Pending Claims */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Claims</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-pending-claims">
            {kpiData.pendingClaims.toLocaleString()}
          </div>
          <div className="flex items-center space-x-2 mt-2">
            {kpiData.urgentClaims > 0 && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {kpiData.urgentClaims} urgent
              </Badge>
            )}
            <p className="text-xs text-muted-foreground">
              Avg: {kpiData.averageProcessingTime}d processing
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Approval Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-approval-rate">
            {approvalRate.toFixed(1)}%
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <div className="flex space-x-1">
              <Badge variant="default" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                {kpiData.approvedClaims} approved
              </Badge>
              <Badge variant="destructive" className="text-xs">
                {kpiData.rejectedClaims} rejected
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-total-value">
            ${kpiData.totalAmount.toLocaleString()}
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <Badge variant="outline" className="text-xs">
              ${kpiData.approvedAmount.toLocaleString()} approved
            </Badge>
            <p className="text-xs text-muted-foreground">
              {((kpiData.approvedAmount / kpiData.totalAmount) * 100).toFixed(1)}% paid
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="kpi-skeleton">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}