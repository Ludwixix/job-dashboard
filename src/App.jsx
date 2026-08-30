import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { OnboardingFlow } from './components/OnboardingFlow';
import { getCurrentSession, validateSession } from './services/authService';
import { Loader2 } from 'lucide-react';

function App() {
  const [session, setSession] = useState(getCurrentSession());
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // If no local session marker exists, skip validation (forces login)
      if (!session) {
        setIsValidating(false);
        return;
      }
      
      // Demo users don't have a backend session to validate
      if (session.isDemoUser) {
        setIsValidating(false);
        return;
      }

      // Validate real users with backend
      const validSession = await validateSession();
      setSession(validSession);
      setIsValidating(false);
    };

    checkAuth();
  }, []); // Run once on mount

  if (isValidating) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
        <p className="text-slate-400 font-mono">Verifying Session...</p>
      </div>
    );
  }

  if (!session || !session.onboardingCompleted) {
    return (
      <div className="App">
        <OnboardingFlow 
          onComplete={(newSession) => {
            setSession(newSession);
          }} 
        />
      </div>
    );
  }

  return (
    <div className="App">
      <Dashboard 
        currentUser={session}
        onSignOut={() => setSession(null)}
      />
    </div>
  );
}

export default App;
