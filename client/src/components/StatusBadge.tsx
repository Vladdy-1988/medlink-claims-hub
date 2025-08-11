import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: 'draft' | 'submitted' | 'pending' | 'infoRequested' | 'paid' | 'denied';
  children: React.ReactNode;
}

const statusStyles = {
  draft: "bg-gray-100 text-gray-800",
  submitted: "bg-blue-100 text-blue-800",
  pending: "bg-yellow-100 text-yellow-800",
  infoRequested: "bg-orange-100 text-orange-800",
  paid: "bg-green-100 text-green-800",
  denied: "bg-red-100 text-red-800",
};

export default function StatusBadge({ status, children }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        statusStyles[status]
      )}
      data-testid={`status-${status}`}
    >
      {children}
    </span>
  );
}
