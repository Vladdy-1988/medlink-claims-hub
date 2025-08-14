import { format, formatDistanceToNow } from "date-fns";
import { Check, Clock, AlertCircle, X, FileText, Send, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TimelineEvent {
  id: string;
  status: string;
  timestamp: string;
  description?: string;
  actor?: string;
  details?: any;
}

interface ClaimTimelineProps {
  claim: {
    id: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    notes?: string;
    events?: TimelineEvent[];
  };
  onResubmit?: () => void;
  className?: string;
}

const statusConfig = {
  draft: {
    icon: FileText,
    color: "bg-blue-500",
    textColor: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    label: "Draft",
    description: "Claim is being prepared"
  },
  submitted: {
    icon: Send,
    color: "bg-yellow-500", 
    textColor: "text-yellow-600",
    bgColor: "bg-yellow-50 dark:bg-yellow-950",
    label: "Submitted",
    description: "Claim has been sent to insurer"
  },
  pending: {
    icon: Clock,
    color: "bg-orange-500",
    textColor: "text-orange-600", 
    bgColor: "bg-orange-50 dark:bg-orange-950",
    label: "Pending Review",
    description: "Insurer is reviewing the claim"
  },
  infoRequested: {
    icon: AlertCircle,
    color: "bg-purple-500",
    textColor: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950", 
    label: "Information Requested",
    description: "Additional information required"
  },
  paid: {
    icon: Check,
    color: "bg-green-500",
    textColor: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950",
    label: "Paid",
    description: "Claim has been processed and paid"
  },
  denied: {
    icon: X,
    color: "bg-red-500", 
    textColor: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950",
    label: "Denied",
    description: "Claim was denied by insurer"
  }
};

const statusOrder = ['draft', 'submitted', 'pending', 'infoRequested', 'paid', 'denied'];

export function ClaimTimeline({ claim, onResubmit, className = "" }: ClaimTimelineProps) {
  const currentStatus = claim.status;
  const currentStatusIndex = statusOrder.indexOf(currentStatus);
  
  // Generate timeline events based on claim status and any provided events
  const generateTimelineEvents = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [];
    
    // Always start with draft/creation
    events.push({
      id: 'created',
      status: 'draft',
      timestamp: claim.createdAt,
      description: 'Claim created',
      actor: 'System'
    });

    // Add progression events based on current status
    if (currentStatusIndex >= statusOrder.indexOf('submitted')) {
      events.push({
        id: 'submitted',
        status: 'submitted', 
        timestamp: claim.updatedAt,
        description: 'Claim submitted to insurer',
        actor: 'System'
      });
    }

    if (currentStatusIndex >= statusOrder.indexOf('pending') && currentStatus !== 'denied') {
      events.push({
        id: 'pending',
        status: 'pending',
        timestamp: claim.updatedAt,
        description: 'Under review by insurer',
        actor: 'Insurer'
      });
    }

    // Add final status if applicable
    if (currentStatus === 'paid') {
      events.push({
        id: 'paid',
        status: 'paid',
        timestamp: claim.updatedAt,
        description: 'Claim approved and payment processed',
        actor: 'Insurer'
      });
    } else if (currentStatus === 'denied') {
      events.push({
        id: 'denied',
        status: 'denied',
        timestamp: claim.updatedAt,
        description: 'Claim was denied',
        actor: 'Insurer'
      });
    } else if (currentStatus === 'infoRequested') {
      events.push({
        id: 'infoRequested',
        status: 'infoRequested', 
        timestamp: claim.updatedAt,
        description: 'Additional information requested',
        actor: 'Insurer'
      });
    }

    // Add any custom events if provided
    if (claim.events) {
      events.push(...claim.events);
    }

    // Sort by timestamp
    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  };

  const timelineEvents = generateTimelineEvents();
  const currentStatusConfig = statusConfig[currentStatus as keyof typeof statusConfig];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Current Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${currentStatusConfig?.bgColor}`}>
                {currentStatusConfig && (
                  <currentStatusConfig.icon className={`w-5 h-5 ${currentStatusConfig.textColor}`} />
                )}
              </div>
              Current Status
            </CardTitle>
            <Badge 
              className={`${currentStatusConfig?.bgColor} ${currentStatusConfig?.textColor} border-0`}
              data-testid={`status-badge-${currentStatus}`}
            >
              {currentStatusConfig?.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            {currentStatusConfig?.description}
          </p>
          <div className="text-sm text-muted-foreground">
            Last updated {formatDistanceToNow(new Date(claim.updatedAt), { addSuffix: true })}
          </div>
          
          {/* Resubmit button for denied claims */}
          {currentStatus === 'denied' && onResubmit && (
            <div className="mt-4">
              <Button onClick={onResubmit} data-testid="button-resubmit">
                Resubmit Claim
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Claim Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {timelineEvents.map((event, index) => {
              const eventConfig = statusConfig[event.status as keyof typeof statusConfig];
              const isLast = index === timelineEvents.length - 1;
              const isActive = event.status === currentStatus;
              
              return (
                <div key={event.id} className="relative flex gap-4 pb-6" data-testid={`timeline-event-${event.status}`}>
                  {/* Timeline line */}
                  {!isLast && (
                    <div className="absolute left-6 top-12 w-0.5 h-full bg-gray-200 dark:bg-gray-700" />
                  )}
                  
                  {/* Status Icon */}
                  <div className={`
                    relative z-10 flex items-center justify-center w-12 h-12 rounded-full
                    ${isActive ? eventConfig?.color : 'bg-gray-200 dark:bg-gray-700'}
                  `}>
                    {eventConfig && (
                      <eventConfig.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    )}
                  </div>
                  
                  {/* Event Content */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-medium ${isActive ? eventConfig?.textColor : 'text-muted-foreground'}`}>
                        {eventConfig?.label || event.status}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(event.timestamp), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                    
                    {event.description && (
                      <p className="text-sm text-muted-foreground mb-1">
                        {event.description}
                      </p>
                    )}
                    
                    {event.actor && (
                      <p className="text-xs text-muted-foreground">
                        by {event.actor}
                      </p>
                    )}
                    
                    {event.details && (
                      <details className="mt-2">
                        <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                          View details
                        </summary>
                        <pre className="text-xs text-muted-foreground mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded overflow-x-auto">
                          {JSON.stringify(event.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Notes Section */}
          {claim.notes && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Notes
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-3 rounded">
                {claim.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}