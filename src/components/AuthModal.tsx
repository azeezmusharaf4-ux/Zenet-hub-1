import React, { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { isAuthorizedOwnerEmail } from '../lib/authorizedOwners';
import { safeLocalStorage } from '../utils/storage';
import { 
  X, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft
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

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Password Visibility Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  useEffect(() => {
    if (sessionExpiredNotice) {
      setError(sessionExpiredNotice);
    }
  }, [sessionExpiredNotice]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setSuccessMsg(`If an account exists for ${cleanEmail}, a password reset link has been sent to your email inbox.`);
    } catch (err: any) {
      console.warn('Password reset notice:', err?.code || err);
      const code = err.code || '';
      if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setSuccessMsg(`If an account exists for ${cleanEmail}, a password reset link has been sent to your email inbox.`);
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

    const cleanEmail = email.trim().toLowerCase();

    if (mode === 'login') {
      if (!cleanEmail || !password) {
        setError('Please enter your email and password to log in.');
        return;
      }
    } else {
      // Registration validation
      const cleanFullName = fullName.trim();
      const cleanPhone = phone.trim();

      if (!cleanFullName) {
        setError('Please enter your full name.');
        return;
      }
      if (!cleanPhone) {
        setError('Please enter your phone number.');
        return;
      }
      if (!cleanEmail) {
        setError('Please enter your email address.');
        return;
      }
      if (!password) {
        setError('Please create a password.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify your confirm password.');
        return;
      }
      if (!agreeTerms) {
        setError('Please agree to the Terms & conditions and Privacy Policy to register.');
        return;
      }
    }

    setLoading(true);
    safeLocalStorage.setItem('zenet_last_seen_timestamp', Date.now().toString());

    try {
      if (mode === 'signup') {
        const cleanFullName = fullName.trim();
        const cleanPhone = phone.trim();

        if (referralCode.trim()) {
          safeLocalStorage.setItem('pending_referral_code', referralCode.trim().toUpperCase());
        }

        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const user = userCredential.user;

        await updateProfile(user, {
          displayName: cleanFullName
        }).catch(() => {});

        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          uid: user.uid,
          email: cleanEmail,
          displayName: cleanFullName,
          fullName: cleanFullName,
          username: cleanFullName,
          phone: cleanPhone,
          phoneNumber: cleanPhone,
          password: password,
          createdAt: new Date().toISOString(),
          status: 'active',
          role: isAuthorizedOwnerEmail(cleanEmail) ? 'owner' : 'buyer',
          walletBalance: 0
        }, { merge: true }).catch(() => {});

      } else {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const user = userCredential.user;

        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          uid: user.uid,
          email: cleanEmail,
          lastLoginAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      }

      onSuccess();
    } catch (err: any) {
      console.warn('Auth error:', err?.code || err);
      let msg = err.message || 'Authentication failed.';
      const code = err.code || '';

      if (code === 'auth/operation-not-allowed') {
        msg = 'Email/Password Authentication is currently unavailable. Please contact support.';
      } else if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        msg = mode === 'login' 
          ? 'Incorrect email or password. Please verify your credentials and try again.'
          : 'Invalid credentials provided. Please check your email and password.';
      } else if (code === 'auth/email-already-in-use') {
        msg = 'An account with this email address already exists. Please switch to Login.';
      } else if (code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (code === 'auth/too-many-requests') {
        msg = 'Too many failed attempts. Please wait a moment or reset your password.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex ${
      isFullScreenPage 
        ? 'flex-col items-center justify-start bg-white' 
        : 'items-center justify-center p-4 bg-black/40 backdrop-blur-xs'
    } overflow-y-auto overflow-x-hidden w-full min-h-screen min-h-[100dvh]`}>
      
      {/* Centered Main Container */}
      <div 
        className={`w-full max-w-[420px] sm:max-w-[440px] mx-auto bg-white px-6 sm:px-8 py-8 sm:py-10 relative flex flex-col justify-center ${
          !isFullScreenPage ? 'rounded-2xl shadow-xl border border-slate-100' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Close Button when displayed as a modal */}
        {!hideCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Top Brand Logo: ZENET HUB */}
        <div className="flex items-center gap-2.5 mb-7 sm:mb-8">
          <div className="w-10 h-10 rounded-xl border-2 border-[#5c5cf6] bg-[#5c5cf6]/5 flex items-center justify-center text-[#5c5cf6] shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="4" />
              <path d="M7 10h10" />
              <path d="M7 14h5" />
              <circle cx="16.5" cy="14" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <div className="flex items-center">
            <span className="text-2xl font-black tracking-tight text-[#5c5cf6] uppercase">
              ZENET<span className="font-extrabold ml-1 tracking-wider text-[#5c5cf6]">HUB</span>
            </span>
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="mb-7 sm:mb-8">
          {mode === 'login' && (
            <>
              <h1 className="text-[32px] sm:text-[36px] font-black text-slate-900 tracking-tight leading-[1.15]">
                Welcome Back <br />
                <span className="text-slate-900">to </span>
                <span className="text-[#5c5cf6]">Zenet Hub</span>
              </h1>
              <p className="text-slate-500 text-sm sm:text-[15px] mt-2.5 font-normal">
                Hello there, login to continue!
              </p>
            </>
          )}

          {mode === 'signup' && (
            <>
              <h1 className="text-[32px] sm:text-[36px] font-black text-slate-900 tracking-tight leading-[1.15]">
                Create Account <br />
                <span className="text-slate-900">to </span>
                <span className="text-[#5c5cf6]">Zenet Hub</span>
              </h1>
              <p className="text-slate-500 text-sm sm:text-[15px] mt-2.5 font-normal">
                Hello there, register to continue!
              </p>
            </>
          )}

          {mode === 'forgot' && (
            <>
              <h1 className="text-[30px] sm:text-[34px] font-black text-slate-900 tracking-tight leading-[1.15]">
                Reset Password <br />
                <span className="text-slate-900">for </span>
                <span className="text-[#5c5cf6]">Zenet Hub</span>
              </h1>
              <p className="text-slate-500 text-sm sm:text-[15px] mt-2.5 font-normal">
                Enter your email address to receive a password reset link.
              </p>
            </>
          )}
        </div>

        {/* Error Notice Banner */}
        {error && (
          <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-start gap-2 text-xs sm:text-sm animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Success Notice Banner */}
        {successMsg && (
          <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl flex items-start gap-2 text-xs sm:text-sm animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <span className="leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} className="w-full">
          
          {/* ================= LOGIN FORM ================= */}
          {mode === 'login' && (
            <div>
              {/* Email* */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                  Email*
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white rounded-xl border border-[#5c5cf6] px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5c5cf6]/20 transition text-sm sm:text-base"
                />
              </div>

              {/* Password* */}
              <div className="mt-5">
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                  Password*
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-white rounded-xl border border-[#5c5cf6] px-4 py-3.5 pr-11 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5c5cf6]/20 transition text-sm sm:text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Forgot Password? Link */}
              <div className="text-right mt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="text-sm font-semibold text-[#5c5cf6] hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-8 bg-[#5c5cf6] hover:bg-[#4d4df0] active:bg-[#4342db] text-white font-semibold text-base py-3.5 rounded-xl shadow-sm transition active:scale-[0.99] cursor-pointer disabled:opacity-60 flex items-center justify-center min-h-[50px]"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>

              {/* Bottom Switch Link */}
              <div className="text-center mt-6 text-sm text-slate-900 font-medium">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    if (onSwitchMode) onSwitchMode('signup');
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="text-[#5c5cf6] font-semibold hover:underline cursor-pointer ml-1"
                >
                  Register
                </button>
              </div>
            </div>
          )}

          {/* ================= SIGN UP / REGISTER FORM ================= */}
          {mode === 'signup' && (
            <div>
              {/* Full Name* */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                  Full Name*
                </label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full bg-white rounded-xl border border-[#5c5cf6] px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5c5cf6]/20 transition text-sm sm:text-base"
                />
              </div>

              {/* Phone* */}
              <div className="mt-4">
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                  Phone*
                </label>
                <input
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full bg-white rounded-xl border border-[#5c5cf6] px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5c5cf6]/20 transition text-sm sm:text-base"
                />
              </div>

              {/* Email* */}
              <div className="mt-4">
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                  Email*
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white rounded-xl border border-[#5c5cf6] px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5c5cf6]/20 transition text-sm sm:text-base"
                />
              </div>

              {/* Password* */}
              <div className="mt-4">
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                  Password*
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-white rounded-xl border border-[#5c5cf6] px-4 py-3.5 pr-11 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5c5cf6]/20 transition text-sm sm:text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password* */}
              <div className="mt-4">
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                  Confirm Password*
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Enter password again"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-white rounded-xl border border-[#5c5cf6] px-4 py-3.5 pr-11 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5c5cf6]/20 transition text-sm sm:text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Referral Code (Optional) */}
              <div className="mt-4">
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                  Referral Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Enter referral code if you have one"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className="w-full bg-white rounded-xl border border-[#5c5cf6] px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5c5cf6]/20 transition text-sm sm:text-base uppercase"
                />
              </div>

              {/* Register Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-[#5c5cf6] hover:bg-[#4d4df0] active:bg-[#4342db] text-white font-semibold text-base py-3.5 rounded-xl shadow-sm transition active:scale-[0.99] cursor-pointer disabled:opacity-60 flex items-center justify-center min-h-[50px]"
              >
                {loading ? 'Registering...' : 'Register'}
              </button>

              {/* Terms & Conditions Checkbox */}
              <div className="flex items-start gap-3 mt-4">
                <input
                  id="terms-checkbox"
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded border-[#5c5cf6] text-[#5c5cf6] focus:ring-[#5c5cf6] cursor-pointer accent-[#5c5cf6] shrink-0"
                />
                <label htmlFor="terms-checkbox" className="text-sm font-bold text-slate-900 leading-snug cursor-pointer select-none">
                  I agree to the <span className="text-[#5c5cf6]">Terms & conditions & Privacy Policy</span> set out by this site.
                </label>
              </div>

              {/* Bottom Switch Link */}
              <div className="text-center mt-6 text-sm text-slate-900 font-medium">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    if (onSwitchMode) onSwitchMode('login');
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="text-[#5c5cf6] font-semibold hover:underline cursor-pointer ml-1"
                >
                  Login
                </button>
              </div>
            </div>
          )}

          {/* ================= FORGOT PASSWORD FORM ================= */}
          {mode === 'forgot' && (
            <div>
              {/* Email* */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                  Email*
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white rounded-xl border border-[#5c5cf6] px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5c5cf6]/20 transition text-sm sm:text-base"
                />
              </div>

              {/* Reset Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-[#5c5cf6] hover:bg-[#4d4df0] active:bg-[#4342db] text-white font-semibold text-base py-3.5 rounded-xl shadow-sm transition active:scale-[0.99] cursor-pointer disabled:opacity-60 flex items-center justify-center min-h-[50px]"
              >
                {loading ? 'Sending link...' : 'Send Reset Link'}
              </button>

              {/* Return to Login */}
              <div className="text-center mt-6 text-sm text-slate-900 font-medium">
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="text-[#5c5cf6] font-semibold hover:underline cursor-pointer ml-1"
                >
                  Login
                </button>
              </div>
            </div>
          )}

        </form>

      </div>
    </div>
  );
};
