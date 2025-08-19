import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, CheckCircle, XCircle, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const totalProcessed = stats.paidClaims + stats.deniedClaims;
  const successRate = totalProcessed > 0 ? (stats.paidClaims / totalProcessed) * 100 : 0;
  
  const kpis: Array<{
    title: string;
    value: number | string;
    icon: any;
    description: string;
    change: string;
    changeType: "increase" | "decrease" | "neutral";
    iconBg: string;
    iconColor: string;
  }> = [
    {
      title: "Draft Claims",
      value: stats.draftClaims,
      icon: FileText,
      description: "Unsaved drafts",
      change: "+2",
      changeType: "neutral",
      iconBg: "bg-slate-100 dark:bg-slate-800",
      iconColor: "text-slate-600 dark:text-slate-400",
    },
    {
      title: "Pending Review",
      value: stats.pendingClaims,
      icon: Clock,
      description: "Awaiting response",
      change: "+5",
      changeType: "increase",
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Paid Claims",
      value: stats.paidClaims,
      icon: CheckCircle,
      description: "Successfully processed",
      change: "+12",
      changeType: "increase",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Success Rate",
      value: `${successRate.toFixed(1)}%`,
      icon: TrendingUp,
      description: "Approval percentage",
      change: "+2.1%",
      changeType: "increase",
      iconBg: "bg-primary-100 dark:bg-primary-900/30",
      iconColor: "text-primary-600 dark:text-primary-400",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-0 shadow-soft">
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
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi, index) => (
        <Card key={index} className="border-0 shadow-soft hover:shadow-soft-lg transition-all duration-200 bg-card/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
            <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl", kpi.iconBg)}>
              <kpi.icon className={cn("h-5 w-5", kpi.iconColor)} />
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-foreground">{typeof kpi.value === 'number' ? kpi.value : kpi.value}</div>
              <div className={cn("flex items-center gap-1 text-xs font-medium rounded-full px-2 py-1", {
                "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30": kpi.changeType === "increase",
                "text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-900/30": kpi.changeType === "decrease",
                "text-muted-foreground bg-muted": kpi.changeType === "neutral"
              })}>
                {kpi.changeType === "increase" ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : kpi.changeType === "decrease" ? (
                  <ArrowDownRight className="h-3 w-3" />
                ) : null}
                {kpi.change}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}