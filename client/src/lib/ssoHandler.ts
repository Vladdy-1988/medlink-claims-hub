import { apiRequest } from "./queryClient";

interface SSOResponse {
  ok: boolean;
  redirect?: string;
  error?: string;
}

export async function handleSSOLogin(): Promise<boolean> {
  const urlParams = new URLSearchParams(window.location.search);
  const sso = urlParams.get('sso');
  const token = urlParams.get('token');
  const next = urlParams.get('next');

  // Check if this is an SSO login request
  if (sso === '1' && token) {
    try {
      const response = await fetch('/auth/sso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, next }),
        credentials: 'include',
      });

      const data: SSOResponse = await response.json();

      if (data.ok && data.redirect) {
        // Clean up URL parameters
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('sso');
        newUrl.searchParams.delete('token');
        newUrl.searchParams.delete('next');
        
        // Replace current history entry to clean URL
        window.history.replaceState({}, '', newUrl.pathname + newUrl.search);
        
        // Navigate to the redirect URL
        window.location.href = data.redirect;
        return true;
      } else {
        console.error('SSO login failed:', data.error);
        // Redirect to regular login on SSO failure
        window.location.href = '/api/login';
        return false;
      }
    } catch (error) {
      console.error('SSO login error:', error);
      // Redirect to regular login on error
      window.location.href = '/api/login';
      return false;
    }
  }

  return false;
}

export function extractAppointmentId(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('appointmentId');
}

export function prefillClaimFromAppointment(appointmentId: string) {
  // This can be called by the NewClaim component to prefill form data
  // Implementation would depend on your appointment data structure
  return {
    appointmentId,
    // Add other prefill data as needed
  };
}