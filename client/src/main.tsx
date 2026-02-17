import { createRoot } from "react-dom/client";
import "./index-clean.css";
import App from "./App";
import { initSentry, ErrorBoundary } from "./lib/sentry";

// Initialize Sentry before React app
initSentry();

// Add global error handler to catch any unhandled errors
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  console.error('Error message:', event.message);
  console.error('Source:', event.filename, 'Line:', event.lineno);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('[SW] Registered successfully:', registration);
      })
      .catch((error) => {
        console.log('[SW] Registration failed:', error);
      });
  });
}

console.log('🚀 MedLink main.tsx starting...');

try {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    console.log('✅ Root element found, creating React root...');
    const root = createRoot(rootElement);
    root.render(
      <ErrorBoundary
        fallback={({ error }: { error: unknown }) => (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <h1>Application Error</h1>
            <p>Something went wrong. Please try refreshing the page.</p>
            {import.meta.env.MODE === 'development' && (
              <details style={{ marginTop: '20px', textAlign: 'left' }}>
                <summary>Error details (development only)</summary>
                <pre>{error instanceof Error ? error.message : 'Unknown error'}</pre>
              </details>
            )}
          </div>
        )}
        showDialog={false}
      >
        <App />
      </ErrorBoundary>
    );
    console.log('✅ React app rendered successfully with error boundary');
  } else {
    console.error("❌ Root element not found!");
    // Create a fallback message
    document.body.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Loading Error</h1><p>Root element not found. Please refresh the page.</p></div>';
  }
} catch (error) {
  console.error('❌ Critical error in main.tsx:', error);
  document.body.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Application Error</h1><p>Failed to load application. Please check console for details.</p></div>';
}
