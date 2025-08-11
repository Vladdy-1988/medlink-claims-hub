import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  WifiOff, 
  Wifi, 
  RefreshCw, 
  Upload, 
  Check, 
  Clock,
  AlertTriangle 
} from "lucide-react";

interface OfflineItem {
  id: string;
  type: 'claim' | 'preauth' | 'file';
  title: string;
  timestamp: Date;
  status: 'pending' | 'syncing' | 'synced' | 'error';
}

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineItems, setOfflineItems] = useState<OfflineItem[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Connection restored",
        description: "You're back online. Syncing pending changes...",
      });
      syncOfflineData();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Connection lost",
        description: "You're now offline. Changes will be saved locally and synced when connection is restored.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Load offline items from IndexedDB
  useEffect(() => {
    loadOfflineItems();
  }, []);

  const loadOfflineItems = async () => {
    try {
      // TODO: Load from IndexedDB
      // const items = await getOfflineItems();
      // setOfflineItems(items);
      
      // Mock data for demonstration
      const mockItems: OfflineItem[] = [
        {
          id: '1',
          type: 'claim',
          title: 'Claim #CLM-2024-001 - Patient Smith',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          status: 'pending',
        },
        {
          id: '2',
          type: 'file',
          title: 'X-ray image upload',
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
          status: 'pending',
        },
      ];
      
      if (!isOnline) {
        setOfflineItems(mockItems);
      }
    } catch (error) {
      console.error('Failed to load offline items:', error);
    }
  };

  const syncOfflineData = async () => {
    if (!isOnline || offlineItems.length === 0) return;

    setIsSyncing(true);
    setSyncProgress(0);

    try {
      for (let i = 0; i < offlineItems.length; i++) {
        const item = offlineItems[i];
        
        // Update item status to syncing
        setOfflineItems(prev => prev.map(prevItem => 
          prevItem.id === item.id 
            ? { ...prevItem, status: 'syncing' }
            : prevItem
        ));

        try {
          // TODO: Sync individual item
          // await syncItem(item);
          
          // Simulate sync delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Mark as synced
          setOfflineItems(prev => prev.map(prevItem => 
            prevItem.id === item.id 
              ? { ...prevItem, status: 'synced' }
              : prevItem
          ));
          
        } catch (error) {
          // Mark as error
          setOfflineItems(prev => prev.map(prevItem => 
            prevItem.id === item.id 
              ? { ...prevItem, status: 'error' }
              : prevItem
          ));
          console.error(`Failed to sync item ${item.id}:`, error);
        }

        // Update progress
        const progress = ((i + 1) / offlineItems.length) * 100;
        setSyncProgress(progress);
      }

      // Remove synced items after a delay
      setTimeout(() => {
        setOfflineItems(prev => prev.filter(item => item.status !== 'synced'));
      }, 2000);

      toast({
        title: "Sync complete",
        description: "All offline changes have been synchronized.",
      });

    } catch (error) {
      console.error('Sync failed:', error);
      toast({
        title: "Sync failed",
        description: "Some changes could not be synchronized. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
    }
  };

  const retrySync = () => {
    if (isOnline) {
      syncOfflineData();
    }
  };

  const clearSyncedItems = () => {
    setOfflineItems(prev => prev.filter(item => item.status !== 'synced'));
  };

  // Don't show banner if online and no offline items
  if (isOnline && offlineItems.length === 0) {
    return null;
  }

  const pendingItems = offlineItems.filter(item => item.status === 'pending');
  const syncingItems = offlineItems.filter(item => item.status === 'syncing');
  const errorItems = offlineItems.filter(item => item.status === 'error');
  const syncedItems = offlineItems.filter(item => item.status === 'synced');

  return (
    <div className="space-y-2" data-testid="offline-banner">
      {/* Main Status Banner */}
      <Alert 
        className={isOnline ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20" : "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20"}
      >
        <div className="flex items-center space-x-2">
          {isOnline ? (
            <Wifi className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          ) : (
            <WifiOff className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          )}
          <div className="flex-1">
            <AlertTitle className="flex items-center space-x-2">
              <span>{isOnline ? "Online" : "Offline Mode"}</span>
              {offlineItems.length > 0 && (
                <Badge 
                  variant={errorItems.length > 0 ? "destructive" : "secondary"}
                  className="ml-2"
                >
                  {offlineItems.length} pending
                </Badge>
              )}
            </AlertTitle>
            <AlertDescription>
              {isOnline ? (
                isSyncing ? (
                  <div className="space-y-2">
                    <span>Syncing offline changes...</span>
                    <Progress value={syncProgress} className="h-2" />
                  </div>
                ) : offlineItems.length > 0 ? (
                  "You have offline changes ready to sync."
                ) : (
                  "All data is synchronized."
                )
              ) : (
                "Working offline. Changes will be saved locally and synced when connection is restored."
              )}
            </AlertDescription>
          </div>
          
          <div className="flex items-center space-x-2">
            {offlineItems.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                data-testid="button-toggle-details"
              >
                {showDetails ? "Hide" : "Show"} Details
              </Button>
            )}
            
            {isOnline && offlineItems.length > 0 && !isSyncing && (
              <Button
                variant="outline"
                size="sm"
                onClick={retrySync}
                data-testid="button-retry-sync"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </Button>
            )}
          </div>
        </div>
      </Alert>

      {/* Detailed Item List */}
      {showDetails && offlineItems.length > 0 && (
        <Alert>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Offline Changes</h4>
              {syncedItems.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSyncedItems}
                  data-testid="button-clear-synced"
                >
                  Clear Synced
                </Button>
              )}
            </div>
            
            <div className="space-y-2">
              {offlineItems.map(item => (
                <div 
                  key={item.id}
                  className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50"
                  data-testid={`offline-item-${item.id}`}
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {item.status === 'pending' && (
                      <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    )}
                    {item.status === 'syncing' && (
                      <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
                    )}
                    {item.status === 'synced' && (
                      <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    )}
                    {item.status === 'error' && (
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                  </div>

                  {/* Item Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium truncate">{item.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {item.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.timestamp.toLocaleString()}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <Badge 
                    variant={
                      item.status === 'error' ? 'destructive' :
                      item.status === 'synced' ? 'default' :
                      'secondary'
                    }
                    className="text-xs"
                  >
                    {item.status === 'pending' && 'Pending'}
                    {item.status === 'syncing' && 'Syncing'}
                    {item.status === 'synced' && 'Synced'}
                    {item.status === 'error' && 'Error'}
                  </Badge>

                  {/* Retry Button for Errors */}
                  {item.status === 'error' && isOnline && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Retry individual item
                        setOfflineItems(prev => prev.map(prevItem => 
                          prevItem.id === item.id 
                            ? { ...prevItem, status: 'pending' }
                            : prevItem
                        ));
                        syncOfflineData();
                      }}
                      data-testid={`button-retry-${item.id}`}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Alert>
      )}
    </div>
  );
}