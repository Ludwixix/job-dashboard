import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Dashboard } from './components/Dashboard';
import { isSiteUnlocked, setSiteUnlocked } from './utils/siteGateStorage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getCurrentSession, validateSession, logoutUser } from './services/authService';
import { Loader2 } from 'lucide-react';
import { BrowserRouter } from 'react-router-dom';

const SiteGate = lazy(() => import('./components/SiteGate'));
const OnboardingFlow = lazy(() => import('./components/OnboardingFlow').then(m => ({ default: m.OnboardingFlow })));

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
        <Suspense fallback={
          <div className="min-h-screen bg-[#070605] flex items-center justify-center font-mono">
            <Loader2 className="animate-spin text-[#d48b38]" size={36} />
          </div>
        }>
          <SiteGate 
            onUnlock={(newSession) => {
              setIsUnlocked(true);
              setSession(newSession);
            }} 
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (session && !session.onboardingCompleted) {
    return (
      <ErrorBoundary>
        <Suspense fallback={
          <div className="min-h-screen bg-[#070605] flex items-center justify-center font-mono">
            <Loader2 className="animate-spin text-[#d48b38]" size={36} />
          </div>
        }>
          <OnboardingFlow 
            initialUser={session}
            onComplete={(updatedSession) => {
              setSession(updatedSession || { ...session, onboardingCompleted: true });
            }}
            onSignOut={() => {
              setSiteUnlocked(false);
              logoutUser();
              setSession(null);
              setIsUnlocked(false);
            }}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
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
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;

