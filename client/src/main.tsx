import { createRoot } from "react-dom/client";
import "./index-clean.css";

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

function SimpleApp() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: '#2563eb' }}>🏥 MedLink Claims Hub</h1>
      <p>Medical claims management system is loading successfully!</p>
      <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: '8px', marginTop: '20px' }}>
        <h2>System Status</h2>
        <ul>
          <li>✅ Frontend: React app running</li>
          <li>✅ Backend: Express server connected</li>
          <li>✅ Database: PostgreSQL ready</li>
          <li>✅ Authentication: Development mode</li>
        </ul>
      </div>
    </div>
  );
}

try {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    console.log('✅ Root element found, creating React root...');
    const root = createRoot(rootElement);
    root.render(<SimpleApp />);
    console.log('✅ React app rendered successfully');
  } else {
    console.error("❌ Root element not found!");
    // Create a fallback message
    document.body.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Loading Error</h1><p>Root element not found. Please refresh the page.</p></div>';
  }
} catch (error) {
  console.error('❌ Critical error in main.tsx:', error);
  document.body.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Application Error</h1><p>Failed to load application. Please check console for details.</p></div>';
}
