import React, { useState } from 'react';
import { Copy, Eye, EyeOff, Check, Key, ShieldCheck, FileText } from 'lucide-react';

export interface AccountCredentialsCardProps {
  email?: string;
  password?: string;
  recoveryInfo?: string;
  twoFactorSecret?: string;
  backupCodes?: string;
  instructions?: string;
  className?: string;
}

export default function AccountCredentialsCard({
  email = '',
  password = '',
  recoveryInfo = '',
  twoFactorSecret = '',
  backupCodes = '',
  instructions = '',
  className = ''
}: AccountCredentialsCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const effectiveRecovery = recoveryInfo || twoFactorSecret || backupCodes;

  return (
    <div className={`w-full max-w-md mx-auto p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-xl text-slate-900 font-sans ${className}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Account Credentials</h3>
            <p className="text-xs text-slate-500">Copy your purchased login details below</p>
          </div>
        </div>
        <span className="px-3 py-1 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-full flex items-center gap-1 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
          Ready
        </span>
      </div>

      {/* Inputs Section */}
      <div className="space-y-4">
        
        {/* Username / Email */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
            Login Email / Username
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              readOnly
              value={email}
              placeholder="No username provided"
              className="w-full bg-slate-50 border border-slate-200 hover:border-blue-300 focus:border-blue-600 focus:bg-white rounded-2xl px-4 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none transition pr-12"
            />
            {email && (
              <button
                type="button"
                onClick={() => handleCopy(email, 'email')}
                className={`absolute right-2 p-1.5 rounded-xl border transition cursor-pointer ${
                  copiedField === 'email'
                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                    : 'bg-white hover:bg-blue-50 border-slate-200 text-blue-600'
                }`}
                title="Copy Email"
              >
                {copiedField === 'email' ? <Check className="w-4 h-4 text-blue-600" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
            Account Password
          </label>
          <div className="relative flex items-center">
            <input
              type={showPassword ? "text" : "password"}
              readOnly
              value={password}
              placeholder="••••••••••••"
              className="w-full bg-slate-50 border border-slate-200 hover:border-blue-300 focus:border-blue-600 focus:bg-white rounded-2xl px-4 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none transition pr-22"
            />
            {password && (
              <div className="absolute right-2 flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                  title={showPassword ? "Hide Password" : "Show Password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(password, 'password')}
                  className={`p-1.5 rounded-xl border transition cursor-pointer ${
                    copiedField === 'password'
                      ? 'bg-pink-100 border-pink-300 text-pink-700'
                    : 'bg-white hover:bg-pink-50 border-slate-200 text-pink-600'
                  }`}
                  title="Copy Password"
                >
                  {copiedField === 'password' ? <Check className="w-4 h-4 text-pink-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Optional Recovery Info / 2FA Key */}
        {effectiveRecovery && (
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              2FA / Recovery Key
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                readOnly
                value={effectiveRecovery}
                className="w-full bg-slate-50 border border-slate-200 hover:border-blue-300 focus:border-blue-600 focus:bg-white rounded-2xl px-4 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none transition pr-12"
              />
              <button
                type="button"
                onClick={() => handleCopy(effectiveRecovery, 'recovery')}
                className={`absolute right-2 p-1.5 rounded-xl border transition cursor-pointer ${
                  copiedField === 'recovery'
                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                    : 'bg-white hover:bg-blue-50 border-slate-200 text-blue-600'
                }`}
                title="Copy Key"
              >
                {copiedField === 'recovery' ? <Check className="w-4 h-4 text-blue-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Special Instructions */}
        {instructions && (
          <div>
            <label className="block text-xs font-bold text-blue-600 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Special Instructions</span>
            </label>
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 text-xs font-medium text-slate-800 whitespace-pre-wrap leading-relaxed shadow-xs">
              {instructions}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
