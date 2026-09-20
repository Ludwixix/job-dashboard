import React from 'react';
import {
  ShieldCheck, RefreshCw, ArrowRight, ChevronRight, Mail, Lock, User,
  Eye, EyeOff, AlertCircle, Key, CheckCircle2
} from 'lucide-react';
import { DEFAULT_PROFILES } from '../../services/profileService';

export function StepAuthEmail({
  profileData,
  currentUser,
  initialUser,
  authEmail,
  handleVerifyEmail,
  verificationCode,
  setVerificationCode,
  isVerifying,
  verifyError,
  verifySuccess,
    resendStatus,
  handleResendCode,
  resendCountdown,
  setIsVerifyingEmail,
  setStep,
  onSignOut
}) {
  return (

    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-400/30">
          <ShieldCheck size={14} /> STEP 1 OF 6 // EMAIL VERIFICATION
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">
          Verify Your Email Address
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto">
          We've sent a 6-digit verification code to <span className="text-amber-400 font-bold">{profileData.email || currentUser?.email || authEmail}</span>. Enter it below to activate your candidate profile.
        </p>
      </div>

      <form onSubmit={handleVerifyEmail} className="space-y-5 max-w-md mx-auto font-mono text-xs">
        {/* Development preview banner */}
        {(currentUser?.verificationCodePreview || initialUser?.verificationCodePreview) && (
          <div className="p-3 rounded-sm bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/80 text-amber-300 font-bold">DEV CODE</span>
              <span className="font-mono font-black tracking-widest text-amber-300">
                {currentUser?.verificationCodePreview || initialUser?.verificationCodePreview}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setVerificationCode(currentUser?.verificationCodePreview || initialUser?.verificationCodePreview)}
              className="text-[10px] text-amber-400 hover:text-amber-300 underline font-bold cursor-pointer"
            >
              Auto-fill
            </button>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-300 tracking-widest uppercase block text-center">
            6-DIGIT VERIFICATION CODE
          </label>
          <input
            type="text"
            maxLength={6}
            autoFocus
            value={verificationCode}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setVerificationCode(val);
              if (verifyError) setVerifyError('');
            }}
            placeholder="000000"
            className="w-full text-center text-2xl font-black tracking-[0.5em] p-3.5 rounded-sm bg-slate-950 border border-slate-700 focus:border-amber-500 text-amber-400 focus:outline-none placeholder-slate-700 transition-colors"
          />
        </div>

        {verifyError && (
          <div className="p-3 rounded-sm bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-400 shrink-0" />
            <span>{verifyError}</span>
          </div>
        )}

        {verifySuccess && (
          <div className="p-3 rounded-sm bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <span>✓ Email verified! Preparing your setup wizard...</span>
          </div>
        )}

        {resendStatus && (
          <div className="p-2 rounded-sm bg-slate-800/80 text-slate-300 text-[11px] text-center">
            {resendStatus}
          </div>
        )}

        <button
          type="submit"
          disabled={isVerifying || verificationCode.length < 6 || verifySuccess}
          className="w-full py-3.5 px-4 rounded-sm bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black text-sm tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          {isVerifying ? (
            <>
              <RefreshCw size={15} className="animate-spin text-amber-200" />
              <span>VERIFYING CODE...</span>
            </>
          ) : (
            <>
              <span>CONFIRM &amp; PROCEED TO SETUP</span>
              <ArrowRight size={15} />
            </>
          )}
        </button>

        <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400">
          <button
            type="button"
            onClick={handleResendCode}
            disabled={resendCountdown > 0 || isVerifying}
            className="text-amber-400 hover:text-amber-300 disabled:text-slate-600 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : "Didn't receive code? Resend"}
          </button>

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          )}
        </div>

        <div className="pt-3 border-t border-slate-800/80 text-center">
          <button
            type="button"
            onClick={() => {
              setIsVerifyingEmail(false);
              setStep(2);
            }}
            className="text-xs text-slate-400 hover:text-amber-300 transition-colors underline cursor-pointer inline-flex items-center gap-1"
          >
            <span>Verify later &amp; continue profile setup</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </form>
    </div>
  );
}

export function StepAuthIdentity({
  authMode,
  setAuthMode,
  authName,
  setAuthName,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  showPassword,
  setShowPassword,
  signupPwdStrength,
  authError,
  setShowGooglePrompt,
  authLoading,
  handleAuthSubmit,
  handlePasskeyAuth,
  isPasskeySupported,
  handleSelectDemoPersona
}) {
  return (

  <div className="space-y-6">
  <div className="text-center space-y-2">
  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-400/30">
  <ShieldCheck size={14} /> STEP 1 OF 6 // YOUR CANDIDATE IDENTITY
  </div>
  <h1 className="text-2xl sm:text-3xl font-black text-white">
  Welcome to Your Bespoke Job Agent
  </h1>
  <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto">
  Let's configure your autonomous job discovery engine so every job match, commute calculation, and generated cover letter fits your exact profile.
  </p>
  </div>

  {/* Email / Password Form */}
  <form onSubmit={handleAuthSubmit} className="space-y-4 max-w-md mx-auto font-mono text-xs">
  {authMode === 'signup' && (
  <div className="space-y-1.5">
  <label className="text-slate-300 font-bold flex items-center gap-1.5">
  <User size={13} className="text-amber-400" /> FULL NAME
  </label>
  <input
  type="text"
  required
  value={authName}
  onChange={(e) => setAuthName(e.target.value)}
  placeholder="e.g. Sam Ludwig"
  className="w-full p-3 rounded-sm bg-slate-950 border border-slate-800 text-white focus:border-amber-500 focus:outline-none placeholder-slate-600 font-sans text-sm"
  />
  </div>
  )}

  <div className="space-y-1.5">
  <label className="text-slate-300 font-bold flex items-center gap-1.5">
  <Mail size={13} className="text-amber-400" /> EMAIL ADDRESS
  </label>
  <input
  type="email"
  required
  value={authEmail}
  onChange={(e) => setAuthEmail(e.target.value)}
  placeholder="your.name@example.com"
  className="w-full p-3 rounded-sm bg-slate-950 border border-slate-800 text-white focus:border-amber-500 focus:outline-none placeholder-slate-600 font-sans text-sm"
  />
  </div>

  <div className="space-y-1.5">
  <div className="flex items-center justify-between">
  <label className="text-slate-300 font-bold flex items-center gap-1.5">
  <Lock size={13} className="text-amber-400" /> PASSWORD
  </label>
  {authMode === 'signup' && signupPwdStrength && (
  <span className={`text-[10px] font-bold ${
  signupPwdStrength.level === 'strong' ? 'text-emerald-400' :
  signupPwdStrength.level === 'medium' ? 'text-amber-400' : 'text-rose-400'
  }`}>
  {signupPwdStrength.level.toUpperCase()}
  </span>
  )}
  </div>
  <div className="relative">
  <input
  type={showApiKey ? 'text' : 'password'}
  required
  value={authPassword}
  onChange={(e) => setAuthPassword(e.target.value)}
  placeholder="••••••••••••"
  className="w-full p-3 pr-10 rounded-sm bg-slate-950 border border-slate-800 text-white focus:border-amber-500 focus:outline-none placeholder-slate-600 font-sans text-sm"
  />
  <button
  type="button"
  onClick={() => setShowApiKey(!showApiKey)}
  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
  >
  {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
  </button>
  </div>
  </div>

  {/* Real-time Password Complexity Meter & Checklist for Signup */}
  {authMode === 'signup' && authPassword.length > 0 && (
    <div className="p-3 bg-slate-950 border border-slate-800 rounded-sm space-y-2.5 text-[11px] font-mono">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-slate-400">
          PASSWORD STRENGTH:
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${
          signupPwdStrength.isComplex ? 'text-emerald-400' :
          signupPwdStrength.score >= 3 ? 'text-amber-400' : 'text-rose-400'
        }`}>
          {signupPwdStrength.strengthLabel} ({signupPwdStrength.score}/5)
        </span>
      </div>

      {/* 5-segment Strength Bar */}
      <div className="grid grid-cols-5 gap-1.5 h-1">
        {[1, 2, 3, 4, 5].map((idx) => {
          let barColor = 'bg-slate-800';
          if (idx <= signupPwdStrength.score) {
            if (signupPwdStrength.score === 5) barColor = 'bg-emerald-500';
            else if (signupPwdStrength.score >= 3) barColor = 'bg-amber-500';
            else barColor = 'bg-rose-500';
          }
          return (
            <div key={idx} className={`h-full rounded-sm transition-all duration-300 ${barColor}`} />
          );
        })}
      </div>

      {/* Requirements Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[10px]">
        <div className={`flex items-center gap-1.5 ${signupPwdStrength.rules.minLength ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
          <span>{signupPwdStrength.rules.minLength ? '✓' : '•'}</span>
          <span>8+ characters</span>
        </div>
        <div className={`flex items-center gap-1.5 ${signupPwdStrength.rules.hasUpper ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
          <span>{signupPwdStrength.rules.hasUpper ? '✓' : '•'}</span>
          <span>1 uppercase (A-Z)</span>
        </div>
        <div className={`flex items-center gap-1.5 ${signupPwdStrength.rules.hasLower ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
          <span>{signupPwdStrength.rules.hasLower ? '✓' : '•'}</span>
          <span>1 lowercase (a-z)</span>
        </div>
        <div className={`flex items-center gap-1.5 ${signupPwdStrength.rules.hasDigit ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
          <span>{signupPwdStrength.rules.hasDigit ? '✓' : '•'}</span>
          <span>1 number (0-9)</span>
        </div>
        <div className={`flex items-center gap-1.5 col-span-1 sm:col-span-2 ${signupPwdStrength.rules.hasSpecial ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
          <span>{signupPwdStrength.rules.hasSpecial ? '✓' : '•'}</span>
          <span>1 special symbol (!@#$%^&*...)</span>
        </div>
      </div>
    </div>
  )}

 {authError && (
 <div className="p-3 rounded-sm bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
 <AlertCircle size={15} className="text-rose-400 shrink-0" />
 <span>{authError}</span>
 </div>
 )}

 {/* Quick 1-Click Google Login Button */}
  <button
  type="button"
  onClick={handleGoogleLogin}
  disabled={authLoading}
  className="w-full py-3 px-4 rounded-sm bg-slate-950 hover:bg-slate-800 border border-slate-700 text-white font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
  >
  <svg className="w-4 h-4" viewBox="0 0 24 24">
  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
  <span>CONTINUE WITH GOOGLE</span>
  </button>

 <div className="flex items-center gap-3 my-2">
 <div className="flex-1 h-px bg-slate-800" />
 <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">OR EMAIL & PASSKEY</span>
 <div className="flex-1 h-px bg-slate-800" />
 </div>

 <button
 type="submit"
 disabled={authLoading}
 className="w-full py-3.5 px-4 rounded-sm bg-amber-600 hover:bg-amber-500 text-white font-black text-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
 >
 {authLoading ? <RefreshCw size={16} className="animate-spin text-amber-200" /> : <ArrowRight size={16} />}
 <span>{authMode === 'signup' ? 'CREATE ACCOUNT & START SETUP' : 'SIGN IN & CONTINUE'}</span>
 </button>

 {/* Passkey / Stored Browser Creds Button */}
 <button
 type="button"
 onClick={handlePasskeyLogin}
 disabled={authLoading}
 className="w-full py-3 px-4 rounded-sm bg-slate-950 hover:bg-slate-800 border border-emerald-500/50 text-emerald-300 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
 title="Authenticate using stored browser password manager, Touch ID, Face ID, Windows Hello, or Passkey"
 >
 <Key size={14} className="text-emerald-400" />
 <span>🔑 SIGN IN WITH PASSKEY / BROWSER CREDS</span>
 </button>

 <div className="text-center pt-1 text-slate-400 text-xs">
 {authMode === 'login' ? (
 <span>
 Don't have an account?{' '}
 <button type="button" onClick={() => setAuthMode('signup')} className="text-amber-400 hover:underline font-bold cursor-pointer">
 Sign Up Free
 </button>
 </span>
 ) : (
 <span>
 Already have an account?{' '}
 <button type="button" onClick={() => setAuthMode('login')} className="text-amber-400 hover:underline font-bold cursor-pointer">
 Sign In
 </button>
 </span>
 )}
 </div>
 </form>

 {/* 1-Click Sam Ludwig Profile Quick-Launch */}
 <div className="pt-6 border-t border-slate-800 space-y-3 font-mono">
 <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
 ⚡ OR QUICK-LAUNCH WITH SAM LUDWIG PROFILE:
 </div>
 <div className="flex justify-center">
 {DEFAULT_PROFILES.map(preset => (
 <button
 key={preset.id}
 onClick={() => handleSelectDemoPersona(preset.id)}
 className="w-full sm:max-w-md p-3.5 rounded-sm bg-slate-950 hover:bg-slate-800 border border-amber-500/40 hover:border-amber-400 transition-all text-left flex items-center gap-3 cursor-pointer group "
 >
 <div className="w-10 h-10 rounded-sm bg-amber-600/30 text-amber-300 font-black text-sm flex items-center justify-center shrink-0 border border-amber-400/50 group-hover:bg-amber-600 group-hover:text-white transition-colors">
 SL
 </div>
  <div className="flex-1 min-w-0">
  <div className="font-bold text-white text-xs group-hover:text-amber-300 transition-colors flex items-center gap-1.5">
  <span>{preset.name}</span>
  <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-300 border border-amber-500/30">DEMO</span>
  </div>
  <div className="text-[11px] text-slate-400 truncate">{preset.title}</div>
  </div>
 <ArrowRight size={16} className="text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
 </button>
 ))}
 </div>
 </div>
 </div>
  );
}

export function StepAuth(props) {
  if (props.isVerifyingEmail) {
    return <StepAuthEmail {...props} />;
  }
  return <StepAuthIdentity {...props} />;
}
