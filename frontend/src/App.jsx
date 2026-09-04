import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { OnboardingFlow } from './components/OnboardingFlow';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getCurrentSession, validateSession, logoutUser } from './services/authService';
import { Loader2 } from 'lucide-react';

function App() {
  const [session, setSession] = useState(() => getCurrentSession());
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      try {
        const local = getCurrentSession();
        if (!local) {
          if (isMounted) setIsValidating(false);
          return;
        }

        // Explicitly validate session; on failure or expiry, clear session safely
        const restored = await validateSession();
        if (isMounted) {
          if (restored) {
            setSession(restored);
          } else {
            logoutUser();
            setSession(null);
          }
        }
      } catch (e) {
        console.warn('Session verification failed, logging out expired/invalid session:', e);
        logoutUser();
        if (isMounted) {
          setSession(null);
        }
      } finally {
        if (isMounted) setIsValidating(false);
      }
    };

    checkAuth();
    return () => { isMounted = false; };
  }, []);

  if (isValidating) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
        <p className="text-slate-400 font-mono">Loading Session...</p>
      </div>
    );
  }

  if (!session || !session.onboardingCompleted) {
    return (
      <ErrorBoundary>
        <div className="App">
          <OnboardingFlow 
            onComplete={(newSession) => {
              setSession(newSession);
            }} 
          />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="App">
        <Dashboard 
          currentUser={session}
          onSignOut={() => {
            logoutUser();
            setSession(null);
          }}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;

