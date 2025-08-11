import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-heartbeat text-white text-2xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">MedLink Claims Hub</h1>
            <p className="text-slate-600 mb-6">
              Secure healthcare claims management for providers
            </p>
            <Button 
              onClick={handleLogin} 
              className="w-full" 
              size="lg"
              data-testid="login-button"
            >
              Sign In to Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
