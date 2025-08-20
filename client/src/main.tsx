import { createRoot } from "react-dom/client";
import "./index-clean.css";

// Simple test component to verify React is working
function TestApp() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', minHeight: '100vh', background: '#f5f5f5' }}>
      <h1 style={{ color: '#2563eb', marginBottom: '20px' }}>MedLink Claims Hub</h1>
      <p>✅ React is now working!</p>
      <p>✅ TypeScript compilation successful</p>
      <p>✅ Vite dev server running</p>
      <div style={{ marginTop: '20px', padding: '15px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h3>Ready for Development!</h3>
        <p>The preview window is now working. You can now develop your app in the Replit environment.</p>
      </div>
    </div>
  );
}

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

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<TestApp />);
} else {
  console.error("Root element not found!");
}
