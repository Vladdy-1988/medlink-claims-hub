import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, Check, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MFABackupCodesProps {
  codes: string[];
  fileContent?: string;
}

export default function MFABackupCodes({ codes, fileContent }: MFABackupCodesProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [allCopied, setAllCopied] = useState(false);
  const { toast } = useToast();

  const formatCode = (code: string) => {
    // Format code as XXXX-XXXX if it's 8 characters
    if (code.length === 8) {
      return `${code.slice(0, 4)}-${code.slice(4)}`;
    }
    return code;
  };

  const copyCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      toast({
        title: 'Code Copied',
        description: 'Backup code copied to clipboard',
      });
      
      // Reset after 2 seconds
      setTimeout(() => {
        setCopiedIndex(null);
      }, 2000);
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy code to clipboard',
        variant: 'destructive',
      });
    }
  };

  const copyAllCodes = async () => {
    try {
      const allCodesText = codes.map((code, index) => 
        `${index + 1}. ${formatCode(code)}`
      ).join('\n');
      
      await navigator.clipboard.writeText(allCodesText);
      setAllCopied(true);
      toast({
        title: 'All Codes Copied',
        description: 'All backup codes copied to clipboard',
      });
      
      // Reset after 2 seconds
      setTimeout(() => {
        setAllCopied(false);
      }, 2000);
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy codes to clipboard',
        variant: 'destructive',
      });
    }
  };

  const downloadCodes = () => {
    // Create download content
    const content = fileContent || `MedLink Claims Hub - MFA Backup Codes
=====================================
Generated: ${new Date().toISOString()}

IMPORTANT: Store these codes in a safe place.
Each code can only be used once.

Backup Codes:
${codes.map((code, index) => `${index + 1}. ${formatCode(code)}`).join('\n')}

=====================================
If you lose access to your authenticator app,
you can use one of these codes to sign in.`;

    // Create blob and download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mfa-backup-codes-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Codes Downloaded',
      description: 'Backup codes saved to file',
    });
  };

  return (
    <div className="space-y-4" data-testid="container-backup-codes">
      <div className="flex gap-2">
        <Button
          onClick={copyAllCodes}
          variant="outline"
          size="sm"
          className="flex-1"
          data-testid="button-copy-all-codes"
        >
          {allCopied ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy All
            </>
          )}
        </Button>
        <Button
          onClick={downloadCodes}
          variant="outline"
          size="sm"
          className="flex-1"
          data-testid="button-download-codes"
        >
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </div>
      
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-2">
            {codes.map((code, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-muted rounded-md hover:bg-muted/80 transition-colors group"
                data-testid={`backup-code-${index}`}
              >
                <span className="font-mono text-sm">
                  <span className="text-muted-foreground mr-2">{index + 1}.</span>
                  {formatCode(code)}
                </span>
                <Button
                  onClick={() => copyCode(code, index)}
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                  data-testid={`button-copy-code-${index}`}
                >
                  {copiedIndex === index ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <strong>Important:</strong> Each backup code can only be used once. Store these codes in a secure location separate from your authenticator device.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}