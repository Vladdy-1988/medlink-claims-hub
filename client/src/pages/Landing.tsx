export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">MedLink Claims Hub</h1>
          <p className="text-slate-600 mb-6">
            Secure healthcare claims management for providers
          </p>
          <button 
            onClick={handleLogin} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            data-testid="login-button"
          >
            Sign In to Continue
          </button>
        </div>
      </div>
    </div>
  );
}
