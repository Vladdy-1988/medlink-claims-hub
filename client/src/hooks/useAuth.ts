import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    queryFn: async () => {
      try {
        const res = await fetch("/api/auth/user", { credentials: "include" });
        if (res.status === 401) {
          return null; // Not authenticated, but not an error
        }
        if (!res.ok) {
          throw new Error(`Failed to fetch user: ${res.status}`);
        }
        return await res.json();
      } catch (err) {
        console.log("Auth check failed:", err);
        return null; // Return null instead of throwing
      }
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}
