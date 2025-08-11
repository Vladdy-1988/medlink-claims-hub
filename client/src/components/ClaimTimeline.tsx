import { formatDistanceToNow } from "date-fns";
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  XCircle, 
  FileText, 
  Send,
  CreditCard,
  Eye
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TimelineEvent {
  id: string;
  type: 'created' | 'submitted' | 'processing' | 'approved' | 'paid' | 'denied' | 'info_requested' | 'attachment_added' | 'note_added';
  title: string;
  description?: string;
  timestamp: string;
  actor?: string;
  metadata?: Record<string, any>;
}

interface ClaimTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

const eventConfig = {
  created: {
    icon: FileText,
    color: "bg-blue-500",
    textColor: "text-blue-700",
    bgColor: "bg-blue-50",
  },
  submitted: {
    icon: Send,
    color: "bg-purple-500",
    textColor: "text-purple-700",
    bgColor: "bg-purple-50",
  },
  processing: {
    icon: Clock,
    color: "bg-yellow-500",
    textColor: "text-yellow-700",
    bgColor: "bg-yellow-50",
  },
  approved: {
    icon: CheckCircle,
    color: "bg-green-500",
    textColor: "text-green-700",
    bgColor: "bg-green-50",
  },
  paid: {
    icon: CreditCard,
    color: "bg-emerald-500",
    textColor: "text-emerald-700",
    bgColor: "bg-emerald-50",
  },
  denied: {
    icon: XCircle,
    color: "bg-red-500",
    textColor: "text-red-700",
    bgColor: "bg-red-50",
  },
  info_requested: {
    icon: AlertCircle,
    color: "bg-orange-500",
    textColor: "text-orange-700",
    bgColor: "bg-orange-50",
  },
  attachment_added: {
    icon: FileText,
    color: "bg-slate-500",
    textColor: "text-slate-700",
    bgColor: "bg-slate-50",
  },
  note_added: {
    icon: Eye,
    color: "bg-slate-500",
    textColor: "text-slate-700",
    bgColor: "bg-slate-50",
  },
};

/**
 * ClaimTimeline - Displays a chronological timeline of claim events
 * 
 * Features:
 * - Visual timeline with icons and colors for different event types
 * - Relative timestamps (e.g., "2 hours ago")
 * - Actor information (who performed the action)
 * - Additional metadata display
 * - Responsive design
 */
export function ClaimTimeline({ events, className }: ClaimTimelineProps) {
  if (events.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Claim Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-center py-8">No timeline events yet.</p>
        </CardContent>
      </Card>
    );
  }

  // Sort events by timestamp (newest first)
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Claim Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flow-root">
          <ul role="list" className="-mb-8">
            {sortedEvents.map((event, eventIdx) => {
              const config = eventConfig[event.type] || eventConfig.note_added;
              const Icon = config.icon;
              const isLast = eventIdx === sortedEvents.length - 1;

              return (
                <li key={event.id}>
                  <div className="relative pb-8">
                    {/* Connecting line */}
                    {!isLast && (
                      <span
                        className="absolute left-5 top-5 -ml-px h-full w-0.5 bg-slate-200"
                        aria-hidden="true"
                      />
                    )}
                    
                    <div className="relative flex items-start space-x-3">
                      {/* Event icon */}
                      <div className="relative">
                        <span
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full",
                            config.color
                          )}
                        >
                          <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                        </span>
                      </div>

                      {/* Event content */}
                      <div className="flex-1 min-w-0">
                        <div className={cn("rounded-lg p-4", config.bgColor)}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className={cn("text-sm font-medium", config.textColor)}>
                                {event.title}
                              </h4>
                              
                              {event.description && (
                                <p className="mt-1 text-sm text-slate-600">
                                  {event.description}
                                </p>
                              )}

                              {/* Actor information */}
                              {event.actor && (
                                <p className="mt-1 text-xs text-slate-500">
                                  by {event.actor}
                                </p>
                              )}

                              {/* Metadata */}
                              {event.metadata && Object.keys(event.metadata).length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {Object.entries(event.metadata).map(([key, value]) => (
                                    <Badge key={key} variant="secondary" className="text-xs">
                                      {key}: {String(value)}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Timestamp */}
                            <div className="ml-4 flex-shrink-0 text-xs text-slate-500">
                              <time 
                                dateTime={event.timestamp}
                                title={new Date(event.timestamp).toLocaleString()}
                              >
                                {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                              </time>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Helper function to create timeline events from claim data
 */
export function createTimelineFromClaim(claim: any): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Created event
  events.push({
    id: `created-${claim.id}`,
    type: 'created',
    title: 'Claim Created',
    description: `Claim ${claim.claimNumber} was created`,
    timestamp: claim.createdAt,
    actor: claim.createdBy || 'System',
  });

  // Status events based on current status
  if (claim.status === 'submitted') {
    events.push({
      id: `submitted-${claim.id}`,
      type: 'submitted',
      title: 'Claim Submitted',
      description: 'Claim has been submitted to insurance provider',
      timestamp: claim.updatedAt,
      metadata: {
        'Insurance': claim.insurer?.name,
        'Amount': `$${claim.amount}`,
      },
    });
  }

  if (claim.status === 'processing') {
    events.push({
      id: `processing-${claim.id}`,
      type: 'processing',
      title: 'Claim Processing',
      description: 'Insurance provider is reviewing the claim',
      timestamp: claim.updatedAt,
    });
  }

  if (claim.status === 'approved') {
    events.push({
      id: `approved-${claim.id}`,
      type: 'approved',
      title: 'Claim Approved',
      description: 'Insurance provider has approved the claim',
      timestamp: claim.updatedAt,
    });
  }

  if (claim.status === 'paid') {
    events.push({
      id: `paid-${claim.id}`,
      type: 'paid',
      title: 'Claim Paid',
      description: 'Payment has been processed',
      timestamp: claim.updatedAt,
    });
  }

  if (claim.status === 'denied') {
    events.push({
      id: `denied-${claim.id}`,
      type: 'denied',
      title: 'Claim Denied',
      description: 'Insurance provider has denied the claim',
      timestamp: claim.updatedAt,
    });
  }

  // Add attachment events if available
  if (claim.attachments && claim.attachments.length > 0) {
    claim.attachments.forEach((attachment: any, index: number) => {
      events.push({
        id: `attachment-${attachment.id}`,
        type: 'attachment_added',
        title: 'Attachment Added',
        description: `${attachment.kind} attachment uploaded`,
        timestamp: attachment.createdAt,
        metadata: {
          'Type': attachment.kind,
          'Size': attachment.size ? `${Math.round(attachment.size / 1024)}KB` : 'Unknown',
        },
      });
    });
  }

  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}