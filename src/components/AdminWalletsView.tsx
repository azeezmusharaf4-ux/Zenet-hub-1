import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db, getSafeIdToken } from '../lib/firebase';
import { safeApiFetch } from '../utils/api';
import { UserProfile, WalletTransaction } from '../types';
import {
  Wallet,
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Clock,
  User as UserIcon,
  ChevronRight,
  Filter,
  DollarSign,
  Lock,
  ArrowLeft
} from 'lucide-react';

interface AdminWalletsViewProps {
  user: User | null;
  userProfile: UserProfile | null;
  onBackToMarketplace: () => void;
  onOpenAuth?: (mode: 'login' | 'signup') => void;
}

export const AdminWalletsView: React.FC<AdminWalletsViewProps> = ({
  user,
  userProfile,
  onBackToMarketplace,
  onOpenAuth
}) => {
  const authorizedEmail = 'azeezmusharaf4@gmail.com';
  const currentUserEmail = user?.email?.trim().toLowerCase() || '';
  const isAuthorized = currentUserEmail === authorizedEmail || userProfile?.role === 'owner';

  // Real-time collections state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [overrideLedger, setOverrideLedger] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'buyer' | 'seller' | 'admin'>('all');

  // Override Form State
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [action, setAction] = useState<'set' | 'add' | 'deduct'>('set');
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string; txId?: string } | null>(null);

  // Subscribe to Users collection if authorized
  useEffect(() => {
    if (!isAuthorized) {
      setLoadingUsers(false);
      return;
    }

    try {
      const usersRef = collection(db, 'users');
      const unsubscribe = onSnapshot(usersRef, (snapshot) => {
        const list: UserProfile[] = snapshot.docs.map((docSnap) => ({
          uid: docSnap.id,
          ...docSnap.data()
        })) as UserProfile[];
        setUsers(list);
        setLoadingUsers(false);

        // Update selected user reference if active
        if (selectedUser) {
          const updated = list.find((u) => u.uid === selectedUser.uid);
          if (updated) {
            setSelectedUser(updated);
          }
        }
      }, (err) => {
        console.warn('Error listening to users for wallet override:', err);
        setLoadingUsers(false);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn('Users listener error:', e);
      setLoadingUsers(false);
    }
  }, [isAuthorized, selectedUser?.uid]);

  // Subscribe to recent wallet override transactions if authorized
  useEffect(() => {
    if (!isAuthorized) {
      setLoadingLedger(false);
      return;
    }

    try {
      const txRef = collection(db, 'wallet_transactions');
      const unsubscribe = onSnapshot(txRef, (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));
        // Sort descending by date
        list.sort((a: any, b: any) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());
        setOverrideLedger(list);
        setLoadingLedger(false);
      }, (err) => {
        console.warn('Error reading wallet transactions ledger:', err);
        setLoadingLedger(false);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn('Ledger listener error:', e);
      setLoadingLedger(false);
    }
  }, [isAuthorized]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const queryLower = searchQuery.toLowerCase().trim();
      const matchQuery = 
        !queryLower ||
        (u.displayName && u.displayName.toLowerCase().includes(queryLower)) ||
        (u.email && u.email.toLowerCase().includes(queryLower)) ||
        (u.uid && u.uid.toLowerCase().includes(queryLower));

      const matchRole = 
        roleFilter === 'all' ||
        (roleFilter === 'admin' && (u.role === 'admin' || u.role === 'owner')) ||
        (roleFilter === 'seller' && u.role === 'seller') ||
        (roleFilter === 'buyer' && (u.role === 'buyer' || !u.role));

      return matchQuery && matchRole;
    });
  }, [users, searchQuery, roleFilter]);

  // System Stats
  const totalSystemBalance = useMemo(() => {
    return users.reduce((acc, u) => acc + (Number(u.walletBalance) || 0), 0);
  }, [users]);

  const recentOverrides = useMemo(() => {
    return overrideLedger.filter((t) => t.method === 'admin_wallet_override');
  }, [overrideLedger]);

  // Calculated Preview
  const currentSelectedBalance = selectedUser ? (Number(selectedUser.walletBalance) || 0) : 0;
  const numAmount = parseFloat(amount) || 0;
  
  const previewNewBalance = useMemo(() => {
    if (!selectedUser) return 0;
    if (isNaN(numAmount) || numAmount < 0) return currentSelectedBalance;
    if (action === 'set') return numAmount;
    if (action === 'add') return currentSelectedBalance + numAmount;
    if (action === 'deduct') return Math.max(0, currentSelectedBalance - numAmount);
    return currentSelectedBalance;
  }, [selectedUser, currentSelectedBalance, numAmount, action]);

  const balanceDelta = previewNewBalance - currentSelectedBalance;

  // Handle Form Submission
  const handleExecuteOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setFeedback({ type: 'error', message: 'Please select a target user first.' });
      return;
    }

    if (isNaN(numAmount) || numAmount < 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid non-negative amount.' });
      return;
    }

    if (!user || (user.email?.trim().toLowerCase() !== authorizedEmail && userProfile?.role !== 'owner')) {
      setFeedback({ type: 'error', message: 'Access Denied: Only Azeezmusharaf4@gmail.com (Owner) is authorized to execute wallet overrides.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const token = await getSafeIdToken(user);
      const response = await safeApiFetch('/api/admin/wallets/override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'x-caller-email': user.email || ''
        },
        body: JSON.stringify({
          callerEmail: user.email,
          targetUid: selectedUser.uid,
          targetEmail: selectedUser.email,
          action,
          amount: numAmount,
          reason: reason.trim() || 'Manual Admin Wallet Balance Override'
        })
      });

      if (response && response.success) {
        setFeedback({
          type: 'success',
          message: response.message || `Wallet balance successfully updated to ₦${(response.newBalance || previewNewBalance).toLocaleString()}`,
          txId: response.txId
        });
        setAmount('');
        setReason('');
      } else {
        setFeedback({
          type: 'error',
          message: response?.error || 'Failed to update wallet balance on server.'
        });
      }
    } catch (err: any) {
      console.error('Wallet override error:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Server communication failed while adjusting wallet balance.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preset Amount Buttons
  const presetAmounts = [1000, 5000, 10000, 25000, 50000, 100000];

  // 1. UNAUTHORIZED / ACCESS DENIED SCREEN
  if (!isAuthorized) {
    return (
      <div id="admin-wallets-access-denied" className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-slate-900/90 border border-rose-500/40 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto text-rose-400">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-block bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] uppercase font-black px-3 py-1 rounded-full tracking-wider">
              403 Forbidden • Restricted Tool
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Admin Wallet Override Access Denied
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Access to the <strong>Admin Wallet Override</strong> tool and <code className="text-rose-400 font-mono">/admin/wallets</code> route is strictly restricted to authorized administrator:
            </p>
            <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs font-mono font-bold text-amber-300">
              {authorizedEmail}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-2xl text-left space-y-1.5 text-xs text-slate-400">
            <div className="flex items-center justify-between">
              <span>Your Current Status:</span>
              <span className="text-white font-semibold">
                {user ? 'Logged In' : 'Not Authenticated'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Active Account:</span>
              <span className="text-rose-300 font-mono truncate max-w-[200px]">
                {currentUserEmail || 'None'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            {!user && onOpenAuth && (
              <button
                onClick={() => onOpenAuth('login')}
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold rounded-xl transition cursor-pointer text-xs flex items-center justify-center gap-2 shadow-lg"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Log In with Authorized Admin Account</span>
              </button>
            )}

            <button
              onClick={onBackToMarketplace}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition cursor-pointer text-xs flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Marketplace</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. AUTHORIZED ADMIN WALLET OVERRIDE WORKSPACE
  return (
    <div id="admin-wallets-workbench" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-950 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0 shadow-lg">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-white">
                Admin Wallet Override & Balance Tool
              </h1>
              <span className="bg-emerald-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded uppercase tracking-wider">
                OWNER SECURED
              </span>
              <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] px-2 py-0.5 rounded font-mono font-bold">
                {authorizedEmail}
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Direct server-authoritative balance adjustments and ledger audit synchronization. All changes are logged immutably.
            </p>
          </div>
        </div>

        <button
          onClick={onBackToMarketplace}
          className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-slate-700 shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit to Marketplace</span>
        </button>
      </div>

      {/* System Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total User Accounts</span>
          <div className="text-2xl font-black text-white flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-cyan-400" />
            <span>{loadingUsers ? '...' : users.length}</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Cumulative Platform Wallets</span>
          <div className="text-2xl font-black text-emerald-400 flex items-center gap-1.5 font-mono">
            <span>₦{loadingUsers ? '...' : totalSystemBalance.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-1">
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Audit Logged Overrides</span>
          <div className="text-2xl font-black text-amber-400 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            <span>{loadingLedger ? '...' : recentOverrides.length}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: User Selection (Left) vs Override Terminal (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: User Directory & Selection */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-white">Select Target User</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              {filteredUsers.length} Users Found
            </span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, email, or UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-400"
            />
          </div>

          {/* Role Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {(['all', 'buyer', 'seller', 'admin'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase transition cursor-pointer shrink-0 ${
                  roleFilter === r
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* User List */}
          <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1 scrollbar-none">
            {loadingUsers ? (
              <div className="text-center py-10 text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Loading users from database...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                No users found matching query.
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedUser?.uid === u.uid;
                const balance = Number(u.walletBalance) || 0;

                return (
                  <button
                    key={u.uid}
                    onClick={() => {
                      setSelectedUser(u);
                      setAmount(String(balance));
                      setAction('set');
                      setFeedback(null);
                    }}
                    className={`w-full text-left p-3 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-950/60 border-emerald-400 shadow-md'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white truncate max-w-[160px]">
                          {u.displayName || u.email?.split('@')[0] || 'User'}
                        </span>
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                          u.role === 'admin' || u.role === 'owner'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : u.role === 'seller'
                            ? 'bg-purple-950 text-purple-300 border border-purple-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {u.role || 'buyer'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{u.email}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-black text-emerald-400">
                        ₦{balance.toLocaleString()}
                      </div>
                      <span className="text-[9px] text-slate-500">Current Balance</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: Override Execution Terminal */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="font-extrabold text-base text-white">Override Configuration</h3>
            </div>
            {selectedUser && (
              <span className="text-xs font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-xl">
                Target: {selectedUser.email}
              </span>
            )}
          </div>

          {!selectedUser ? (
            <div className="text-center py-16 space-y-3 border border-dashed border-slate-800 rounded-2xl">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <UserIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">No User Selected</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Please select a user from the directory on the left to review their balance and configure an override.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleExecuteOverride} className="space-y-5">
              {/* Target User Status Card */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Active Account</span>
                  <div className="font-bold text-sm text-white mt-0.5">{selectedUser.displayName || 'Unnamed User'}</div>
                  <div className="text-xs text-slate-400 font-mono">{selectedUser.email} • UID: <code className="text-[10px] text-slate-500">{selectedUser.uid}</code></div>
                </div>

                <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl sm:text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Current Balance</span>
                  <div className="text-lg font-black text-emerald-400 font-mono">
                    ₦{currentSelectedBalance.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Action Mode Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Adjustment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAction('set')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                      action === 'set'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Set Exact</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAction('add')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                      action === 'add'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Credit / Add</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAction('deduct')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                      action === 'deduct'
                        ? 'bg-rose-500 text-white border-rose-400 shadow-md'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Debit / Deduct</span>
                  </button>
                </div>
              </div>

              {/* Amount Input & Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    {action === 'set' ? 'New Target Balance (₦)' : 'Adjustment Amount (₦)'}
                  </label>
                  {action !== 'set' && (
                    <span className="text-[11px] text-slate-400">Quick Presets</span>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">₦</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Enter amount..."
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                {/* Preset Chips */}
                {action !== 'set' && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {presetAmounts.map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setAmount(String(p))}
                        className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer"
                      >
                        +₦{p.toLocaleString()}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Real-time Calculation Summary Box */}
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-3">
                <div className="text-[11px] uppercase font-bold text-slate-400">Preview & Impact Summary</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-900/60 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400">Previous</span>
                    <div className="text-xs font-mono font-bold text-slate-300 mt-0.5">
                      ₦{currentSelectedBalance.toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400">Delta</span>
                    <div className={`text-xs font-mono font-extrabold mt-0.5 ${
                      balanceDelta > 0 ? 'text-emerald-400' : balanceDelta < 0 ? 'text-rose-400' : 'text-slate-400'
                    }`}>
                      {balanceDelta > 0 ? `+₦${balanceDelta.toLocaleString()}` : balanceDelta < 0 ? `-₦${Math.abs(balanceDelta).toLocaleString()}` : '₦0'}
                    </div>
                  </div>

                  <div className="bg-slate-900 p-2 rounded-xl border border-emerald-500/40">
                    <span className="text-[10px] text-emerald-400 font-bold">New Balance</span>
                    <div className="text-xs font-mono font-black text-emerald-300 mt-0.5">
                      ₦{previewNewBalance.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Audit Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Reason for Override <span className="text-slate-500 text-[11px]">(Recorded in ledger)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Customer dispute resolution refund, Manual bank wire credit, Correction"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Feedback Banner */}
              {feedback && (
                <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-200 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                    : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                }`}>
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5 flex-1">
                    <p className="font-bold">{feedback.message}</p>
                    {feedback.txId && (
                      <p className="text-[10px] font-mono text-emerald-400">Transaction ID: {feedback.txId}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Secure Server Override...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirm & Apply Override (₦{previewNewBalance.toLocaleString()})</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* BOTTOM: Immutable Audit Ledger Stream */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm text-white">Recent Admin Override Ledger Records</h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {recentOverrides.length} Ledger Entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 border-b border-slate-800 text-[10px] text-slate-400 uppercase font-black tracking-wider">
              <tr>
                <th className="p-3">Date & Time</th>
                <th className="p-3">Target User</th>
                <th className="p-3">Action</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Previous</th>
                <th className="p-3">New Balance</th>
                <th className="p-3">Authorized By</th>
                <th className="p-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {recentOverrides.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 font-sans text-xs">
                    No manual wallet override records logged yet.
                  </td>
                </tr>
              ) : (
                recentOverrides.slice(0, 10).map((record) => (
                  <tr key={record.id} className="hover:bg-slate-950/40 transition">
                    <td className="p-3 text-[11px] text-slate-400 whitespace-nowrap font-sans">
                      {record.date ? new Date(record.date).toLocaleString() : 'N/A'}
                    </td>
                    <td className="p-3 text-white font-bold whitespace-nowrap">
                      {record.userEmail || record.userId}
                    </td>
                    <td className="p-3">
                      <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase ${
                        record.action === 'add'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : record.action === 'deduct'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                      }`}>
                        {record.action || record.type}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-white">
                      ₦{(record.amount || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-slate-400">
                      ₦{(record.previousBalance || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-emerald-400 font-bold">
                      ₦{(record.newBalance || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-[11px] text-amber-300 font-sans">
                      {record.adminEmail || 'Azeezmusharaf4@gmail.com'}
                    </td>
                    <td className="p-3 text-[11px] text-slate-400 font-sans max-w-xs truncate">
                      {record.reason || 'Manual override'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
