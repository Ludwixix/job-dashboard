import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import SiteGate, { isSiteUnlocked, setSiteUnlocked } from './components/SiteGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getCurrentSession, validateSession, logoutUser } from './services/authService';
import { Loader2 } from 'lucide-react';

function App() {
  const [session, setSession] = useState(() => getCurrentSession());
  const [isUnlocked, setIsUnlocked] = useState(() => isSiteUnlocked());
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      try {
        if (!isSiteUnlocked()) {
          if (isMounted) setIsValidating(false);
          return;
        }

        const local = getCurrentSession();
        if (!local) {
          if (isMounted) setIsValidating(false);
          return;
        }

        const restored = await validateSession();
        if (isMounted && restored) {
          setSession(restored);
        }
      } catch (e) {
        console.warn('Session check note:', e);
      } finally {
        if (isMounted) setIsValidating(false);
      }
    };

    checkAuth();
    return () => { isMounted = false; };
  }, []);

  if (isValidating) {
    return (
      <div className="min-h-screen bg-[#070605] flex flex-col items-center justify-center font-mono">
        <Loader2 className="animate-spin text-[#d48b38] mb-4" size={40} />
        <p className="text-[#a89d8e] text-xs tracking-widest uppercase">INITIALIZING CAREER.AGENT...</p>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <ErrorBoundary>
        <SiteGate 
          onUnlock={(newSession) => {
            setIsUnlocked(true);
            setSession(newSession);
          }} 
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="App">
        <Dashboard 
          currentUser={session}
          onSignOut={() => {
            setSiteUnlocked(false);
            logoutUser();
            setSession(null);
            setIsUnlocked(false);
          }}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;

