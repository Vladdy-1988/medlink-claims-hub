import { cn } from "@/lib/utils";
import { 
  FileEdit, 
  Send, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  BadgeCheck 
} from "lucide-react";

interface StatusBadgeProps {
  status: string;
  className?: string;
  showIcon?: boolean;
  children?: React.ReactNode;
}

export function StatusBadge({ status, className, showIcon = true, children }: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case "draft":
        return {
          styles: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
          icon: <FileEdit className="w-3 h-3" />
        };
      case "submitted":
        return {
          styles: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800",
          icon: <Send className="w-3 h-3" />
        };
      case "pending":
        return {
          styles: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
          icon: <Clock className="w-3 h-3" />
        };
      case "info_requested":
      case "inforequested":
        return {
          styles: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
          icon: <AlertCircle className="w-3 h-3" />
        };
      case "paid":
      case "approved":
        return {
          styles: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
          icon: <CheckCircle2 className="w-3 h-3" />
        };
      case "denied":
      case "rejected":
        return {
          styles: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
          icon: <XCircle className="w-3 h-3" />
        };
      case "verified":
        return {
          styles: "bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-800",
          icon: <BadgeCheck className="w-3 h-3" />
        };
      default:
        return {
          styles: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
          icon: <FileEdit className="w-3 h-3" />
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150",
        config.styles,
        className
      )}
      data-testid={`status-${status}`}
    >
      {showIcon && config.icon}
      {children || status.replace(/_/g, ' ')}
    </span>
  );
}

// Export as default for backward compatibility
export default StatusBadge;
