import React, { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { safeLocalStorage } from '../utils/storage';
import { 
  X, 
  Lock, 
  Mail, 
  User as UserIcon, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft, 
  Gift, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Wallet, 
  TrendingUp, 
  Sparkles, 
  ArrowRight
} from 'lucide-react';

interface AuthModalProps {
  mode: 'login' | 'signup';
  onClose: () => void;
  onSuccess: () => void;
  onSwitchMode?: (mode: 'login' | 'signup') => void;
  sessionExpiredNotice?: string;
  hideCloseButton?: boolean;
  isFullScreenPage?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  mode: initialMode,
  onClose,
  onSuccess,
  onSwitchMode,
  sessionExpiredNotice,
  hideCloseButton = false,
  isFullScreenPage = true
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  
  // Credentials Form Fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Password Visibility Toggle
  const [showPassword, setShowPassword] = useState(false);

  // Referral Code
  const [referralCode, setReferralCode] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const paramRef = urlParams.get('ref') || urlParams.get('referral');
      if (paramRef) return paramRef.toUpperCase();
      return safeLocalStorage.getItem('pending_referral_code') || '';
    } catch {
      return '';
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(sessionExpiredNotice || '');
  const [successMsg, setSuccessMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (sessionExpiredNotice) {
      setError(sessionExpiredNotice);
    }
  }, [sessionExpiredNotice]);

  // Password Strength Calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-slate-700' };
    if (pass.length < 6) return { score: 1, label: 'Weak', color: 'bg-rose-500' };
    let score = 1;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) && /[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    
    if (score <= 2) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(password);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your Gmail/email address.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setSuccessMsg(`If an account exists for ${email.trim()}, a password reset link has been sent to your inbox.`);
    } catch (err: any) {
      console.warn('Password reset notice:', err?.code || err);
      const code = err.code || '';
      if (code === 'auth/invalid-email') {
        setError('Please enter a valid Gmail/email address.');
      } else {
        setSuccessMsg(`If an account exists for ${email.trim()}, a password reset link has been sent to your inbox.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (mode === 'forgot') {
      return handlePasswordReset(e);
    }

    setError('');
    setSuccessMsg('');

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (mode === 'login') {
      if (!cleanEmail || !password) {
        setError('Please enter your Gmail/email address and password to log in.');
        return;
      }
    } else {
      if (!cleanUsername || !cleanEmail || !password) {
        setError('Please fill in all required fields: Username, Gmail/email address, and Password.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
    }

    setLoading(true);
    safeLocalStorage.setItem('zenet_last_seen_timestamp', Date.now().toString());

    try {
      if (mode === 'signup') {
        // Save referral code if provided
        if (referralCode.trim()) {
          safeLocalStorage.setItem('pending_referral_code', referralCode.trim().toUpperCase());
        }

        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const user = userCredential.user;

        // Update Auth Profile display name
        await updateProfile(user, {
          displayName: cleanUsername
        }).catch(() => {});

        // Write User Profile to Firestore
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          uid: user.uid,
          email: cleanEmail,
          username: cleanUsername,
          displayName: cleanUsername,
          password: password,
          createdAt: new Date().toISOString(),
          status: 'active',
          role: cleanEmail === 'azeezmusharaf4@gmail.com' ? 'owner' : 'buyer',
          walletBalance: 0
        }, { merge: true }).catch(() => {});

      } else {
        // Login Flow: Email & Password ONLY
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const user = userCredential.user;

        // Keep lastLoginAt updated without blocking or failing
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          uid: user.uid,
          email: cleanEmail,
          lastLoginAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      }

      setStatusMsg('Login successful! Entering marketplace...');
      onSuccess();
    } catch (err: any) {
      console.warn('Auth notice:', err?.code || err);
      let msg = err.message || 'Authentication failed.';
      const code = err.code || '';

      if (code === 'auth/operation-not-allowed') {
        msg = 'Email/Password Authentication is currently unavailable. Please contact support.';
      } else if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        msg = mode === 'login' 
          ? 'Incorrect email or password. Please verify your credentials and try again.'
          : 'Invalid credentials provided. Please check your email and password.';
      } else if (code === 'auth/email-already-in-use') {
        msg = 'An account with this Gmail/email address already exists. Please switch to "Log in" to access your account.';
      } else if (code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Please enter a valid Gmail/email address.';
      } else if (code === 'auth/too-many-requests') {
        msg = 'Too many failed login attempts. Please wait a moment or reset your password.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const displayNameFallback = (name: string, mail: string) => {
    if (name.trim()) return name.trim();
    if (mail.includes('@')) return mail.split('@')[0];
    return 'User';
  };

  return (
    <div className={`fixed inset-0 z-50 flex ${
      isFullScreenPage 
        ? 'flex-col items-stretch justify-start p-0 m-0 bg-white' 
        : 'items-center justify-center p-0 sm:p-4 md:p-6 bg-white sm:bg-black/60'
    } overflow-y-auto overflow-x-hidden w-full max-w-full min-h-screen min-h-[100dvh] overscroll-contain`}>
      
      {/* Outer Container Card - 2 Column on Desktop */}
      <div 
        className={`bg-white ${
          isFullScreenPage 
            ? 'border-0 rounded-none w-full max-w-full m-0 min-h-screen min-h-[100dvh] shadow-none' 
            : 'border-0 sm:border sm:border-[#E9E2FA] rounded-none sm:rounded-3xl w-full sm:max-w-5xl m-0 sm:my-auto sm:max-h-[90vh] shadow-none sm:shadow-2xl min-h-screen sm:min-h-0'
        } overflow-x-hidden relative flex flex-col md:flex-row text-[#171329] flex-1`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Close Modal Button */}
        {!hideCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 z-20 p-2 text-[#716B82] hover:text-[#171329] bg-[#F8F7FF] hover:bg-[#EDE9FE] border border-[#E9E2FA] rounded-full transition cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}

        {/* LEFT COLUMN: Brand Experience & Features (Desktop/Tablet) */}
        <div className="hidden md:flex md:w-5/12 bg-[#F8F7FF] p-8 lg:p-10 flex-col justify-between relative overflow-y-auto border-r border-[#E9E2FA] min-h-0">
          
          {/* Top Section */}
          <div className="relative z-10 space-y-6">
            
            {/* Secure Pill Tag */}
            <div className="inline-flex items-center gap-2 bg-[#EDE9FE] border border-[#C4B5FD] text-[#5B21B6] text-xs font-bold px-3.5 py-1.5 rounded-full shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#7C3AED] shrink-0"></span>
              <span>Create your secure account</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-3">
              <h1 className="text-3xl lg:text-4xl font-black text-[#171329] tracking-tight leading-tight">
                Start your <br />
                <span className="text-[#7C3AED]">
                  digital service
                </span> journey.
              </h1>
              <p className="text-xs lg:text-sm text-[#716B82] leading-relaxed">
                Create your ZENET HUB account to access your dashboard, escrow wallet, order history, verified listings, and 24/7 support.
              </p>
            </div>

            {/* 4 Feature Cards (2x2 Grid) */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              
              {/* Feature 1 */}
              <div className="bg-white border border-[#E9E2FA] p-3.5 rounded-2xl space-y-1.5 shadow-sm hover:border-[#C4B5FD] transition duration-200">
                <div className="w-8 h-8 rounded-xl bg-[#EDE9FE] border border-[#E9E2FA] flex items-center justify-center text-[#7C3AED] shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="font-extrabold text-[#171329] text-xs">Fast setup</h4>
                <p className="text-[11px] text-[#716B82] leading-snug">
                  Create your account & enter your dashboard in seconds.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white border border-[#E9E2FA] p-3.5 rounded-2xl space-y-1.5 shadow-sm hover:border-[#C4B5FD] transition duration-200">
                <div className="w-8 h-8 rounded-xl bg-[#EDE9FE] border border-[#E9E2FA] flex items-center justify-center text-[#7C3AED] shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="font-extrabold text-[#171329] text-xs">Secure access</h4>
                <p className="text-[11px] text-[#716B82] leading-snug">
                  Protected with encrypted escrow safeguards.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white border border-[#E9E2FA] p-3.5 rounded-2xl space-y-1.5 shadow-sm hover:border-[#C4B5FD] transition duration-200">
                <div className="w-8 h-8 rounded-xl bg-[#EDE9FE] border border-[#E9E2FA] flex items-center justify-center text-[#7C3AED] shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <h4 className="font-extrabold text-[#171329] text-xs">Wallet ready</h4>
                <p className="text-[11px] text-[#716B82] leading-snug">
                  Fund your dedicated wallet for instant checkouts.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-white border border-[#E9E2FA] p-3.5 rounded-2xl space-y-1.5 shadow-sm hover:border-[#C4B5FD] transition duration-200">
                <div className="w-8 h-8 rounded-xl bg-[#EDE9FE] border border-[#E9E2FA] flex items-center justify-center text-[#7C3AED] shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h4 className="font-extrabold text-[#171329] text-xs">Referral ready</h4>
                <p className="text-[11px] text-[#716B82] leading-snug">
                  Earn bonuses when inviting friends with your code.
                </p>
              </div>

            </div>

          </div>

          {/* Bottom Branding Tag */}
          <div className="relative z-10 pt-6 border-t border-[#E9E2FA] flex items-center justify-between text-xs text-[#716B82] font-semibold">
            <span>ZENET HUB Marketplace</span>
            <span>Verified & Safe</span>
          </div>

        </div>

        {/* RIGHT COLUMN: Registration Form & Auth Card */}
        <div className="w-full md:w-7/12 pt-7 sm:pt-9 md:pt-10 pb-6 px-4 sm:px-7 lg:px-9 flex flex-col justify-between overflow-y-auto flex-1 min-h-0 bg-white">
          {statusMsg ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 sm:p-6 space-y-5 my-auto animate-in fade-in zoom-in duration-300">
              <div className="w-14 h-14 rounded-full bg-[#EDE9FE] border border-[#C4B5FD] flex items-center justify-center relative shrink-0">
                <span className="absolute inset-0 rounded-full border-2 border-[#C4B5FD] border-t-[#7C3AED] animate-spin"></span>
                <CheckCircle2 className="w-7 h-7 text-[#7C3AED] animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-[#171329]">Login Successful</h3>
                <p className="text-xs sm:text-sm text-[#716B82] leading-relaxed max-w-sm">
                  {statusMsg}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5 sm:space-y-4">
            
            {/* Top Tag & Title */}
            <div className="mb-2 sm:mb-3">
              <span className="text-[10px] font-bold tracking-widest text-[#7C3AED] uppercase block mb-1">
                {mode === 'forgot' ? 'ACCOUNT RECOVERY' : mode === 'login' ? 'LOGIN' : 'REGISTER ACCOUNT'}
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#171329] tracking-tight">
                {mode === 'forgot' ? 'Reset Password' : mode === 'login' ? 'Log in to Account' : 'Register Account'}
              </h2>
              <p className="text-xs text-[#716B82] mt-0.5 leading-normal">
                {mode === 'forgot' 
                  ? 'Enter your account Gmail/email address to receive a password reset link.' 
                  : mode === 'login' 
                  ? 'Enter your Gmail/email address and password to log in.' 
                  : 'Enter your username, Gmail/email address, and password to register your account.'}
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 sm:p-3 rounded-xl flex flex-col gap-1.5 text-xs animate-in fade-in">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
                {mode === 'login' && (error.includes('register') || error.includes('Invalid username') || error.includes('invalid-credential')) && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setError('');
                    }}
                    className="self-start mt-0.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-[11px] px-2.5 py-1 rounded-lg border border-rose-300 transition cursor-pointer flex items-center gap-1"
                  >
                    <span>Register account now →</span>
                  </button>
                )}
              </div>
            )}

            {/* Success Message Banner */}
            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-2.5 sm:p-3 rounded-xl flex items-start gap-2 text-xs animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <span className="leading-relaxed">{successMsg}</span>
              </div>
            )}

            {/* FORM */}
            <form onSubmit={handleSubmit} className="space-y-3 text-xs sm:text-sm">
              
              {/* FORGOT PASSWORD FORM ONLY */}
              {mode === 'forgot' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[#171329] font-bold mb-1 text-xs">Gmail / Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716B82] shrink-0" />
                      <input
                        type="email"
                        placeholder="name@gmail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full bg-[#F8F7FF] text-[#171329] placeholder-[#716B82]/50 pl-9 pr-3 py-2.5 rounded-xl border border-[#E9E2FA] focus:outline-none focus:border-[#7C3AED] focus:bg-white transition text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold py-2.5 sm:py-3 rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 min-h-[42px] text-sm"
                  >
                    {loading ? 'Sending...' : 'Send Reset Link →'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                    className="w-full text-center text-xs text-[#716B82] hover:text-[#171329] font-bold transition flex items-center justify-center gap-1.5 pt-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Log In</span>
                  </button>
                </div>
              )}

              {/* REGISTRATION FLOW */}
              {mode === 'signup' && (
                <>
                  <div className="space-y-2.5">
                    {/* Username Field (Registration only) */}
                    <div>
                      <label className="block text-[#171329] font-bold mb-1 text-xs">Username</label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716B82] shrink-0" />
                        <input
                          type="text"
                          placeholder="Choose a username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                          className="w-full bg-[#F8F7FF] text-[#171329] placeholder-[#716B82]/50 pl-9 pr-3 py-2.5 sm:py-2 rounded-xl border border-[#E9E2FA] focus:outline-none focus:border-[#7C3AED] focus:bg-white transition text-sm sm:text-xs"
                        />
                      </div>
                    </div>

                    {/* Gmail / Email Address Field */}
                    <div>
                      <label className="block text-[#171329] font-bold mb-1 text-xs">Gmail / Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716B82] shrink-0" />
                        <input
                          type="email"
                          placeholder="name@gmail.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="w-full bg-[#F8F7FF] text-[#171329] placeholder-[#716B82]/50 pl-9 pr-3 py-2.5 sm:py-2 rounded-xl border border-[#E9E2FA] focus:outline-none focus:border-[#7C3AED] focus:bg-white transition text-sm sm:text-xs"
                        />
                      </div>
                    </div>

                    {/* Password Field */}
                    <div>
                      <label className="block text-[#171329] font-bold mb-1 text-xs">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716B82] shrink-0" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          className="w-full bg-[#F8F7FF] text-[#171329] placeholder-[#716B82]/50 pl-9 pr-9 py-2.5 sm:py-2 rounded-xl border border-[#E9E2FA] focus:outline-none focus:border-[#7C3AED] focus:bg-white transition text-sm sm:text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#716B82] hover:text-[#171329] p-1"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password Strength Bar */}
                  {password && (
                    <div className="space-y-1 pt-0.5">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-[#716B82]">
                        <span>Password Strength</span>
                        <span className="font-extrabold text-[#171329]">{strength.label}</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#EDE9FE] rounded-full overflow-hidden flex gap-1">
                        <div className={`h-full flex-1 rounded-full ${strength.score >= 1 ? strength.color : 'bg-slate-200'}`}></div>
                        <div className={`h-full flex-1 rounded-full ${strength.score >= 2 ? strength.color : 'bg-slate-200'}`}></div>
                        <div className={`h-full flex-1 rounded-full ${strength.score >= 3 ? strength.color : 'bg-slate-200'}`}></div>
                      </div>
                      <p className="text-[10px] text-[#716B82]">
                        Use at least 6 characters for your password.
                      </p>
                    </div>
                  )}

                  {/* Referral Code (Optional) */}
                  {referralCode && (
                    <div className="pt-0.5">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[#171329] font-bold flex items-center gap-1 text-xs">
                          <Gift className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Referral Code</span>
                        </label>
                        <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Applied</span>
                      </div>
                      <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        className="w-full bg-[#F8F7FF] text-[#7C3AED] font-mono font-bold text-xs tracking-wider px-3 py-2 rounded-xl border border-[#E9E2FA]"
                      />
                    </div>
                  )}

                  {/* Terms Notice */}
                  <div className="bg-[#F8F7FF] border border-[#E9E2FA] p-2.5 rounded-xl flex items-start gap-2 text-[11px] text-[#716B82] leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] shrink-0 mt-1.5 shadow-sm"></span>
                    <span>
                      Your credentials belong exclusively to your account. Keep your login details confidential.
                    </span>
                  </div>

                  {/* Register account Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold py-2.5 sm:py-3 rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-sm mt-2 active:scale-[0.99] min-h-[42px]"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Registering account...</span>
                      </>
                    ) : (
                      <>
                        <span>Register account</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Toggle to Login */}
                  <div className="pt-2 text-center border-t border-[#E9E2FA]">
                    <span className="text-xs text-[#716B82] block mb-1.5 font-semibold">Already have an account?</span>
                    <button
                      type="button"
                      onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                      className="w-full bg-[#F8F7FF] hover:bg-[#EDE9FE] text-[#716B82] hover:text-[#171329] font-semibold py-2 px-3 rounded-xl border border-[#E9E2FA] transition cursor-pointer text-xs min-h-[38px]"
                    >
                      Already have an account? <span className="text-[#7C3AED] font-bold ml-1">Log in</span>
                    </button>
                  </div>
                </>
              )}

              {/* LOGIN FLOW - EMAIL & PASSWORD ONLY (NO USERNAME) */}
              {mode === 'login' && (
                <>
                  <div className="space-y-2.5">
                    {/* Gmail / Email Address Field */}
                    <div>
                      <label className="block text-[#171329] font-bold mb-1 text-xs">Gmail / Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716B82] shrink-0" />
                        <input
                          type="email"
                          placeholder="name@gmail.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="w-full bg-[#F8F7FF] text-[#171329] placeholder-[#716B82]/50 pl-9 pr-3 py-2.5 sm:py-2 rounded-xl border border-[#E9E2FA] focus:outline-none focus:border-[#7C3AED] focus:bg-white transition text-sm sm:text-xs"
                        />
                      </div>
                    </div>

                    {/* Password Field */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[#171329] font-bold text-xs">Password</label>
                        <button
                          type="button"
                          onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); }}
                          className="text-xs font-semibold text-[#7C3AED] hover:text-[#5B21B6] transition cursor-pointer py-0.5"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716B82] shrink-0" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="w-full bg-[#F8F7FF] text-[#171329] placeholder-[#716B82]/50 pl-9 pr-9 py-2.5 sm:py-2 rounded-xl border border-[#E9E2FA] focus:outline-none focus:border-[#7C3AED] focus:bg-white transition text-sm sm:text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#716B82] hover:text-[#171329] p-1"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Submit Log In Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold py-2.5 sm:py-3 rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-sm mt-3 active:scale-[0.99] min-h-[42px]"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Logging in...</span>
                      </>
                    ) : (
                      <>
                        <span>Log in</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Switch to Registration */}
                  <div className="pt-2 text-center border-t border-[#E9E2FA]">
                    <span className="text-xs text-[#716B82] block mb-1.5 font-semibold">Don't have an account yet?</span>
                    <button
                      type="button"
                      onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }}
                      className="w-full bg-[#F8F7FF] hover:bg-[#EDE9FE] text-[#716B82] hover:text-[#171329] font-semibold py-2 px-3 rounded-xl border border-[#E9E2FA] transition cursor-pointer text-xs min-h-[38px]"
                    >
                      Don't have an account yet? <span className="text-[#7C3AED] font-bold ml-1">Register account</span>
                    </button>
                  </div>
                </>
              )}

            </form>

          </div>
          )}

          {/* Copyright Footer */}
          <div className="pt-4 text-center text-[10px] text-[#716B82] font-semibold border-t border-[#E9E2FA] mt-4">
            © {new Date().getFullYear()} ZENET HUB Marketplace. All rights reserved.
          </div>

        </div>

      </div>
    </div>
  );
};
