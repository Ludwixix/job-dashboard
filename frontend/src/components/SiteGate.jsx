import React, { useState } from 'react';
import { 
  Lock, ArrowRight, ShieldCheck, AlertCircle, 
  User, Mail, Key, Loader2, LogIn, UserPlus, Fingerprint, CheckCircle2 
} from 'lucide-react';
import { loginWithEmail, registerWithEmail, validatePasswordStrength } from '../services/authService';
import { loginWithGoogle } from '../services/googleAuthService';
import { loginWithBrowserPasskey } from '../services/passkeyService';

const SITE_PASSCODE = 'Scamper123';
export const STORAGE_KEY_SITE_UNLOCKED = 'career_agent_site_unlocked';

export function isSiteUnlocked() {
  try {
    return localStorage.getItem(STORAGE_KEY_SITE_UNLOCKED) === 'true';
  } catch {
    return false;
  }
}

export function setSiteUnlocked(unlocked = true) {
  try {
    if (unlocked) {
      localStorage.setItem(STORAGE_KEY_SITE_UNLOCKED, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY_SITE_UNLOCKED);
    }
  } catch (e) {
    console.warn('Could not persist site unlock state:', e);
  }
}

export default function SiteGate({ onUnlock = () => {} }) {
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'register' | 'passcode'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const pwdStrength = validatePasswordStrength(password);

  // Email & Password Sign In
  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const sessionUser = await loginWithEmail(cleanEmail, password);
      setSiteUnlocked(true);
      onUnlock(sessionUser);
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  // Create New Account
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setError('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    const strength = validatePasswordStrength(password);
    if (!strength.isComplex) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, number, and special character.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const sessionUser = await registerWithEmail(cleanName, cleanEmail, password);
      setSiteUnlocked(true);
      onUnlock(sessionUser);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Sign in / Sign up with Google (1-Click)
  const handleGoogleAuth = async () => {
    setError('');
    setIsLoading(true);
    setStatusMsg('Connecting with Google Identity Services...');

    try {
      const result = await loginWithGoogle({
        autoScanGmail: false,
        onStatusUpdate: (msg) => setStatusMsg(msg)
      });
      setSiteUnlocked(true);
      onUnlock(result.session || result.user);
    } catch (err) {
      setError(err.message || 'Google authentication was cancelled.');
    } finally {
      setIsLoading(false);
      setStatusMsg('');
    }
  };

  // WebAuthn Passkey / Biometric 1-Click Sign In
  const handlePasskeySignIn = async () => {
    setError('');
    setIsLoading(true);
    setStatusMsg('Requesting device passkey or biometric credential...');

    try {
      const user = await loginWithBrowserPasskey();
      setSiteUnlocked(true);
      onUnlock(user);
    } catch (err) {
      setError(err.message || 'Passkey authentication was cancelled or failed.');
    } finally {
      setIsLoading(false);
      setStatusMsg('');
    }
  };

  // Administrative Passcode Fallback
  const handlePasscodeSubmit = (e) => {
    e.preventDefault();
    setError('');
    const input = passcode.trim();
    if (!input) {
      setError('Please enter the site access passcode.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      if (input === SITE_PASSCODE) {
        setSiteUnlocked(true);
        const sessionUser = {
          id: 'sam_ludwig',
          profileId: 'sam_ludwig',
          name: 'Sam Ludwig',
          email: 'sam.ludwig@gmail.com',
          authProvider: 'passcode',
          onboardingCompleted: true,
          site_unlocked: true,
          lastActiveAt: new Date().toISOString()
        };
        localStorage.setItem('job_dashboard_current_user_session', JSON.stringify(sessionUser));
        onUnlock(sessionUser);
      } else {
        setError('Incorrect passcode. Access denied.');
        setIsLoading(false);
      }
    }, 250);
  };

  return (
    <div className="min-h-screen bg-[#070605] text-[#ede6dc] font-mono selection:bg-[#c67d34] selection:text-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div 
        className="pointer-events-none fixed inset-0 opacity-[0.04] bg-[radial-gradient(#d4a373_1px,transparent_1px)] [background-size:24px_24px]" 
        aria-hidden="true" 
      />
      <div 
        className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-b from-[#c67d34]/[0.08] via-transparent to-transparent blur-3xl"
        aria-hidden="true" 
      />

      <div className="w-full max-w-md relative z-10 space-y-5 animate-in fade-in zoom-in-95 duration-300">
        {/* Top Monolith Brand Apex */}
        <div className="flex flex-col items-center text-center space-y-2.5">
          <div className="w-12 h-12 border border-[#b87326]/70 bg-[#16120e] flex items-center justify-center">
            <span className="text-[#d48b38] font-black text-lg select-none">▲</span>
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-[0.3em] uppercase text-[#ede6dc]">
              CAREER.AGENT // ACCESS PORTAL
            </h1>
            <p className="text-[10px] tracking-[0.2em] text-[#8c8275] uppercase mt-0.5">
              AUTONOMOUS JOB DISCOVERY &amp; APPLICATION DISPATCHER
            </p>
          </div>
        </div>

        {/* Access Terminal Card */}
        <div className="bg-[#12100d] border border-[#2e271f] p-6 sm:p-7 space-y-5 relative rounded-sm">
          {/* Header & Mode Switcher Tabs */}
          {authMode !== 'passcode' && (
            <div className="flex items-center justify-between border-b border-[#262019] pb-3 text-xs">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setAuthMode('signin'); setError(''); }}
                  className={`px-3 py-1.5 text-xs font-bold tracking-wider uppercase transition-colors rounded-sm cursor-pointer ${
                    authMode === 'signin'
                      ? 'bg-[#b87326]/20 text-[#d48b38] border border-[#d48b38]/40'
                      : 'text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <LogIn size={12} /> Sign In
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setError(''); }}
                  className={`px-3 py-1.5 text-xs font-bold tracking-wider uppercase transition-colors rounded-sm cursor-pointer ${
                    authMode === 'register'
                      ? 'bg-[#b87326]/20 text-[#d48b38] border border-[#d48b38]/40'
                      : 'text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <UserPlus size={12} /> Create Account
                  </span>
                </button>
              </div>
              <span className="text-[9px] text-[#706659] tracking-widest uppercase hidden sm:block">
                ENCRYPTED
              </span>
            </div>
          )}

          {authMode === 'passcode' && (
            <div className="flex items-center justify-between border-b border-[#262019] pb-3 text-xs">
              <span className="flex items-center gap-2 text-[#d48b38] font-bold tracking-wider uppercase text-[10px]">
                <Lock size={13} />
                ADMIN PASSCODE BYPASS
              </span>
              <button
                type="button"
                onClick={() => { setAuthMode('signin'); setError(''); }}
                className="text-[10px] text-amber-400 hover:text-amber-200 uppercase cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          )}

          {/* Quick 1-Click Google Login Button */}
          {authMode !== 'passcode' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-[#1a1713] hover:bg-[#25201a] text-slate-200 hover:text-white border border-[#3d3328] hover:border-amber-500/60 rounded-sm font-sans font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{authMode === 'register' ? 'Sign up with Google' : 'Continue with Google'}</span>
              </button>

              {authMode === 'signin' && (
                <button
                  type="button"
                  onClick={handlePasskeySignIn}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-[#14120e] hover:bg-[#1e1913] text-[#d48b38] hover:text-[#f2a144] border border-[#b87326]/40 hover:border-[#d48b38] rounded-sm font-mono font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                  title="Authenticate with Touch ID, Face ID, Windows Hello, or hardware passkey"
                >
                  <Fingerprint size={15} className="text-[#d48b38]" />
                  <span>SIGN IN WITH PASSKEY</span>
                </button>
              )}

              <div className="relative flex items-center justify-center">
                <div className="border-t border-[#262019] w-full" />
                <span className="bg-[#12100d] px-3 text-[10px] text-[#706659] tracking-widest uppercase shrink-0">
                  OR USE EMAIL
                </span>
                <div className="border-t border-[#262019] w-full" />
              </div>
            </div>
          )}

          {/* Sign In Form */}
          {authMode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#a89d8e] tracking-widest uppercase block">
                  EMAIL ADDRESS
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-3.5 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                    placeholder="candidate@example.com"
                    className="w-full bg-[#090807] border border-[#332b22] focus:border-[#d48b38] text-white pl-9 pr-4 py-2.5 text-xs rounded-sm focus:outline-none transition-colors font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#a89d8e] tracking-widest uppercase block">
                  PASSWORD
                </label>
                <div className="relative">
                  <Key size={14} className="absolute left-3 top-3.5 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                    placeholder="••••••••••••"
                    className="w-full bg-[#090807] border border-[#332b22] focus:border-[#d48b38] text-white pl-9 pr-4 py-2.5 text-xs rounded-sm focus:outline-none transition-colors font-mono"
                  />
                </div>
              </div>

              {error && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs tracking-wide flex items-center gap-2 font-mono rounded-sm">
                  <AlertCircle size={13} className="shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {statusMsg && (
                <div className="p-2 bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs flex items-center gap-2 rounded-sm">
                  <Loader2 size={12} className="animate-spin text-amber-400" />
                  <span>{statusMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-6 bg-[#b87326] hover:bg-[#d48b38] disabled:opacity-50 text-black font-black text-xs tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#d48b38] rounded-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>AUTHENTICATING...</span>
                  </>
                ) : (
                  <>
                    <span>SIGN IN TO DASHBOARD</span>
                    <ArrowRight size={13} className="stroke-[3]" />
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setError(''); }}
                  className="text-[11px] text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  Don't have an account? <span className="text-amber-400 font-bold underline underline-offset-4">Create an account</span>
                </button>
              </div>
            </form>
          )}

          {/* Create Account Form */}
          {authMode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#a89d8e] tracking-widest uppercase block">
                  FULL NAME
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-3.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (error) setError(''); }}
                    placeholder="e.g. Alex Morgan"
                    className="w-full bg-[#090807] border border-[#332b22] focus:border-[#d48b38] text-white pl-9 pr-4 py-2.5 text-xs rounded-sm focus:outline-none transition-colors font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#a89d8e] tracking-widest uppercase block">
                  EMAIL ADDRESS
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-3.5 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                    placeholder="candidate@example.com"
                    className="w-full bg-[#090807] border border-[#332b22] focus:border-[#d48b38] text-white pl-9 pr-4 py-2.5 text-xs rounded-sm focus:outline-none transition-colors font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a89d8e] tracking-widest uppercase block">
                    PASSWORD
                  </label>
                  <div className="relative">
                    <Key size={14} className="absolute left-3 top-3.5 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                      placeholder="Min. 8 chars, 1 upper, 1 special"
                      className="w-full bg-[#090807] border border-[#332b22] focus:border-[#d48b38] text-white pl-9 pr-4 py-2.5 text-xs rounded-sm focus:outline-none transition-colors font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a89d8e] tracking-widest uppercase block">
                    CONFIRM
                  </label>
                  <div className="relative">
                    <Key size={14} className="absolute left-3 top-3.5 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(''); }}
                      placeholder="Repeat password"
                      className="w-full bg-[#090807] border border-[#332b22] focus:border-[#d48b38] text-white pl-9 pr-4 py-2.5 text-xs rounded-sm focus:outline-none transition-colors font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Real-time Password Complexity Meter & Checklist */}
              {password.length > 0 && (
                <div className="p-3 bg-[#0d0b09] border border-[#262019] rounded-sm space-y-2.5 text-[11px] font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-[#8c8275]">
                      PASSWORD STRENGTH:
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      pwdStrength.isComplex ? 'text-emerald-400' :
                      pwdStrength.score >= 3 ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {pwdStrength.strengthLabel} ({pwdStrength.score}/5)
                    </span>
                  </div>

                  {/* 5-segment Strength Bar */}
                  <div className="grid grid-cols-5 gap-1.5 h-1">
                    {[1, 2, 3, 4, 5].map((idx) => {
                      let barColor = 'bg-[#262019]';
                      if (idx <= pwdStrength.score) {
                        if (pwdStrength.score === 5) barColor = 'bg-emerald-500';
                        else if (pwdStrength.score >= 3) barColor = 'bg-amber-500';
                        else barColor = 'bg-rose-500';
                      }
                      return (
                        <div key={idx} className={`h-full rounded-sm transition-all duration-300 ${barColor}`} />
                      );
                    })}
                  </div>

                  {/* Requirements Checklist */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[10px]">
                    <div className={`flex items-center gap-1.5 ${pwdStrength.rules.minLength ? 'text-emerald-400 font-bold' : 'text-[#706659]'}`}>
                      <span>{pwdStrength.rules.minLength ? '✓' : '•'}</span>
                      <span>8+ characters</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${pwdStrength.rules.hasUpper ? 'text-emerald-400 font-bold' : 'text-[#706659]'}`}>
                      <span>{pwdStrength.rules.hasUpper ? '✓' : '•'}</span>
                      <span>1 uppercase (A-Z)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${pwdStrength.rules.hasLower ? 'text-emerald-400 font-bold' : 'text-[#706659]'}`}>
                      <span>{pwdStrength.rules.hasLower ? '✓' : '•'}</span>
                      <span>1 lowercase (a-z)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${pwdStrength.rules.hasDigit ? 'text-emerald-400 font-bold' : 'text-[#706659]'}`}>
                      <span>{pwdStrength.rules.hasDigit ? '✓' : '•'}</span>
                      <span>1 number (0-9)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 col-span-1 sm:col-span-2 ${pwdStrength.rules.hasSpecial ? 'text-emerald-400 font-bold' : 'text-[#706659]'}`}>
                      <span>{pwdStrength.rules.hasSpecial ? '✓' : '•'}</span>
                      <span>1 special symbol (!@#$%^&*...)</span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs tracking-wide flex items-center gap-2 font-mono rounded-sm">
                  <AlertCircle size={13} className="shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {statusMsg && (
                <div className="p-2 bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs flex items-center gap-2 rounded-sm">
                  <Loader2 size={12} className="animate-spin text-amber-400" />
                  <span>{statusMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-6 bg-[#b87326] hover:bg-[#d48b38] disabled:opacity-50 text-black font-black text-xs tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#d48b38] rounded-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>CREATING ACCOUNT...</span>
                  </>
                ) : (
                  <>
                    <span>REGISTER &amp; START DISCOVERY</span>
                    <ArrowRight size={13} className="stroke-[3]" />
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => { setAuthMode('signin'); setError(''); }}
                  className="text-[11px] text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  Already have an account? <span className="text-amber-400 font-bold underline underline-offset-4">Sign in</span>
                </button>
              </div>
            </form>
          )}

          {/* Passcode Bypass Form */}
          {authMode === 'passcode' && (
            <form onSubmit={handlePasscodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <label 
                  htmlFor="site-passcode-input"
                  className="text-[11px] font-bold text-[#a89d8e] tracking-widest uppercase block"
                >
                  ENTER ADMIN PASSCODE
                </label>
                <div className="relative">
                  <input
                    id="site-passcode-input"
                    type="password"
                    value={passcode}
                    onChange={(e) => {
                      setPasscode(e.target.value);
                      if (error) setError('');
                    }}
                    autoFocus
                    placeholder="••••••••••••"
                    className="w-full bg-[#090807] border border-[#332b22] focus:border-[#d48b38] text-white px-4 py-3 text-sm tracking-widest rounded-sm focus:outline-none transition-colors font-mono"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs tracking-wider flex items-center gap-2 font-mono rounded-sm">
                  <AlertCircle size={14} className="shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !passcode.trim()}
                className="w-full py-3.5 px-6 bg-[#b87326] hover:bg-[#d48b38] disabled:opacity-50 text-black font-black text-xs tracking-[0.25em] uppercase transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer border border-[#d48b38] rounded-sm"
              >
                <span>{isLoading ? 'AUTHENTICATING...' : 'ACCESS DASHBOARD'}</span>
                <ArrowRight size={14} className="stroke-[3]" />
              </button>
            </form>
          )}

          {/* Footer Strip */}
          <div className="pt-2 border-t border-[#231e19] flex items-center justify-between text-[10px] text-[#706659] tracking-widest uppercase">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-[#b87326]" />
              SESSION PERSISTENT
            </span>
            {authMode !== 'passcode' ? (
              <button
                type="button"
                onClick={() => { setAuthMode('passcode'); setError(''); }}
                className="text-[9px] text-slate-500 hover:text-amber-400 tracking-wider transition-colors cursor-pointer"
              >
                ADMIN PASSCODE
              </button>
            ) : (
              <span>BUILD V2.1</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
