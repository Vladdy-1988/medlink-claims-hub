import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Claims from "@/pages/Claims";
import ClaimDetail from "@/pages/ClaimDetail";
import NewClaim from "@/pages/NewClaim";
import NewPreAuth from "@/pages/NewPreAuth";
import Remittances from "@/pages/Remittances";
import Settings from "@/pages/Settings";
import Admin from "@/pages/Admin";
import Layout from "@/components/Layout";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <Layout>
          <Route path="/" component={Dashboard} />
          <Route path="/claims" component={Claims} />
          <Route path="/claims/new" component={NewClaim} />
          <Route path="/claims/:id" component={ClaimDetail} />
          <Route path="/preauths/new" component={NewPreAuth} />
          <Route path="/remittances" component={Remittances} />
          <Route path="/settings" component={Settings} />
          <Route path="/admin" component={Admin} />
        </Layout>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
