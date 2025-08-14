import { ClaimWizard } from "@/components/ClaimWizard";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { extractAppointmentId, prefillClaimFromAppointment } from "@/lib/ssoHandler";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

export default function NewClaim() {
  const [, setLocation] = useLocation();
  const [prefillData, setPrefillData] = useState<any>(null);

  useEffect(() => {
    const appointmentId = extractAppointmentId();
    if (appointmentId) {
      const prefill = prefillClaimFromAppointment(appointmentId);
      setPrefillData(prefill);
    }
  }, []);

  const handleComplete = (claimId: string) => {
    setLocation(`/claims/${claimId}`);
  };

  return (
    <>
      <OfflineBanner />
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Create New Claim</h1>
          <p className="text-muted-foreground mt-2">
            Submit a new insurance claim for processing
          </p>
        </div>

        <ClaimWizard 
          type="claim" 
          onComplete={handleComplete} 
          prefillData={prefillData}
        />
      </div>
    </>
  );
}