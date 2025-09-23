import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Smartphone, Copy, Check, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MFABackupCodes from './MFABackupCodes';

const setupFormSchema = z.object({
  code: z.string().length(6, 'Code must be exactly 6 digits').regex(/^\d+$/, 'Code must contain only numbers'),
});

type SetupFormValues = z.infer<typeof setupFormSchema>;

interface MFASetupResponse {
  qrCode: string;
  backupCodes: string[];
}

export default function MFASetup({ onSetupComplete }: { onSetupComplete?: () => void }) {
  const [qrCode, setQrCode] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [step, setStep] = useState<'intro' | 'scan' | 'verify' | 'backup'>('intro');
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const { toast } = useToast();

  const form = useForm<SetupFormValues>({
    resolver: zodResolver(setupFormSchema),
    defaultValues: {
      code: '',
    },
  });

  // Generate QR code and backup codes
  const setupMutation = useMutation({
    mutationFn: () => apiRequest('/api/auth/mfa/setup', { method: 'POST' }),
    onSuccess: (data: MFASetupResponse) => {
      setQrCode(data.qrCode);
      setBackupCodes(data.backupCodes);
      setStep('scan');
    },
    onError: (error: any) => {
      toast({
        title: 'Setup Failed',
        description: error.message || 'Failed to initiate MFA setup',
        variant: 'destructive',
      });
    },
  });

  // Verify setup code
  const verifyMutation = useMutation({
    mutationFn: (code: string) =>
      apiRequest('/api/auth/mfa/verify-setup', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    onSuccess: () => {
      toast({
        title: 'MFA Enabled',
        description: 'Multi-factor authentication has been successfully enabled for your account.',
      });
      setStep('backup');
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Invalid verification code. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleStartSetup = () => {
    setupMutation.mutate();
  };

  const onSubmit = (values: SetupFormValues) => {
    verifyMutation.mutate(values.code);
  };

  const handleBackupSaved = () => {
    setShowBackupDialog(false);
    onSetupComplete?.();
  };

  if (step === 'intro') {
    return (
      <Card className="w-full max-w-lg" data-testid="card-mfa-setup-intro">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Enable Multi-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your admin account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Multi-factor authentication (MFA) provides an additional security layer for your account.</p>
            <p>You'll need:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>An authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)</li>
              <li>Your smartphone to scan a QR code</li>
              <li>A secure place to store backup codes</li>
            </ul>
          </div>
          <Button
            onClick={handleStartSetup}
            disabled={setupMutation.isPending}
            className="w-full"
            data-testid="button-start-mfa-setup"
          >
            {setupMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <Smartphone className="mr-2 h-4 w-4" />
                Start Setup
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'scan') {
    return (
      <Card className="w-full max-w-lg" data-testid="card-mfa-scan-qr">
        <CardHeader>
          <CardTitle>Scan QR Code</CardTitle>
          <CardDescription>
            Use your authenticator app to scan this QR code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center p-4 bg-white rounded-lg">
            <img
              src={qrCode}
              alt="MFA QR Code"
              className="w-64 h-64"
              data-testid="img-mfa-qr-code"
            />
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium">Instructions:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open your authenticator app</li>
              <li>Tap the + or Add button</li>
              <li>Select "Scan QR Code"</li>
              <li>Point your camera at the QR code above</li>
            </ol>
          </div>
          <Button
            onClick={() => setStep('verify')}
            className="w-full"
            data-testid="button-continue-to-verify"
          >
            Continue to Verification
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'verify') {
    return (
      <Card className="w-full max-w-lg" data-testid="card-mfa-verify">
        <CardHeader>
          <CardTitle>Verify Setup</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="000000"
                        maxLength={6}
                        className="text-center text-2xl font-mono"
                        data-testid="input-mfa-code"
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the 6-digit code displayed in your authenticator app
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('scan')}
                  className="flex-1"
                  data-testid="button-back-to-scan"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={verifyMutation.isPending}
                  className="flex-1"
                  data-testid="button-verify-mfa"
                >
                  {verifyMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Enable'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  }

  if (step === 'backup') {
    return (
      <>
        <Card className="w-full max-w-lg" data-testid="card-mfa-backup">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              MFA Successfully Enabled
            </CardTitle>
            <CardDescription>
              Important: Save your backup codes before continuing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg space-y-2">
              <p className="text-sm font-medium text-amber-900">⚠️ Important Security Notice</p>
              <p className="text-sm text-amber-800">
                Save these backup codes in a secure location. You can use them to access your account if you lose access to your authenticator app.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowBackupDialog(true)}
                className="flex-1"
                data-testid="button-view-backup-codes"
              >
                <Download className="mr-2 h-4 w-4" />
                View Backup Codes
              </Button>
              <Button
                onClick={handleBackupSaved}
                variant="outline"
                className="flex-1"
                data-testid="button-finish-setup"
              >
                I've Saved My Codes
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Backup Codes</DialogTitle>
              <DialogDescription>
                Each code can only be used once. Store them securely.
              </DialogDescription>
            </DialogHeader>
            <MFABackupCodes codes={backupCodes} />
            <Button
              onClick={handleBackupSaved}
              className="w-full"
              data-testid="button-close-backup-dialog"
            >
              I've Saved My Codes
            </Button>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return null;
}