import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  AlertTriangle, 
  Lock, 
  User, 
  UserCheck, 
  Crown,
  ArrowLeft
} from "lucide-react";
import { Link } from "wouter";

export type UserRole = 'provider' | 'billing' | 'admin';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
  showAccessDenied?: boolean;
  redirectTo?: string;
}

interface User {
  id: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  email?: string;
}

const roleConfig = {
  provider: {
    label: 'Provider',
    icon: User,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    description: 'Healthcare provider with claim submission access',
  },
  billing: {
    label: 'Billing Staff',
    icon: UserCheck,
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    description: 'Billing staff with full claims management access',
  },
  admin: {
    label: 'Administrator',
    icon: Crown,
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    description: 'Full administrative access to all features',
  },
};

export function RoleGuard({ 
  allowedRoles, 
  children, 
  fallback,
  showAccessDenied = true,
  redirectTo = '/'
}: RoleGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <Card data-testid="role-guard-loading">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 animate-pulse text-muted-foreground" />
            <p>Checking access permissions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Card data-testid="role-guard-unauthenticated">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lock className="h-5 w-5 text-red-600" />
            <span>Authentication Required</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            You must be logged in to access this content.
          </p>
          <Button asChild>
            <Link href="/api/login">
              <User className="h-4 w-4 mr-2" />
              Sign In
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const typedUser = user as User;
  const hasRequiredRole = allowedRoles.includes(typedUser.role);

  // Has required role - show content
  if (hasRequiredRole) {
    return <>{children}</>;
  }

  // Custom fallback provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default access denied UI
  if (showAccessDenied) {
    return <AccessDeniedCard user={typedUser} allowedRoles={allowedRoles} redirectTo={redirectTo} />;
  }

  // No fallback - render nothing
  return null;
}

interface AccessDeniedCardProps {
  user: User;
  allowedRoles: UserRole[];
  redirectTo: string;
}

function AccessDeniedCard({ user, allowedRoles, redirectTo }: AccessDeniedCardProps) {
  const userRoleConfig = roleConfig[user.role];
  const UserRoleIcon = userRoleConfig.icon;

  return (
    <Card className="max-w-2xl mx-auto" data-testid="role-guard-access-denied">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <span>Access Denied</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current User Role */}
        <div className="p-4 rounded-lg bg-muted">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-background">
              <UserRoleIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">
                {user.firstName} {user.lastName}
              </p>
              <div className="flex items-center space-x-2">
                <Badge className={userRoleConfig.color}>
                  {userRoleConfig.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {userRoleConfig.description}
          </p>
        </div>

        {/* Required Roles */}
        <div>
          <h3 className="font-medium mb-3">Required Access Level</h3>
          <div className="space-y-2">
            {allowedRoles.map(role => {
              const config = roleConfig[role];
              const RoleIcon = config.icon;
              
              return (
                <div 
                  key={role}
                  className="flex items-center space-x-3 p-3 rounded-lg border"
                >
                  <RoleIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{config.label}</span>
                      <Badge variant="outline">{role}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {config.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Help Message */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Need Access?</AlertTitle>
          <AlertDescription>
            Contact your administrator to request the appropriate role permissions. 
            Include details about what you need to access and why.
          </AlertDescription>
        </Alert>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" asChild data-testid="button-go-back">
            <Link href={redirectTo}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Link>
          </Button>
          
          <div className="text-sm text-muted-foreground">
            Need help? Contact support
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Utility hook for checking roles
export function useRole() {
  const { user } = useAuth();
  
  const hasRole = (role: UserRole): boolean => {
    if (!user) return false;
    return (user as User).role === role;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes((user as User).role);
  };

  const isProvider = (): boolean => hasRole('provider');
  const isBilling = (): boolean => hasRole('billing');
  const isAdmin = (): boolean => hasRole('admin');

  return {
    user: user as User | null,
    hasRole,
    hasAnyRole,
    isProvider,
    isBilling,
    isAdmin,
  };
}

// Higher-order component for role-based route protection
export function withRoleGuard<P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles: UserRole[],
  options?: Omit<RoleGuardProps, 'allowedRoles' | 'children'>
) {
  return function ProtectedComponent(props: P) {
    return (
      <RoleGuard allowedRoles={allowedRoles} {...options}>
        <Component {...props} />
      </RoleGuard>
    );
  };
}