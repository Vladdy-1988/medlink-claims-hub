import { ClaimWizard } from "@/components/ClaimWizard";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useLocation } from "wouter";

export default function NewPreAuth() {
  const [, setLocation] = useLocation();

  const handleComplete = (preAuthId: string) => {
    setLocation(`/claims/${preAuthId}`);
  };

  return (
    <>
      <OfflineBanner />
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Request Pre-Authorization</h1>
          <p className="text-muted-foreground mt-2">
            Submit a new pre-authorization request for treatment approval
          </p>
        </div>

        <ClaimWizard type="preauth" onComplete={handleComplete} />
      </div>
    </>
  );
}