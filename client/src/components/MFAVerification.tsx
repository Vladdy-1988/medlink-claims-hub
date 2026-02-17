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
import { Loader2, ShieldCheck, KeyRound } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const verifyFormSchema = z.object({
  code: z.string().length(6, 'Code must be exactly 6 digits').regex(/^\d+$/, 'Code must contain only numbers'),
});

const backupFormSchema = z.object({
  backupCode: z.string().min(8, 'Backup code must be at least 8 characters'),
});

type VerifyFormValues = z.infer<typeof verifyFormSchema>;
type BackupFormValues = z.infer<typeof backupFormSchema>;

interface MFAVerificationProps {
  onVerificationComplete?: () => void;
  onCancel?: () => void;
}

export default function MFAVerification({ onVerificationComplete, onCancel }: MFAVerificationProps) {
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'totp' | 'backup'>('totp');
  const { toast } = useToast();

  const totpForm = useForm<VerifyFormValues>({
    resolver: zodResolver(verifyFormSchema),
    defaultValues: {
      code: '',
    },
  });

  const backupForm = useForm<BackupFormValues>({
    resolver: zodResolver(backupFormSchema),
    defaultValues: {
      backupCode: '',
    },
  });

  // Verify MFA code
  const verifyMutation = useMutation({
    mutationFn: async (data: { code?: string; backupCode?: string }): Promise<any> => {
      const response = await apiRequest('/api/auth/mfa/verify', 'POST', data);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Verification Successful',
        description: data.usedBackupCode 
          ? `Backup code used. ${data.remainingBackupCodes || 0} codes remaining.`
          : 'You have been successfully authenticated.',
      });
      
      // Invalidate user query to refresh auth status
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/mfa/status'] });
      
      onVerificationComplete?.();
    },
    onError: (error: any) => {
      const errorData = error.response?.data || error;
      
      if (errorData.attemptsRemaining !== undefined) {
        setAttemptsRemaining(errorData.attemptsRemaining);
      }
      
      toast({
        title: 'Verification Failed',
        description: errorData.message || 'Invalid verification code. Please try again.',
        variant: 'destructive',
      });
      
      // Reset the form
      if (activeTab === 'totp') {
        totpForm.reset();
      } else {
        backupForm.reset();
      }
    },
  });

  const onSubmitTOTP = (values: VerifyFormValues) => {
    verifyMutation.mutate({ code: values.code });
  };

  const onSubmitBackup = (values: BackupFormValues) => {
    verifyMutation.mutate({ backupCode: values.backupCode });
  };

  return (
    <Card className="w-full max-w-md" data-testid="card-mfa-verification">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Enter your authentication code to continue
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {attemptsRemaining !== null && attemptsRemaining < 3 && (
          <Alert variant="destructive" data-testid="alert-attempts-remaining">
            <AlertDescription>
              Warning: You have {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining.
            </AlertDescription>
          </Alert>
        )}
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'totp' | 'backup')}>
          <TabsList className="grid w-full grid-cols-2" data-testid="tabs-mfa-method">
            <TabsTrigger value="totp" data-testid="tab-totp">Authenticator App</TabsTrigger>
            <TabsTrigger value="backup" data-testid="tab-backup">Backup Code</TabsTrigger>
          </TabsList>
          
          <TabsContent value="totp" className="space-y-4">
            <Form {...totpForm}>
              <form onSubmit={totpForm.handleSubmit(onSubmitTOTP)} className="space-y-4">
                <FormField
                  control={totpForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>6-Digit Code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          placeholder="000000"
                          maxLength={6}
                          className="text-center text-2xl font-mono"
                          autoComplete="one-time-code"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          data-testid="input-totp-code"
                        />
                      </FormControl>
                      <FormDescription>
                        Enter the code from your authenticator app
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  {onCancel && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onCancel}
                      className="flex-1"
                      data-testid="button-cancel-mfa"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={verifyMutation.isPending}
                    className="flex-1"
                    data-testid="button-verify-totp"
                  >
                    {verifyMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
          
          <TabsContent value="backup" className="space-y-4">
            <Form {...backupForm}>
              <form onSubmit={backupForm.handleSubmit(onSubmitBackup)} className="space-y-4">
                <FormField
                  control={backupForm.control}
                  name="backupCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Backup Code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          placeholder="XXXX-XXXX"
                          className="font-mono uppercase"
                          autoComplete="off"
                          data-testid="input-backup-code"
                        />
                      </FormControl>
                      <FormDescription>
                        Enter one of your backup codes (single use only)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  {onCancel && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onCancel}
                      className="flex-1"
                      data-testid="button-cancel-backup"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={verifyMutation.isPending}
                    className="flex-1"
                    data-testid="button-verify-backup"
                  >
                    {verifyMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <KeyRound className="mr-2 h-4 w-4" />
                        Verify Backup Code
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
        
        <div className="text-sm text-muted-foreground text-center">
          <p>Having trouble? Contact your system administrator.</p>
        </div>
      </CardContent>
    </Card>
  );
}
