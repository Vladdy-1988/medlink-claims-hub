import * as React from "react";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  title: string;
  description?: string;
  timestamp?: string;
  icon?: React.ReactNode;
  status?: "completed" | "current" | "pending";
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  return (
    <div className={cn("space-y-8", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const status = item.status || "pending";
        
        return (
          <div key={index} className="relative flex items-start space-x-3">
            {/* Timeline line */}
            {!isLast && (
              <div 
                className={cn(
                  "absolute left-4 top-10 h-8 w-px",
                  status === "completed" ? "bg-primary" : "bg-muted"
                )}
              />
            )}
            
            {/* Icon */}
            <div 
              className={cn(
                "relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
                status === "completed"
                  ? "border-primary bg-primary text-primary-foreground"
                  : status === "current"
                  ? "border-primary bg-background text-primary animate-pulse"
                  : "border-muted bg-background text-muted-foreground"
              )}
            >
              {item.icon || <div className="h-2 w-2 rounded-full bg-current" />}
            </div>
            
            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p 
                  className={cn(
                    "text-sm font-medium transition-colors duration-150",
                    status === "completed" || status === "current"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {item.title}
                </p>
                {item.timestamp && (
                  <time 
                    className={cn(
                      "text-xs transition-colors duration-150",
                      status === "completed" || status === "current"
                        ? "text-muted-foreground"
                        : "text-muted-foreground/70"
                    )}
                  >
                    {item.timestamp}
                  </time>
                )}
              </div>
              {item.description && (
                <p 
                  className={cn(
                    "mt-1 text-xs transition-colors duration-150",
                    status === "completed" || status === "current"
                      ? "text-muted-foreground"
                      : "text-muted-foreground/70"
                  )}
                >
                  {item.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}