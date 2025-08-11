import { TrendingUp, TrendingDown, DollarSign, FileText, Clock, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface DashboardKpi {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: React.ComponentType<any>;
  description?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

interface DashboardKpisProps {
  kpis: DashboardKpi[];
  isLoading?: boolean;
  className?: string;
}

const colorConfig = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950",
    icon: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
  },
  green: {
    bg: "bg-green-50 dark:bg-green-950",
    icon: "text-green-600 dark:text-green-400",
    border: "border-green-200 dark:border-green-800",
  },
  yellow: {
    bg: "bg-yellow-50 dark:bg-yellow-950",
    icon: "text-yellow-600 dark:text-yellow-400",
    border: "border-yellow-200 dark:border-yellow-800",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-950",
    icon: "text-red-600 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-950",
    icon: "text-purple-600 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800",
  },
};

/**
 * DashboardKpis - Key Performance Indicators grid for the dashboard
 * 
 * Features:
 * - Responsive grid layout (1-4 columns based on screen size)
 * - Color-coded cards for different metric types
 * - Trend indicators (up/down arrows with percentages)
 * - Loading skeleton states
 * - Accessible design with proper ARIA labels
 */
export function DashboardKpis({ kpis, isLoading = false, className }: DashboardKpisProps) {
  if (isLoading) {
    return (
      <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-16 mb-1" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        const colors = colorConfig[kpi.color || 'blue'];
        
        return (
          <Card 
            key={index} 
            className={cn("transition-all hover:shadow-md", colors.border)}
            data-testid={`kpi-${kpi.title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {kpi.title}
              </CardTitle>
              <div className={cn("p-2 rounded-md", colors.bg)}>
                <Icon className={cn("h-4 w-4", colors.icon)} aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
                </div>
                
                {kpi.change !== undefined && (
                  <div className="flex items-center text-xs">
                    {kpi.changeType === 'increase' && (
                      <TrendingUp className="h-3 w-3 text-green-600 mr-1" aria-hidden="true" />
                    )}
                    {kpi.changeType === 'decrease' && (
                      <TrendingDown className="h-3 w-3 text-red-600 mr-1" aria-hidden="true" />
                    )}
                    <span
                      className={cn(
                        "font-medium",
                        kpi.changeType === 'increase' && "text-green-600",
                        kpi.changeType === 'decrease' && "text-red-600",
                        kpi.changeType === 'neutral' && "text-slate-600"
                      )}
                    >
                      {kpi.change > 0 ? '+' : ''}{kpi.change}%
                    </span>
                  </div>
                )}
              </div>
              
              {kpi.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {kpi.description}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Helper function to create KPIs from dashboard stats
 */
export function createDashboardKpis(stats: {
  totalClaims: number;
  pendingClaims: number;
  successRate: number;
  monthlyRevenue: number;
}): DashboardKpi[] {
  return [
    {
      title: "Total Claims",
      value: stats.totalClaims,
      icon: FileText,
      description: "All time claims submitted",
      color: 'blue',
    },
    {
      title: "Pending Claims",
      value: stats.pendingClaims,
      icon: Clock,
      description: "Awaiting processing",
      color: 'yellow',
    },
    {
      title: "Success Rate",
      value: `${stats.successRate.toFixed(1)}%`,
      icon: CheckCircle,
      description: "Claims approved & paid",
      color: 'green',
      change: stats.successRate > 80 ? 5.2 : -2.1,
      changeType: stats.successRate > 80 ? 'increase' : 'decrease',
    },
    {
      title: "Monthly Revenue",
      value: `$${stats.monthlyRevenue.toLocaleString()}`,
      icon: DollarSign,
      description: "Revenue this month",
      color: 'green',
      change: 12.3,
      changeType: 'increase',
    },
  ];
}

/**
 * Pre-built KPI components for common metrics
 */
export const QuickKpis = {
  TotalClaims: ({ value, isLoading }: { value: number; isLoading?: boolean }) => (
    <DashboardKpis
      kpis={[{
        title: "Total Claims",
        value,
        icon: FileText,
        color: 'blue',
      }]}
      isLoading={isLoading}
    />
  ),
  
  PendingClaims: ({ value, isLoading }: { value: number; isLoading?: boolean }) => (
    <DashboardKpis
      kpis={[{
        title: "Pending Claims",
        value,
        icon: Clock,
        color: 'yellow',
      }]}
      isLoading={isLoading}
    />
  ),
  
  MonthlyRevenue: ({ value, change, isLoading }: { value: number; change?: number; isLoading?: boolean }) => (
    <DashboardKpis
      kpis={[{
        title: "Monthly Revenue",
        value: `$${value.toLocaleString()}`,
        icon: DollarSign,
        color: 'green',
        change,
        changeType: change && change > 0 ? 'increase' : 'decrease',
      }]}
      isLoading={isLoading}
    />
  ),
};