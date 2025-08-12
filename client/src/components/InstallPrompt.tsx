import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>;
}

interface InstallPromptProps {
  onDismiss?: () => void;
}

export function InstallPrompt({ onDismiss }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Check if already dismissed in the last 7 days
    const dismissedUntil = localStorage.getItem('medlink-install-dismissed-until');
    if (dismissedUntil && new Date(dismissedUntil) > new Date()) {
      return;
    }

    // Check if already installed
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      
      const installEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(installEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);
    
    try {
      // Show the install prompt
      await deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
        // Hide the prompt immediately on acceptance
        setIsVisible(false);
        onDismiss?.();
      } else {
        // User dismissed, hide for 7 days
        handleDismiss();
      }
      
      // Clear the deferredPrompt
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Error during installation:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    // Dismiss for 7 days
    const dismissUntil = new Date();
    dismissUntil.setDate(dismissUntil.getDate() + 7);
    localStorage.setItem('medlink-install-dismissed-until', dismissUntil.toISOString());
    
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible || !deferredPrompt) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm border-blue-200 bg-blue-50 shadow-lg sm:right-auto dark:border-blue-800 dark:bg-blue-950" data-testid="install-prompt">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-2">
          <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Install MedLink
          </CardTitle>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900"
          data-testid="dismiss-install"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <CardDescription className="text-sm text-blue-700 dark:text-blue-300">
          Install MedLink Claims Hub for faster access and offline functionality.
        </CardDescription>
        <div className="flex space-x-2">
          <Button
            onClick={handleInstall}
            disabled={isInstalling}
            className="flex-1 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
            size="sm"
            data-testid="install-app"
          >
            <Download className="mr-2 h-4 w-4" />
            {isInstalling ? 'Installing...' : 'Install'}
          </Button>
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900"
            size="sm"
            data-testid="not-now-install"
          >
            Not now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}