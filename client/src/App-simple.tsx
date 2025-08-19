import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import Landing from "@/pages/Landing";

function SimpleApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-slate-50">
        <Landing />
      </div>
    </QueryClientProvider>
  );
}

export default SimpleApp;