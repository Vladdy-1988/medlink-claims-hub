import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Send, 
  FileText, 
  User, 
  AlertTriangle,
  DollarSign,
  Calendar,
  Eye,
  Edit,
  Upload
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: string;
  type: 'created' | 'updated' | 'submitted' | 'processing' | 'approved' | 'rejected' | 'paid' | 'comment' | 'attachment';
  title: string;
  description?: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  metadata?: Record<string, any>;
}

interface ClaimTimelineProps {
  claimId: string;
  showAll?: boolean;
  limit?: number;
}

const eventConfig = {
  created: {
    icon: FileText,
    color: "bg-blue-500",
    textColor: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  updated: {
    icon: Edit,
    color: "bg-yellow-500",
    textColor: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
    borderColor: "border-yellow-200 dark:border-yellow-800",
  },
  submitted: {
    icon: Send,
    color: "bg-blue-600",
    textColor: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  processing: {
    icon: Clock,
    color: "bg-orange-500",
    textColor: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-900/20",
    borderColor: "border-orange-200 dark:border-orange-800",
  },
  approved: {
    icon: CheckCircle,
    color: "bg-green-500",
    textColor: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-200 dark:border-green-800",
  },
  rejected: {
    icon: XCircle,
    color: "bg-red-500",
    textColor: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-900/20",
    borderColor: "border-red-200 dark:border-red-800",
  },
  paid: {
    icon: DollarSign,
    color: "bg-green-600",
    textColor: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-200 dark:border-green-800",
  },
  comment: {
    icon: User,
    color: "bg-gray-500",
    textColor: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-900/20",
    borderColor: "border-gray-200 dark:border-gray-800",
  },
  attachment: {
    icon: Upload,
    color: "bg-purple-500",
    textColor: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
};

export function ClaimTimeline({ claimId, showAll = false, limit = 10 }: ClaimTimelineProps) {
  const { data: events, isLoading, error } = useQuery<TimelineEvent[]>({
    queryKey: ['/api/claims', claimId, 'timeline', { limit: showAll ? undefined : limit }],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return <TimelineSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <p>Unable to load claim timeline</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const timelineEvents = events || [];

  return (
    <Card data-testid="claim-timeline">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Claim Timeline</span>
          <Badge variant="secondary">{timelineEvents.length} events</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {timelineEvents.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No timeline events yet</p>
            <p className="text-sm text-muted-foreground">Activity will appear here as the claim progresses</p>
          </div>
        ) : (
          <div className="space-y-4">
            {timelineEvents.map((event, index) => {
              const config = eventConfig[event.type] || eventConfig.comment;
              const EventIcon = config.icon;
              const isLast = index === timelineEvents.length - 1;

              return (
                <div key={event.id} className="relative" data-testid={`timeline-event-${event.id}`}>
                  {/* Connector Line */}
                  {!isLast && (
                    <div className="absolute left-6 top-12 h-full w-0.5 bg-muted" />
                  )}

                  <div className="flex space-x-4">
                    {/* Event Icon */}
                    <div className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-full border-4 border-background",
                      config.color
                    )}>
                      <EventIcon className="h-5 w-5 text-white" />
                    </div>

                    {/* Event Content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className={cn(
                        "p-4 rounded-lg border",
                        config.bgColor,
                        config.borderColor
                      )}>
                        {/* Event Header */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h4 className="font-medium text-sm">{event.title}</h4>
                            {event.description && (
                              <p className="text-sm text-muted-foreground">{event.description}</p>
                            )}
                          </div>
                          <div className="text-right space-y-1">
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(event.timestamp).toLocaleDateString()}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>

                        {/* Event Metadata */}
                        {event.metadata && (
                          <div className="mt-3 space-y-2">
                            {event.metadata.amount && (
                              <div className="flex items-center space-x-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">
                                  ${event.metadata.amount.toFixed(2)}
                                </span>
                              </div>
                            )}
                            {event.metadata.submissionId && (
                              <div className="flex items-center space-x-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-mono">
                                  {event.metadata.submissionId}
                                </span>
                              </div>
                            )}
                            {event.metadata.reason && (
                              <div className="text-sm text-muted-foreground">
                                <strong>Reason:</strong> {event.metadata.reason}
                              </div>
                            )}
                            {event.metadata.fileName && (
                              <div className="flex items-center space-x-2">
                                <Upload className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{event.metadata.fileName}</span>
                                {event.metadata.fileSize && (
                                  <Badge variant="outline" className="text-xs">
                                    {formatFileSize(event.metadata.fileSize)}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* User Attribution */}
                        {event.userName && (
                          <div className="mt-3 pt-3 border-t border-muted">
                            <div className="flex items-center space-x-2">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                by {event.userName}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Show More/Less Button */}
            {!showAll && events && events.length >= limit && (
              <div className="text-center pt-4">
                <button 
                  className="text-sm text-primary hover:text-primary/80 font-medium"
                  data-testid="button-show-more"
                >
                  <Eye className="h-4 w-4 inline mr-1" />
                  View complete timeline ({events.length} total events)
                </button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineSkeleton() {
  return (
    <Card data-testid="timeline-skeleton">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex space-x-4">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function formatFileSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}