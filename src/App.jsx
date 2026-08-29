import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { OnboardingFlow } from './components/OnboardingFlow';
import { getCurrentSession } from './services/authService';

function App() {
  const [session, setSession] = useState(() => getCurrentSession());

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
