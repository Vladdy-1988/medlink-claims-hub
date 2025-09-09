import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const isDev = import.meta.env.MODE === 'development';
  
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    queryFn: async () => {
      try {
        const res = await fetch("/api/auth/user", { credentials: "include" });
        if (res.status === 401 && !isDev) {
          return null; // Not authenticated, but not an error
        }
        if (!res.ok && !isDev) {
          throw new Error(`Failed to fetch user: ${res.status}`);
        }
        return await res.json();
      } catch (err) {
        console.log("Auth check failed:", err);
        // In development, return a mock user
        if (isDev) {
          return {
            id: 'dev-user-001',
            email: 'dev@medlinkclaims.com',
            firstName: 'Development',
            lastName: 'User',
            role: 'admin',
            orgId: '11111111-1111-1111-1111-111111111111'
          };
        }
        return null; // Return null instead of throwing
      }
    },
  });

  return {
    user,
    isLoading: isDev ? false : isLoading, // Never loading in dev mode
    isAuthenticated: isDev ? true : !!user, // Always authenticated in dev mode
    error,
  };
}
