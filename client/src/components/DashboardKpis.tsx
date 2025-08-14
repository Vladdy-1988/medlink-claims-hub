import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, CheckCircle, XCircle } from "lucide-react";

interface DashboardStats {
  totalClaims: number;
  pendingClaims: number;
  submittedClaims: number;
  paidClaims: number;
  deniedClaims: number;
  draftClaims: number;
}

interface DashboardKpisProps {
  stats: DashboardStats;
  isLoading?: boolean;
}

export function DashboardKpis({ stats, isLoading = false }: DashboardKpisProps) {
  const kpis = [
    {
      title: "Draft Claims",
      value: stats.draftClaims,
      icon: FileText,
      description: "Unsaved drafts",
      className: "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400",
    },
    {
      title: "Pending Review",
      value: stats.pendingClaims,
      icon: Clock,
      description: "Awaiting response",
      className: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400",
    },
    {
      title: "Paid Claims",
      value: stats.paidClaims,
      icon: CheckCircle,
      description: "Successfully processed",
      className: "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400",
    },
    {
      title: "Denied Claims",
      value: stats.deniedClaims,
      icon: XCircle,
      description: "Require attention",
      className: "text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded mb-1" />
              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card key={kpi.title} data-testid={`kpi-${kpi.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {kpi.title}
              </CardTitle>
              <div className={`rounded-full p-2 ${kpi.className}`}>
                <Icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`kpi-value-${kpi.title.toLowerCase().replace(/\s+/g, '-')}`}>
                {kpi.value.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {kpi.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}