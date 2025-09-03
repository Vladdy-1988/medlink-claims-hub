import webpush from 'web-push';
import { db } from './db';
import { pushSubscriptions, users, claims } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Check if VAPID keys are configured
const hasVapid = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

// Initialize VAPID keys only if available
let vapidKeys: { publicKey: string; privateKey: string } | null = null;

if (hasVapid) {
  vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY!,
    privateKey: process.env.VAPID_PRIVATE_KEY!,
  };
  
  // Configure web-push only when keys are available
  webpush.setVapidDetails(
    'mailto:noreply@medlink.claims',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
} else {
  console.warn('Push disabled: missing VAPID keys');
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: {
    claimId?: string;
    action?: string;
    url?: string;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export class PushNotificationService {
  
  /**
   * Get VAPID public key for client registration
   */
  static getVAPIDPublicKey(): string {
    if (!hasVapid || !vapidKeys) {
      return '';
    }
    return vapidKeys.publicKey;
  }

  /**
   * Save a push subscription for a user
   */
  static async savePushSubscription(
    userId: string,
    orgId: string,
    subscription: {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    },
    userAgent?: string
  ): Promise<void> {
    if (!hasVapid) {
      throw new Error('Push notifications disabled: missing VAPID keys');
    }
    
    try {
      // Remove any existing subscriptions for this user/org to prevent duplicates
      await db
        .delete(pushSubscriptions)
        .where(and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.orgId, orgId)
        ));

      // Insert new subscription
      await db.insert(pushSubscriptions).values({
        userId,
        orgId,
        endpoint: subscription.endpoint,
        p256dhKey: subscription.keys.p256dh,
        authKey: subscription.keys.auth,
        userAgent: userAgent?.substring(0, 500) || null,
        isActive: true,
      });

      console.log(`Push subscription saved for user ${userId}`);
    } catch (error) {
      console.error('Error saving push subscription:', error);
      throw error;
    }
  }

  /**
   * Send a push notification to a specific user
   */
  static async sendToUser(
    userId: string,
    payload: NotificationPayload
  ): Promise<{ sent: number; failed: number }> {
    if (!hasVapid) {
      return { sent: 0, failed: 0 };
    }
    
    try {
      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.isActive, true)
        ));

      if (subscriptions.length === 0) {
        console.log(`No active push subscriptions found for user ${userId}`);
        return { sent: 0, failed: 0 };
      }

      let sent = 0;
      let failed = 0;

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dhKey,
                auth: subscription.authKey,
              },
            },
            JSON.stringify(payload),
            {
              TTL: 86400, // 24 hours
              urgency: 'normal',
            }
          );
          sent++;
        } catch (error: any) {
          console.error(`Failed to send push notification to subscription ${subscription.id}:`, error);
          
          // Deactivate invalid subscriptions
          if (error.statusCode === 410 || error.statusCode === 404) {
            await db
              .update(pushSubscriptions)
              .set({ isActive: false })
              .where(eq(pushSubscriptions.id, subscription.id));
          }
          failed++;
        }
      }

      return { sent, failed };
    } catch (error) {
      console.error('Error sending push notifications:', error);
      throw error;
    }
  }

  /**
   * Send a test notification to a user
   */
  static async sendTestNotification(userId: string): Promise<{ sent: number; failed: number }> {
    if (!hasVapid) {
      throw new Error('Push notifications disabled: missing VAPID keys');
    }
    
    const payload: NotificationPayload = {
      title: 'MedLink Claims Hub',
      body: 'Test notification - your push notifications are working!',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: {
        action: 'test',
        url: '/',
      },
    };

    return this.sendToUser(userId, payload);
  }

  /**
   * Send claim status change notification
   */
  static async sendClaimStatusNotification(
    claimId: string,
    newStatus: string,
    userId: string
  ): Promise<{ sent: number; failed: number }> {
    if (!hasVapid) {
      return { sent: 0, failed: 0 };
    }
    const statusMessages = {
      paid: {
        title: '✅ Claim Approved',
        body: 'Your claim has been approved and payment is being processed.',
      },
      denied: {
        title: '❌ Claim Denied',
        body: 'Your claim was denied. Check the details for more information.',
      },
      infoRequested: {
        title: '📋 Information Requested',
        body: 'Additional information is required for your claim.',
      },
      submitted: {
        title: '📤 Claim Submitted',
        body: 'Your claim has been successfully submitted for processing.',
      },
    };

    const statusConfig = statusMessages[newStatus as keyof typeof statusMessages];
    
    if (!statusConfig) {
      console.log(`No notification configured for status: ${newStatus}`);
      return { sent: 0, failed: 0 };
    }

    const payload: NotificationPayload = {
      title: statusConfig.title,
      body: statusConfig.body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: {
        claimId,
        action: 'view_claim',
        url: `/claims/${claimId}`,
      },
      actions: [
        {
          action: 'view_claim',
          title: 'View Claim',
        },
      ],
    };

    return this.sendToUser(userId, payload);
  }

  /**
   * Get all active subscriptions for debugging
   */
  static async getActiveSubscriptionsCount(): Promise<number> {
    const result = await db
      .select({ count: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.isActive, true));
    
    return result.length;
  }

  /**
   * Remove subscription for a user
   */
  static async removeSubscription(userId: string, endpoint: string): Promise<void> {
    await db
      .update(pushSubscriptions)
      .set({ isActive: false })
      .where(and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      ));
  }
}

export { vapidKeys };