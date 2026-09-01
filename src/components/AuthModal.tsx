import React, { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  GoogleAuthProvider, 
  signInWithPopup,
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
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
  Phone, 
  ArrowRight
} from 'lucide-react';

interface AuthModalProps {
  mode: 'login' | 'signup';
  onClose: () => void;
  onSuccess: () => void;
  onSwitchMode?: (mode: 'login' | 'signup') => void;
  sessionExpiredNotice?: string;
  hideCloseButton?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  mode: initialMode,
  onClose,
  onSuccess,
  onSwitchMode,
  sessionExpiredNotice,
  hideCloseButton = false
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  
  // Registration Form Fields
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Password Visibility Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Referral Code
  const [referralCode, setReferralCode] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const paramRef = urlParams.get('ref') || urlParams.get('referral');
      if (paramRef) return paramRef.toUpperCase();
      return localStorage.getItem('pending_referral_code') || '';
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

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      localStorage.setItem('zenet_last_seen_timestamp', Date.now().toString());
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const user = res.user;

      // Save user profile in Firestore
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          photoURL: user.photoURL || '',
          createdAt: new Date().toISOString(),
          status: 'active',
          role: user.email === 'azeezmusharaf4@gmail.com' ? 'owner' : 'buyer'
        }, { merge: true });
      }

      setStatusMsg('Securing connection and loading your customized dashboard...');
      onSuccess();
    } catch (err: any) {
      console.warn('Google Sign-In notice:', err?.code || err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup closed before completion.');
      } else {
        setError(err.message || 'Google Sign-In failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg(`If an account exists for ${email}, a password reset link has been sent to your inbox.`);
    } catch (err: any) {
      console.warn('Password reset notice:', err?.code || err);
      const code = err.code || '';
      if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setSuccessMsg(`If an account exists for ${email}, a password reset link has been sent to your inbox.`);
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

    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify your confirm password.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
    }

    setLoading(true);
    localStorage.setItem('zenet_last_seen_timestamp', Date.now().toString());

    try {
      if (mode === 'signup') {
        // Save referral code if provided
        if (referralCode.trim()) {
          try {
            localStorage.setItem('pending_referral_code', referralCode.trim().toUpperCase());
          } catch (e) {
            console.warn('LocalStorage error:', e);
          }
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const effectiveDisplayName = username.trim() || displayNameFallback(fullName, email);

        // Update Auth Profile
        await updateProfile(user, {
          displayName: effectiveDisplayName
        });

        // Write User Profile to Firestore
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email || '',
          displayName: effectiveDisplayName,
          username: username.trim() || effectiveDisplayName,
          fullName: fullName.trim(),
          phoneNumber: phone.trim(),
          whatsapp: phone.trim(),
          createdAt: new Date().toISOString(),
          status: 'active',
          role: user.email === 'azeezmusharaf4@gmail.com' ? 'owner' : 'buyer'
        }, { merge: true });

      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      setStatusMsg('Securing connection and loading your customized dashboard...');
      onSuccess();
    } catch (err: any) {
      console.warn('Auth notice:', err?.code || err);
      let msg = err.message || 'Authentication failed.';
      const code = err.code || '';

      if (code === 'auth/operation-not-allowed') {
        msg = 'Email/Password Authentication is disabled in Firebase. Enable it in Firebase Console > Authentication, or sign in with Google.';
      } else if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        msg = mode === 'login' 
          ? 'Invalid email or password. If you do not have an account yet, switch to "Create Account" to register.'
          : 'Invalid credentials provided. Please check your email and password.';
      } else if (code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please switch to "Log In" to access your account.';
      } else if (code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-[#06030e]/90 backdrop-blur-xl overflow-y-auto w-full max-w-full overscroll-contain">
      
      {/* Outer Container Card - 2 Column on Desktop */}
      <div 
        className="bg-[#0f0722]/95 border border-[#2b1752] rounded-2xl sm:rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl relative my-auto max-h-[92dvh] sm:max-h-[90vh] flex flex-col md:flex-row text-purple-100 min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Close Modal Button */}
        {!hideCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 z-20 p-2 text-purple-300/70 hover:text-white bg-[#1a0c3a]/80 hover:bg-[#281358] border border-[#371b6e] rounded-full transition cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}

        {/* LEFT COLUMN: Brand Experience & Features (Desktop/Tablet) */}
        <div className="hidden md:flex md:w-5/12 bg-gradient-to-br from-[#180a3a] via-[#12062d] to-[#0a031a] p-8 lg:p-10 flex-col justify-between relative overflow-y-auto border-r border-[#26124a] min-h-0">
          
          {/* Ambient Glows */}
          <div className="absolute top-0 left-0 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-pink-600/15 rounded-full blur-3xl pointer-events-none"></div>

          {/* Top Section */}
          <div className="relative z-10 space-y-6">
            
            {/* Pulsing Pill Tag */}
            <div className="inline-flex items-center gap-2 bg-purple-900/40 border border-purple-500/40 text-purple-200 text-xs font-bold px-3.5 py-1.5 rounded-full shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Create your secure account</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-3">
              <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
                Start your <br />
                <span className="bg-gradient-to-r from-purple-400 via-fuchsia-300 to-pink-400 bg-clip-text text-transparent">
                  premium digital service
                </span> journey.
              </h1>
              <p className="text-xs lg:text-sm text-purple-200/70 leading-relaxed">
                Create your ZENET HUB account to access your dashboard, escrow wallet, order history, verified listings, and 24/7 support.
              </p>
            </div>

            {/* 4 Feature Cards (2x2 Grid) */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              
              {/* Feature 1 */}
              <div className="bg-[#190b3a]/70 border border-[#2e175a] p-3.5 rounded-2xl space-y-1.5 backdrop-blur-md hover:border-purple-500/50 transition duration-200">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="font-extrabold text-white text-xs">Fast setup</h4>
                <p className="text-[11px] text-purple-300/60 leading-snug">
                  Create your account & enter your dashboard in seconds.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-[#190b3a]/70 border border-[#2e175a] p-3.5 rounded-2xl space-y-1.5 backdrop-blur-md hover:border-purple-500/50 transition duration-200">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="font-extrabold text-white text-xs">Secure access</h4>
                <p className="text-[11px] text-purple-300/60 leading-snug">
                  Protected with encrypted escrow safeguards.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-[#190b3a]/70 border border-[#2e175a] p-3.5 rounded-2xl space-y-1.5 backdrop-blur-md hover:border-purple-500/50 transition duration-200">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <h4 className="font-extrabold text-white text-xs">Wallet ready</h4>
                <p className="text-[11px] text-purple-300/60 leading-snug">
                  Fund your dedicated wallet for instant checkouts.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-[#190b3a]/70 border border-[#2e175a] p-3.5 rounded-2xl space-y-1.5 backdrop-blur-md hover:border-purple-500/50 transition duration-200">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h4 className="font-extrabold text-white text-xs">Referral ready</h4>
                <p className="text-[11px] text-purple-300/60 leading-snug">
                  Earn bonuses when inviting friends with your code.
                </p>
              </div>

            </div>

          </div>

          {/* Bottom Branding Tag */}
          <div className="relative z-10 pt-6 border-t border-[#231244] flex items-center justify-between text-xs text-purple-300/50 font-semibold">
            <span>ZENET HUB Marketplace</span>
            <span>Verified & Safe</span>
          </div>

        </div>

        {/* RIGHT COLUMN: Registration Form & Auth Card */}
        <div className="w-full md:w-7/12 p-4 sm:p-7 lg:p-9 flex flex-col justify-between overflow-y-auto flex-1 min-h-0">
          {statusMsg ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 sm:p-6 space-y-6 my-auto animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 rounded-full bg-purple-600/10 border border-purple-500/20 flex items-center justify-center relative shrink-0">
                <span className="absolute inset-0 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin"></span>
                <CheckCircle2 className="w-8 h-8 text-purple-400 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Login Successful</h3>
                <p className="text-sm text-purple-300/70 leading-relaxed max-w-sm">
                  {statusMsg}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
            
            {/* Top Tag & Title */}
            <div>
              <span className="text-[10px] font-black tracking-widest text-purple-400 uppercase block mb-1">
                {mode === 'forgot' ? 'ACCOUNT RECOVERY' : mode === 'login' ? 'WELCOME BACK' : 'REGISTER ACCOUNT'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {mode === 'forgot' ? 'Reset Password' : mode === 'login' ? 'Log In to Account' : 'Create Account'}
              </h2>
              <p className="text-xs sm:text-sm text-purple-300/70 mt-1">
                {mode === 'forgot' 
                  ? 'Enter your account email to receive a password reset link.' 
                  : mode === 'login' 
                  ? 'Access your dashboard, wallet balance, orders, and listings.' 
                  : 'Join ZENET HUB Marketplace and start using your premium dashboard.'}
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="bg-rose-950/80 border border-rose-800 text-rose-300 p-3 sm:p-3.5 rounded-2xl flex flex-col gap-2 text-xs animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
                {mode === 'login' && (error.includes('Invalid email or password') || error.includes('Create Account') || error.includes('invalid-credential')) && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      if (password) setConfirmPassword(password);
                      setError('');
                    }}
                    className="self-start mt-1 bg-rose-900/60 hover:bg-rose-800/80 text-rose-100 font-extrabold text-[11px] px-3 py-1.5 rounded-xl border border-rose-700/60 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Create an account now →</span>
                  </button>
                )}
              </div>
            )}

            {/* Success Message Banner */}
            {successMsg && (
              <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 p-3 sm:p-3.5 rounded-2xl flex items-start gap-2.5 text-xs animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span className="leading-relaxed">{successMsg}</span>
              </div>
            )}

            {/* Google Quick Sign-In Option */}
            {mode !== 'forgot' && (
              <div>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-[#160a2d] hover:bg-[#200f40] text-white font-bold py-3 px-4 rounded-2xl border border-[#31195a] shadow-md transition cursor-pointer text-xs sm:text-sm disabled:opacity-50 active:scale-[0.99] shrink-0 min-h-[44px]"
                >
                  <svg 
                    width="18" 
                    height="18" 
                    viewBox="0 0 24 24" 
                    className="w-4.5 h-4.5 min-w-[18px] min-h-[18px] max-w-[18px] max-h-[18px] shrink-0 block"
                    style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px', maxWidth: '18px', maxHeight: '18px' }}
                  >
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
                  <span className="truncate">Continue with Google</span>
                </button>

                <div className="relative flex items-center justify-center my-3 sm:my-4">
                  <div className="border-t border-[#261248] w-full" />
                  <span className="bg-[#0f0722] px-3 text-[11px] text-purple-300/40 uppercase tracking-widest font-bold shrink-0">
                    or fill details
                  </span>
                  <div className="border-t border-[#261248] w-full" />
                </div>
              </div>
            )}

            {/* FORM */}
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5 text-xs sm:text-sm">
              
              {/* FORGOT PASSWORD FORM ONLY */}
              {mode === 'forgot' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-purple-200 font-bold mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 shrink-0" />
                      <input
                        type="email"
                        placeholder="name@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full bg-[#160a2d] text-white placeholder-purple-300/40 pl-10 pr-4 py-3 rounded-2xl border border-[#31195a] focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition text-base sm:text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:opacity-90 text-white font-extrabold py-3.5 rounded-2xl shadow-lg transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 min-h-[46px]"
                  >
                    {loading ? 'Sending...' : 'Send Reset Link →'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                    className="w-full text-center text-xs text-purple-300 hover:text-white font-bold transition flex items-center justify-center gap-1.5 pt-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Log In</span>
                  </button>
                </div>
              )}

              {/* SIGN UP FIELDS (2-COL GRID FOR INPUTS) */}
              {mode === 'signup' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    {/* Username Field */}
                    <div>
                      <label className="block text-purple-200 font-bold mb-1 text-xs">Username</label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 shrink-0" />
                        <input
                          type="text"
                          placeholder="alex_zenet"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                          className="w-full bg-[#160a2d] text-white placeholder-purple-300/40 pl-9 pr-3 py-3 sm:py-2.5 rounded-xl border border-[#31195a] focus:outline-none focus:border-purple-500 transition text-base sm:text-xs"
                        />
                      </div>
                    </div>

                    {/* Full Name Field */}
                    <div>
                      <label className="block text-purple-200 font-bold mb-1 text-xs">Full Name</label>
                      <div className="relative">
                        <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 shrink-0" />
                        <input
                          type="text"
                          placeholder="Alex Johnson"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full bg-[#160a2d] text-white placeholder-purple-300/40 pl-9 pr-3 py-3 sm:py-2.5 rounded-xl border border-[#31195a] focus:outline-none focus:border-purple-500 transition text-base sm:text-xs"
                        />
                      </div>
                    </div>

                    {/* Email Field */}
                    <div>
                      <label className="block text-purple-200 font-bold mb-1 text-xs">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 shrink-0" />
                        <input
                          type="email"
                          placeholder="name@domain.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="w-full bg-[#160a2d] text-white placeholder-purple-300/40 pl-9 pr-3 py-3 sm:py-2.5 rounded-xl border border-[#31195a] focus:outline-none focus:border-purple-500 transition text-base sm:text-xs"
                        />
                      </div>
                    </div>

                    {/* Phone Number Field */}
                    <div>
                      <label className="block text-purple-200 font-bold mb-1 text-xs">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 shrink-0" />
                        <input
                          type="tel"
                          placeholder="08012345678"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full bg-[#160a2d] text-white placeholder-purple-300/40 pl-9 pr-3 py-3 sm:py-2.5 rounded-xl border border-[#31195a] focus:outline-none focus:border-purple-500 transition text-base sm:text-xs"
                        />
                      </div>
                    </div>

                    {/* Password Field */}
                    <div>
                      <label className="block text-purple-200 font-bold mb-1 text-xs">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 shrink-0" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          className="w-full bg-[#160a2d] text-white placeholder-purple-300/40 pl-9 pr-9 py-3 sm:py-2.5 rounded-xl border border-[#31195a] focus:outline-none focus:border-purple-500 transition text-base sm:text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-white"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password Field */}
                    <div>
                      <label className="block text-purple-200 font-bold mb-1 text-xs">Confirm Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 shrink-0" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={6}
                          className="w-full bg-[#160a2d] text-white placeholder-purple-300/40 pl-9 pr-9 py-3 sm:py-2.5 rounded-xl border border-[#31195a] focus:outline-none focus:border-purple-500 transition text-base sm:text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-white"
                        >
                          {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Password Strength Bar */}
                  {password && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-purple-300/70">
                        <span>Password Strength</span>
                        <span className="font-extrabold text-white">{strength.label}</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#1b0d36] rounded-full overflow-hidden flex gap-1">
                        <div className={`h-full flex-1 rounded-full ${strength.score >= 1 ? strength.color : 'bg-slate-800'}`}></div>
                        <div className={`h-full flex-1 rounded-full ${strength.score >= 2 ? strength.color : 'bg-slate-800'}`}></div>
                        <div className={`h-full flex-1 rounded-full ${strength.score >= 3 ? strength.color : 'bg-slate-800'}`}></div>
                      </div>
                      <p className="text-[10px] text-purple-300/50">
                        Use at least 6 characters for your password.
                      </p>
                    </div>
                  )}

                  {/* Referral Code (Optional) */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-purple-200 font-bold flex items-center gap-1 text-xs">
                        <Gift className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Referral Code</span>
                      </label>
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Optional</span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. ZN-7A9B2"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        className="w-full bg-[#160a2d] text-amber-300 font-mono text-base sm:text-xs tracking-wider px-3 py-2.5 sm:py-2 rounded-xl border border-[#31195a] focus:outline-none focus:border-amber-500 placeholder:text-purple-300/30"
                      />
                    </div>
                  </div>

                  {/* Terms & Privacy Notice */}
                  <div className="bg-[#150a2b]/80 border border-[#2d1852] p-3 rounded-2xl flex items-start gap-2 text-[11px] text-purple-200/80 leading-relaxed mt-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1.5 shadow-sm"></span>
                    <span>
                      By creating an account, you agree to use ZENET HUB Marketplace responsibly and keep your login details private.
                    </span>
                  </div>

                  {/* Create Account Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:opacity-90 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-purple-600/30 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-sm mt-3 active:scale-[0.99] min-h-[46px]"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create account</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Toggle to Login */}
                  <div className="pt-3 text-center border-t border-[#231244]">
                    <span className="text-xs text-purple-300/60 block mb-2 font-semibold">Already registered?</span>
                    <button
                      type="button"
                      onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                      className="w-full bg-[#180c38] hover:bg-[#25134e] text-purple-200 hover:text-white font-bold py-2.5 px-4 rounded-xl border border-[#361c6b] transition cursor-pointer text-xs min-h-[42px]"
                    >
                      Already have an account? <span className="text-fuchsia-400 underline ml-1">Login now</span>
                    </button>
                  </div>
                </>
              )}

              {/* LOG IN FIELDS */}
              {mode === 'login' && (
                <>
                  <div>
                    <label className="block text-purple-200 font-bold mb-1 text-xs">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 shrink-0" />
                      <input
                        type="email"
                        placeholder="name@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full bg-[#160a2d] text-white placeholder-purple-300/40 pl-9 pr-3 py-3 sm:py-2.5 rounded-xl border border-[#31195a] focus:outline-none focus:border-purple-500 transition text-base sm:text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-purple-200 font-bold text-xs">Password</label>
                      <button
                        type="button"
                        onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); }}
                        className="text-xs font-bold text-fuchsia-400 hover:text-fuchsia-300 transition cursor-pointer py-1"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 shrink-0" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full bg-[#160a2d] text-white placeholder-purple-300/40 pl-9 pr-9 py-3 sm:py-2.5 rounded-xl border border-[#31195a] focus:outline-none focus:border-purple-500 transition text-base sm:text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-white p-1"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Login Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:opacity-90 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-purple-600/30 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-sm mt-3 active:scale-[0.99] min-h-[46px]"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Logging in...</span>
                      </>
                    ) : (
                      <>
                        <span>Log in to ZENET HUB</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Switch to Signup */}
                  <div className="pt-3 text-center border-t border-[#231244]">
                    <span className="text-xs text-purple-300/60 block mb-2 font-semibold">New to ZENET HUB?</span>
                    <button
                      type="button"
                      onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }}
                      className="w-full bg-[#180c38] hover:bg-[#25134e] text-purple-200 hover:text-white font-bold py-2.5 px-4 rounded-xl border border-[#361c6b] transition cursor-pointer text-xs min-h-[42px]"
                    >
                      Don't have an account yet? <span className="text-fuchsia-400 underline ml-1">Register now</span>
                    </button>
                  </div>
                </>
              )}

            </form>

          </div>
          )}

          {/* Copyright Footer */}
          <div className="pt-6 text-center text-[10px] text-purple-300/40 font-semibold border-t border-[#231244] mt-6">
            © {new Date().getFullYear()} ZENET HUB Marketplace. All rights reserved.
          </div>

        </div>

      </div>
    </div>
  );
};
