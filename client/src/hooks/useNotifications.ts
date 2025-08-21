import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if notifications are supported
  useEffect(() => {
    setIsSupported('Notification' in window && 'serviceWorker' in navigator);
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Get VAPID public key
  const { data: vapidKey } = useQuery({
    queryKey: ['/api/push/vapid-key'],
    enabled: isSupported,
    retry: false,
  }) as { data?: { publicKey: string } };

  // Subscribe to push notifications
  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!isSupported) {
        throw new Error('Push notifications not supported');
      }

      // Request notification permission
      const permission = await Notification.requestPermission();
      setPermission(permission);
      
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Get VAPID key
      if (!vapidKey?.publicKey) {
        throw new Error('VAPID key not available');
      }

      // Subscribe to push manager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey.publicKey),
      });

      // Send subscription to server
      await apiRequest('/api/push/subscribe', 'POST', {
        endpoint: subscription.endpoint,
        p256dhKey: (subscription as any).keys?.p256dh,
        authKey: (subscription as any).keys?.auth,
      });

      return subscription;
    },
    onSuccess: () => {
      toast({
        title: "Notifications enabled",
        description: "You'll receive notifications about claim status changes.",
      });
      // Invalidate user data to refresh notification status
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: Error) => {
      console.error('Failed to subscribe to notifications:', error);
      toast({
        title: "Failed to enable notifications",
        description: error.message || "Please try again or check your browser settings.",
        variant: "destructive",
      });
    },
  });

  // Send test notification
  const testNotificationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/push/test', 'POST');
      return await response.json();
    },
    onSuccess: (result: { sent: number; failed: number }) => {
      if (result.sent > 0) {
        toast({
          title: "Test notification sent",
          description: "Check your notifications to see if it worked!",
        });
      } else {
        toast({
          title: "No active subscriptions",
          description: "Please enable notifications first.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Failed to send test notification",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  // Unsubscribe from notifications
  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          
          // Notify server
          await apiRequest('/api/push/unsubscribe', 'POST', {
            endpoint: subscription.endpoint
          });
        }
      }
    },
    onSuccess: () => {
      toast({
        title: "Notifications disabled",
        description: "You won't receive push notifications anymore.",
      });
      // Invalidate user data to refresh notification status
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: () => {
      toast({
        title: "Failed to disable notifications",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  return {
    isSupported,
    permission,
    subscribe: subscribeMutation.mutate,
    unsubscribe: unsubscribeMutation.mutate,
    sendTestNotification: testNotificationMutation.mutate,
    isSubscribing: subscribeMutation.isPending,
    isUnsubscribing: unsubscribeMutation.isPending,
    isSendingTest: testNotificationMutation.isPending,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}