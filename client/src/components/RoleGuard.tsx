import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, AlertTriangle } from "lucide-react";

interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAll?: boolean; // If true, user must have ALL roles; if false, user needs ANY role
}

/**
 * RoleGuard - Protects components and routes based on user roles
 * 
 * Features:
 * - Role-based access control (RBAC)
 * - Support for multiple role requirements
 * - Customizable fallback content
 * - Loading state handling
 * - Accessible error states
 */
export function RoleGuard({ 
  allowedRoles, 
  children, 
  fallback,
  requireAll = false 
}: RoleGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="p-6 text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-3/4 mx-auto"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto mt-2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Card className="max-w-md mx-auto mt-8" data-testid="auth-required">
        <CardContent className="p-6 text-center">
          <Lock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Authentication Required
          </h2>
          <p className="text-slate-600 mb-4">
            You need to be logged in to access this content.
          </p>
          <a 
            href="/api/login"
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            Sign In
          </a>
        </CardContent>
      </Card>
    );
  }

  // Check role permissions
  const userRole = user.role;
  const hasPermission = requireAll 
    ? allowedRoles.every(role => userRole === role || (userRole === 'admin' && role !== 'admin'))
    : allowedRoles.some(role => userRole === role || userRole === 'admin');

  // Show access denied if user doesn't have required roles
  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Card className="max-w-md mx-auto mt-8" data-testid="access-denied">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Access Denied
          </h2>
          <p className="text-slate-600 mb-4">
            You don't have permission to access this content.
          </p>
          <div className="text-sm text-slate-500">
            <p>Required role{allowedRoles.length > 1 ? 's' : ''}: {allowedRoles.join(', ')}</p>
            <p>Your role: {userRole}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // User has permission, render children
  return <>{children}</>;
}

/**
 * Hook for checking role permissions
 */
export function useRoleCheck() {
  const { user, isAuthenticated } = useAuth();

  const hasRole = (role: string): boolean => {
    if (!isAuthenticated || !user) return false;
    return user.role === role || user.role === 'admin';
  };

  const hasAnyRole = (roles: string[]): boolean => {
    if (!isAuthenticated || !user) return false;
    return roles.some(role => hasRole(role));
  };

  const hasAllRoles = (roles: string[]): boolean => {
    if (!isAuthenticated || !user) return false;
    return roles.every(role => hasRole(role));
  };

  const isProvider = (): boolean => hasRole('provider');
  const isBilling = (): boolean => hasRole('billing');
  const isAdmin = (): boolean => hasRole('admin');

  return {
    hasRole,
    hasAnyRole,
    hasAllRoles,
    isProvider,
    isBilling,
    isAdmin,
    userRole: user?.role,
  };
}

/**
 * Component variants for common role patterns
 */
export const ProviderOnly = ({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) => (
  <RoleGuard allowedRoles={['provider']} fallback={fallback}>
    {children}
  </RoleGuard>
);

export const BillingOnly = ({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) => (
  <RoleGuard allowedRoles={['billing']} fallback={fallback}>
    {children}
  </RoleGuard>
);

export const AdminOnly = ({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) => (
  <RoleGuard allowedRoles={['admin']} fallback={fallback}>
    {children}
  </RoleGuard>
);

export const BillingOrAdmin = ({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) => (
  <RoleGuard allowedRoles={['billing', 'admin']} fallback={fallback}>
    {children}
  </RoleGuard>
);

export const ProviderOrBilling = ({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) => (
  <RoleGuard allowedRoles={['provider', 'billing']} fallback={fallback}>
    {children}
  </RoleGuard>
);

/**
 * Higher-order component for role-based route protection
 */
export function withRoleGuard<P extends object>(
  Component: React.ComponentType<P>, 
  allowedRoles: string[],
  requireAll = false
) {
  return function GuardedComponent(props: P) {
    return (
      <RoleGuard allowedRoles={allowedRoles} requireAll={requireAll}>
        <Component {...props} />
      </RoleGuard>
    );
  };
}