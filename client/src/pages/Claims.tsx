import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClaimsTable } from "@/components/ClaimsTable";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Plus } from "lucide-react";
import { Link } from "wouter";

export default function Claims() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: claims, isLoading: claimsLoading, error } = useQuery({
    queryKey: ["/api/claims"],
    retry: false,
  });

  if (error && isUnauthorizedError(error as Error)) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
    return null;
  }

  return (
    <>
      <OfflineBanner />
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Claims Management</h1>
            <p className="text-muted-foreground mt-2">
              Manage and track all your insurance claims and pre-authorizations
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild data-testid="button-new-preauth" variant="outline">
              <Link href="/preauths/new">New Pre-Auth</Link>
            </Button>
            <Button asChild data-testid="button-new-claim">
              <Link href="/claims/new">
                <Plus className="h-4 w-4 mr-2" />
                New Claim
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Claims</CardTitle>
          </CardHeader>
          <CardContent>
            <ClaimsTable 
              claims={claims || []}
              isLoading={claimsLoading}
              data-testid="claims-table"
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}