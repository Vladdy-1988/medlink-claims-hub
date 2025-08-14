import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WifiOff, Wifi, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OfflineBannerProps {
  className?: string;
}

export function OfflineBanner({ className = "" }: OfflineBannerProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(!navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [lastSyncAttempt, setLastSyncAttempt] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(false);
      // Try to sync pending data when coming back online
      attemptSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for pending syncs on mount
    checkPendingSyncs();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkPendingSyncs = async () => {
    try {
      // Check IndexedDB for pending data that needs to sync
      // This is a stub - in real implementation, check your offline storage
      const pendingCount = 0; // Placeholder
      setPendingSyncs(pendingCount);
    } catch (error) {
      console.error('Error checking pending syncs:', error);
    }
  };

  const attemptSync = async () => {
    if (!isOnline) return;
    
    setLastSyncAttempt(new Date());
    
    try {
      // Attempt to sync pending data
      // This is a stub - in real implementation, sync your offline data
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate sync
      setPendingSyncs(0);
    } catch (error) {
      console.error('Sync failed:', error);
      // Could implement retry logic here
    }
  };

  const dismissBanner = () => {
    setShowBanner(false);
  };

  // Don't show banner if online and no pending syncs
  if (isOnline && pendingSyncs === 0 && !showBanner) {
    return null;
  }

  const getAlertContent = () => {
    if (!isOnline) {
      return {
        variant: "destructive" as const,
        icon: WifiOff,
        title: "You're offline",
        description: "Some features may be limited. Your data will sync when connection is restored.",
        actions: null
      };
    }

    if (pendingSyncs > 0) {
      return {
        variant: "default" as const,
        icon: Clock,
        title: "Syncing data",
        description: `${pendingSyncs} item(s) pending sync. ${lastSyncAttempt ? `Last attempt: ${lastSyncAttempt.toLocaleTimeString()}` : ''}`,
        actions: (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={attemptSync}
            disabled={!isOnline}
            data-testid="button-retry-sync"
          >
            Retry Sync
          </Button>
        )
      };
    }

    // Recently came online
    return {
      variant: "default" as const,
      icon: CheckCircle,
      title: "Back online",
      description: "Connection restored. All data is synced.",
      actions: (
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={dismissBanner}
          data-testid="button-dismiss-banner"
        >
          Dismiss
        </Button>
      )
    };
  };

  const { variant, icon: Icon, title, description, actions } = getAlertContent();

  return (
    <div className={`sticky top-0 z-50 ${className}`} data-testid="offline-banner">
      <Alert variant={variant} className="rounded-none border-x-0 border-t-0">
        <Icon className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <span className="font-medium">{title}</span>
            {description && <span className="ml-2 text-sm opacity-90">{description}</span>}
          </div>
          {actions && <div className="ml-4">{actions}</div>}
        </AlertDescription>
      </Alert>
    </div>
  );
}