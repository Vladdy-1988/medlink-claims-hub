// CSRF token management for the frontend

let csrfToken: string | null = null;

// Get CSRF token from cookie
function getCSRFTokenFromCookie(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrfToken') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

// Fetch CSRF token from server
export async function fetchCSRFToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/auth/csrf', {
      credentials: 'include',
    });
    
    if (response.ok) {
      const data = await response.json();
      csrfToken = data.csrfToken;
      return csrfToken;
    }
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
  }
  
  return null;
}

// Get current CSRF token (from memory or cookie)
export function getCSRFToken(): string | null {
  // Try to get from memory first
  if (csrfToken) {
    return csrfToken;
  }
  
  // Try to get from cookie
  csrfToken = getCSRFTokenFromCookie();
  return csrfToken;
}

// Initialize CSRF token on app load
export async function initializeCSRF(): Promise<void> {
  // Try to get from cookie first
  csrfToken = getCSRFTokenFromCookie();
  
  // If no token in cookie, fetch from server
  if (!csrfToken) {
    await fetchCSRFToken();
  }
}

// Add CSRF token to headers
export function addCSRFHeader(headers: HeadersInit = {}): HeadersInit {
  const token = getCSRFToken();
  
  if (token) {
    return {
      ...headers,
      'X-CSRF-Token': token,
    };
  }
  
  return headers;
}