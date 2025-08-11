import { useState, useEffect } from "react";
import { WifiOff, Wifi, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OfflineBannerProps {
  className?: string;
  onRetry?: () => void;
  showDraftCount?: boolean;
}

/**
 * OfflineBanner - Displays connection status and offline capabilities
 * 
 * Features:
 * - Real-time online/offline status detection
 * - Visual indicators for connection state
 * - Draft claim count when offline
 * - Retry functionality for failed operations
 * - Auto-sync when connection is restored
 * - Accessible design with proper ARIA labels
 */
export function OfflineBanner({ className, onRetry, showDraftCount = true }: OfflineBannerProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowReconnected(true);
        setWasOffline(false);
        
        // Auto-hide the reconnected message after 5 seconds
        setTimeout(() => {
          setShowReconnected(false);
        }, 5000);

        // Trigger sync of pending operations
        syncPendingOperations();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load draft and pending sync counts from localStorage
    loadOfflineData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  const loadOfflineData = async () => {
    try {
      // Load draft count from IndexedDB
      const { getDrafts } = await import('@/lib/indexeddb');
      const drafts = await getDrafts();
      setDraftCount(drafts.length);

      // Load pending sync operations
      const { getPendingSync } = await import('@/lib/offline');
      const pending = await getPendingSync();
      setPendingSyncCount(pending.length);
    } catch (error) {
      console.error('Failed to load offline data:', error);
    }
  };

  const syncPendingOperations = async () => {
    try {
      const { syncPendingOperations } = await import('@/lib/offline');
      await syncPendingOperations();
      
      // Reload counts after sync
      await loadOfflineData();
    } catch (error) {
      console.error('Failed to sync pending operations:', error);
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      // Default retry behavior - reload the page
      window.location.reload();
    }
  };

  const handleDismissReconnected = () => {
    setShowReconnected(false);
  };

  // Don't show banner if online and no special states
  if (isOnline && !showReconnected && pendingSyncCount === 0) {
    return null;
  }

  return (
    <div className={cn("fixed top-0 left-0 right-0 z-50", className)}>
      {/* Offline Banner */}
      {!isOnline && (
        <Card className="rounded-none border-0 border-b bg-orange-50 border-orange-200">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <WifiOff className="h-5 w-5 text-orange-600" aria-hidden="true" />
                  <span className="font-medium text-orange-800">You're offline</span>
                </div>
                
                <div className="hidden sm:flex items-center space-x-2 text-sm text-orange-700">
                  <span>•</span>
                  <span>You can still create and edit draft claims</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {showDraftCount && draftCount > 0 && (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                    {draftCount} draft{draftCount !== 1 ? 's' : ''}
                  </Badge>
                )}
                
                {pendingSyncCount > 0 && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                    {pendingSyncCount} pending sync
                  </Badge>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="border-orange-300 text-orange-700 hover:bg-orange-100"
                  data-testid="retry-connection"
                >
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reconnected Banner */}
      {showReconnected && (
        <Card className="rounded-none border-0 border-b bg-green-50 border-green-200">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />
                  <span className="font-medium text-green-800">Connection restored</span>
                </div>
                
                <div className="hidden sm:flex items-center space-x-2 text-sm text-green-700">
                  {pendingSyncCount > 0 ? (
                    <>
                      <span>•</span>
                      <span>Syncing {pendingSyncCount} pending operation{pendingSyncCount !== 1 ? 's' : ''}...</span>
                    </>
                  ) : (
                    <>
                      <span>•</span>
                      <span>All data is up to date</span>
                    </>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissReconnected}
                className="text-green-700 hover:bg-green-100"
                data-testid="dismiss-reconnected"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync In Progress Banner */}
      {isOnline && pendingSyncCount > 0 && !showReconnected && (
        <Card className="rounded-none border-0 border-b bg-blue-50 border-blue-200">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="font-medium text-blue-800">Syncing data...</span>
                </div>
                
                <div className="hidden sm:flex items-center space-x-2 text-sm text-blue-700">
                  <span>•</span>
                  <span>{pendingSyncCount} operation{pendingSyncCount !== 1 ? 's' : ''} pending</span>
                </div>
              </div>

              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                <Wifi className="h-3 w-3 mr-1" />
                Online
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Hook for managing offline state
 */
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setWasOffline(false);
        // Trigger any necessary sync operations
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return {
    isOnline,
    wasOffline,
    isOffline: !isOnline,
  };
}

/**
 * Network status indicator component
 */
export function NetworkStatus({ className }: { className?: string }) {
  const { isOnline } = useOfflineStatus();

  return (
    <div className={cn("flex items-center space-x-1", className)}>
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4 text-green-600" />
          <span className="text-xs text-green-600">Online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-orange-600" />
          <span className="text-xs text-orange-600">Offline</span>
        </>
      )}
    </div>
  );
}