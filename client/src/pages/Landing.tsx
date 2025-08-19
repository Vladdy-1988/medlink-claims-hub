import { Stethoscope, Shield, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const features = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Secure & Compliant",
      description: "HIPAA-compliant platform with end-to-end encryption for sensitive healthcare data."
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: "Fast Processing",
      description: "Streamlined workflows for faster claim submission and approval processing."
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: "Complete Tracking",
      description: "Real-time status updates and comprehensive claim history tracking."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-background dark:to-muted/20">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground shadow-soft">
                <Stethoscope className="w-8 h-8" />
              </div>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              MedLink Claims Hub
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Secure, efficient healthcare claims management system designed for verified medical providers. 
              Streamline your claims processing with our HIPAA-compliant platform.
            </p>
            
            <Button 
              onClick={handleLogin}
              size="lg"
              className="px-8 py-4 text-lg font-semibold rounded-xl shadow-soft hover:shadow-soft-lg transition-all duration-150"
              data-testid="login-button"
            >
              Sign In to Continue
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-soft hover:shadow-soft-lg transition-all duration-150 bg-card/60 backdrop-blur-sm">
                <CardHeader className="text-center pb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mx-auto mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Footer */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Healthcare claims management built for medical professionals
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
