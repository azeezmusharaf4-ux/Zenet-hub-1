import React, { useState } from 'react';
import { User, EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Mail
} from 'lucide-react';
import { auth } from '../lib/firebase';

interface ChangePasswordViewProps {
  user: User | null;
  onBack: () => void;
  onOpenAuth?: (mode: 'login' | 'signup') => void;
}

export const ChangePasswordView: React.FC<ChangePasswordViewProps> = ({
  user,
  onBack,
  onOpenAuth
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !user.email) {
      showToast('Please sign in to change your password.', 'error');
      if (onOpenAuth) onOpenAuth('login');
      return;
    }

    if (!currentPassword) {
      showToast('Please enter your current password.', 'error');
      return;
    }

    if (!newPassword) {
      showToast('Please enter a new password.', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters long.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('New password and confirm password do not match.', 'error');
      return;
    }

    if (currentPassword === newPassword) {
      showToast('New password must be different from your current password.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // 2. Update password to the new password
      await updatePassword(user, newPassword);

      showToast('Password changed successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        onBack();
      }, 1200);
    } catch (err: any) {
      console.error('Password change error:', err);
      let errorMsg = 'Failed to change password. Please check your current password.';
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        errorMsg = 'Current password is incorrect.';
      } else if (err?.code === 'auth/weak-password') {
        errorMsg = 'Password is too weak. Please use at least 6 characters.';
      } else if (err?.code === 'auth/requires-recent-login') {
        errorMsg = 'Session expired. Please sign in again before changing password.';
      } else if (err?.message) {
        errorMsg = err.message;
      }
      showToast(errorMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user?.email) {
      showToast('Please enter your email to receive a password reset link.', 'error');
      return;
    }

    setIsSendingResetEmail(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      showToast(`Password reset link sent to ${user.email}`, 'success');
    } catch (err: any) {
      console.error('Error sending reset email:', err);
      showToast(err?.message || 'Failed to send password reset email.', 'error');
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto min-h-[calc(100vh-80px)] px-4 sm:px-6 pt-2 pb-24 flex flex-col justify-between animate-in fade-in duration-200">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold transition-all max-w-[90vw] ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-700' 
            : 'bg-rose-950/90 text-rose-200 border-rose-700'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Form Container */}
      <form onSubmit={handleChangePassword} className="flex-1 flex flex-col justify-between">
        
        <div>
          {/* Top Bar: Back Button & Centered Title */}
          <div className="flex items-center justify-between pt-1 mb-8">
            <button
              type="button"
              id="change-password-back-btn"
              onClick={onBack}
              className="w-11 h-11 rounded-2xl border border-[#E2E8F0] bg-white flex items-center justify-center text-[#0F172A] shadow-xs hover:bg-slate-50 transition cursor-pointer active:scale-95 shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-[#0F172A] stroke-[2.5]" />
            </button>

            <h2 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight text-center flex-1 pr-1">
              Change Password
            </h2>

            {/* Symmetrical optical spacer */}
            <div className="w-11 h-11 shrink-0" aria-hidden="true" />
          </div>

          {/* Heading & Subtitle exactly matching screenshot */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight mb-3">
              Change Password
            </h1>
            <p className="text-sm font-medium text-[#64748B] leading-relaxed">
              Please enter your current password and then choose a new password
            </p>
          </div>

          {/* Input Fields */}
          <div className="space-y-5">
            
            {/* Current Password Field */}
            <div>
              <label 
                htmlFor="current-password-input"
                className="block text-sm font-semibold text-[#1E293B] mb-2"
              >
                Current Password*
              </label>
              <div className="relative">
                <input
                  id="current-password-input"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-white text-[#0F172A] text-sm sm:text-base font-normal px-4 py-3.5 sm:py-4 pr-12 rounded-2xl border border-[#818CF8]/80 focus:border-[#5B4DF5] focus:ring-2 focus:ring-[#5B4DF5]/20 outline-none transition shadow-2xs placeholder:text-slate-400"
                />
                <button
                  type="button"
                  id="toggle-current-password-btn"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-[#64748B] hover:text-[#0F172A] transition cursor-pointer"
                  aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                >
                  {showCurrentPassword ? (
                    <Eye className="w-5 h-5 stroke-[1.8]" />
                  ) : (
                    <EyeOff className="w-5 h-5 stroke-[1.8]" />
                  )}
                </button>
              </div>
            </div>

            {/* New Password Field */}
            <div>
              <label 
                htmlFor="new-password-input"
                className="block text-sm font-semibold text-[#1E293B] mb-2"
              >
                New Password*
              </label>
              <div className="relative">
                <input
                  id="new-password-input"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-white text-[#0F172A] text-sm sm:text-base font-normal px-4 py-3.5 sm:py-4 pr-12 rounded-2xl border border-[#818CF8]/80 focus:border-[#5B4DF5] focus:ring-2 focus:ring-[#5B4DF5]/20 outline-none transition shadow-2xs placeholder:text-slate-400"
                />
                <button
                  type="button"
                  id="toggle-new-password-btn"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-[#64748B] hover:text-[#0F172A] transition cursor-pointer"
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                >
                  {showNewPassword ? (
                    <Eye className="w-5 h-5 stroke-[1.8]" />
                  ) : (
                    <EyeOff className="w-5 h-5 stroke-[1.8]" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm New Password Field */}
            <div>
              <label 
                htmlFor="confirm-password-input"
                className="block text-sm font-semibold text-[#1E293B] mb-2"
              >
                Confirm New Password*
              </label>
              <div className="relative">
                <input
                  id="confirm-password-input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Enter password again"
                  className="w-full bg-white text-[#0F172A] text-sm sm:text-base font-normal px-4 py-3.5 sm:py-4 pr-12 rounded-2xl border border-[#818CF8]/80 focus:border-[#5B4DF5] focus:ring-2 focus:ring-[#5B4DF5]/20 outline-none transition shadow-2xs placeholder:text-slate-400"
                />
                <button
                  type="button"
                  id="toggle-confirm-password-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-[#64748B] hover:text-[#0F172A] transition cursor-pointer"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? (
                    <Eye className="w-5 h-5 stroke-[1.8]" />
                  ) : (
                    <EyeOff className="w-5 h-5 stroke-[1.8]" />
                  )}
                </button>
              </div>
            </div>

          </div>

          {/* Quick Password Reset Link option for users who don't remember current password */}
          {user?.email && (
            <div className="mt-4 flex items-center justify-end">
              <button
                type="button"
                id="send-reset-email-btn"
                onClick={handleSendResetEmail}
                disabled={isSendingResetEmail}
                className="text-xs font-semibold text-[#5B4DF5] hover:text-[#4E3EE8] hover:underline flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Mail className="w-3.5 h-3.5" />
                {isSendingResetEmail ? 'Sending reset link...' : 'Forgot current password?'}
              </button>
            </div>
          )}

        </div>

        {/* Bottom Full-Width "Change" Action Button */}
        <div className="pt-10 sm:pt-16 pb-4">
          <button
            id="change-password-submit-btn"
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#5B4DF5] hover:bg-[#4E3EE8] active:scale-[0.98] text-white font-bold py-4 rounded-2xl text-base shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Changing Password...
              </span>
            ) : (
              <span>Change</span>
            )}
          </button>
        </div>

      </form>

    </div>
  );
};
