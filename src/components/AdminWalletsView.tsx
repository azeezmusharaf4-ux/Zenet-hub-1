import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
  collection, 
  doc,
  getDoc,
  updateDoc,
  setDoc,
  increment,
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db, getSafeIdToken } from '../lib/firebase';
import { isAuthorizedOwner } from '../lib/authorizedOwners';
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
  onBalanceUpdated?: (newBalance: number) => void;
}

export const AdminWalletsView: React.FC<AdminWalletsViewProps> = ({
  user,
  userProfile,
  onBackToMarketplace,
  onOpenAuth,
  onBalanceUpdated
}) => {
  const isAuthorized = isAuthorizedOwner(user, userProfile);
  const currentUserEmail = user?.email?.trim() || userProfile?.email?.trim() || '';

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

        // Update selected user reference if active without re-subscribing
        setSelectedUser((prev) => (prev ? (list.find((u) => u.uid === prev.uid) || prev) : null));
      }, (err) => {
        console.warn('Error listening to users for wallet override:', err);
        setLoadingUsers(false);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn('Users listener error:', e);
      setLoadingUsers(false);
    }
  }, [isAuthorized]);

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
    return users.reduce((acc, u) => {
      const b = u.walletBalance !== undefined ? u.walletBalance : (u as any).balance;
      return acc + (Number(b) || 0);
    }, 0);
  }, [users]);

  const recentOverrides = useMemo(() => {
    return overrideLedger.filter((t) => t.method === 'admin_wallet_override');
  }, [overrideLedger]);

  // Calculated Preview
  const rawSelBal = selectedUser ? (selectedUser.walletBalance !== undefined ? selectedUser.walletBalance : (selectedUser as any).balance) : 0;
  const currentSelectedBalance = typeof rawSelBal === 'number' ? rawSelBal : Number(rawSelBal || 0);
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

    if (!isAuthorized) {
      setFeedback({ type: 'error', message: 'Access Denied: Only an authorized Owner is permitted to execute wallet overrides.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const token = await getSafeIdToken(user);
      const finalTxId = `OVERRIDE_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const userDocRef = doc(db, 'users', selectedUser.uid);
      const walletDocRef = doc(db, 'wallets', selectedUser.uid);

      let balanceFieldValueUpdate: any = {};
      let calculatedTargetBalance = currentSelectedBalance;

      if (action === 'add') {
        calculatedTargetBalance = currentSelectedBalance + numAmount;
        balanceFieldValueUpdate = {
          walletBalance: increment(numAmount),
          balance: increment(numAmount)
        };
      } else if (action === 'deduct') {
        const deductEffective = Math.min(numAmount, currentSelectedBalance);
        calculatedTargetBalance = Math.max(0, currentSelectedBalance - numAmount);
        balanceFieldValueUpdate = {
          walletBalance: increment(-deductEffective),
          balance: increment(-deductEffective)
        };
      } else {
        calculatedTargetBalance = numAmount;
        balanceFieldValueUpdate = {
          walletBalance: numAmount,
          balance: numAmount
        };
      }

      // STEP 1: Direct atomic persistent write to Firestore users/{selectedUser.uid} document FIRST
      await setDoc(userDocRef, {
        ...balanceFieldValueUpdate,
        lastWalletOverrideAt: new Date().toISOString(),
        lastWalletOverrideBy: user.email || 'Azeezmusharaf4@gmail.com',
        email: selectedUser.email || '',
        uid: selectedUser.uid
      }, { merge: true });

      // STEP 2: Direct atomic persistent write to Firestore wallets/{selectedUser.uid} document FIRST
      await setDoc(walletDocRef, {
        userId: selectedUser.uid,
        userEmail: selectedUser.email || '',
        ...balanceFieldValueUpdate,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // STEP 3: Confirm document is committed to Firestore database by reading fresh snapshot
      const freshSnap = await getDoc(userDocRef);
      let confirmedBalance = calculatedTargetBalance;
      if (freshSnap.exists()) {
        const fData = freshSnap.data();
        const rawF = fData?.walletBalance !== undefined ? fData?.walletBalance : fData?.balance;
        confirmedBalance = typeof rawF === 'number' ? rawF : Number(rawF || 0);
      }

      // STEP 4: Record permanent immutable audit entry in wallet_transactions ledger
      await setDoc(doc(db, 'wallet_transactions', finalTxId), {
        id: finalTxId,
        userId: selectedUser.uid,
        userEmail: selectedUser.email || '',
        amount: Math.abs(confirmedBalance - currentSelectedBalance),
        previousBalance: currentSelectedBalance,
        newBalance: confirmedBalance,
        walletBalance: confirmedBalance,
        balance: confirmedBalance,
        action,
        type: action === 'deduct' ? 'deduction' : 'deposit',
        method: 'admin_wallet_override',
        status: 'successful',
        adminEmail: user.email || 'Azeezmusharaf4@gmail.com',
        reason: reason.trim() || 'Manual Admin Wallet Balance Override',
        date: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      // STEP 5: If the targeted account is the currently logged-in user (e.g. Owner funding themselves), sync UI immediately
      const isCurrentLoggedInUser = (selectedUser.uid === user.uid) || 
        (Boolean(selectedUser.email && user.email) && selectedUser.email?.trim().toLowerCase() === user.email?.trim().toLowerCase());
      if (isCurrentLoggedInUser && onBalanceUpdated) {
        onBalanceUpdated(confirmedBalance);
      }

      // STEP 6: Update component local directory and selection with the confirmed balance
      setSelectedUser((prev) => prev ? { ...prev, walletBalance: confirmedBalance, balance: confirmedBalance } : null);
      setUsers((prev) => prev.map((u) => u.uid === selectedUser.uid ? { ...u, walletBalance: confirmedBalance, balance: confirmedBalance } : u));

      // STEP 7: Optional server mirror notification (silent background)
      try {
        await safeApiFetch('/api/admin/wallets/override', {
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
        }).catch(() => {});
      } catch {}

      // STEP 8: Show success state ONLY AFTER Firestore database document has been successfully committed
      setFeedback({
        type: 'success',
        message: `Wallet balance successfully committed and updated to ₦${confirmedBalance.toLocaleString()}`,
        txId: finalTxId
      });
      setAmount('');
      setReason('');
    } catch (err: any) {
      console.error('Wallet override error:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to adjust wallet balance in database.'
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
        <div className="max-w-md w-full bg-white border border-purple-200 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-xl">
          <div className="w-16 h-16 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-center mx-auto text-purple-600">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-block bg-purple-50 text-purple-700 border border-purple-200 text-[10px] uppercase font-black px-3 py-1 rounded-full tracking-wider">
              403 Forbidden • Restricted Tool
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              Admin Wallet Override Access Denied
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Access to the <strong>Admin Wallet Override</strong> tool and <code className="text-purple-700 font-mono">/admin/wallets</code> route is strictly restricted to authorized platform owners.
            </p>
            <div className="bg-purple-50/50 border border-purple-200 p-2.5 rounded-xl text-xs font-mono font-bold text-purple-900">
              Authorized Owner Role Required
            </div>
          </div>

          <div className="bg-purple-50/30 border border-purple-100 p-3.5 rounded-2xl text-left space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span>Your Current Status:</span>
              <span className="text-slate-900 font-semibold">
                {user ? 'Logged In' : 'Not Authenticated'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Active Account:</span>
              <span className="text-purple-700 font-mono truncate max-w-[200px]">
                {currentUserEmail || 'None'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            {!user && onOpenAuth && (
              <button
                onClick={() => onOpenAuth('login')}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl transition cursor-pointer text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Log In with Authorized Admin Account</span>
              </button>
            )}

            <button
              onClick={onBackToMarketplace}
              className="w-full py-3 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold rounded-xl transition cursor-pointer text-xs flex items-center justify-center gap-2"
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
      <div className="bg-white border border-purple-200 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center shrink-0 shadow-sm">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-slate-900">
                Admin Wallet Override & Balance Tool
              </h1>
              <span className="bg-purple-600 text-white font-black text-[9px] px-2.5 py-0.5 rounded uppercase tracking-wider">
                OWNER SECURED
              </span>
              <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[9px] px-2.5 py-0.5 rounded font-mono font-bold">
                AUTHORIZED OWNER
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Direct server-authoritative balance adjustments and ledger audit synchronization. All changes are logged immutably.
            </p>
          </div>
        </div>

        <button
          onClick={onBackToMarketplace}
          className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-purple-200 shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit to Marketplace</span>
        </button>
      </div>

      {/* System Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-purple-100 p-4 rounded-2xl space-y-1 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Total User Accounts</span>
          <div className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-purple-600" />
            <span>{loadingUsers ? '...' : users.length}</span>
          </div>
        </div>

        <div className="bg-white border border-purple-100 p-4 rounded-2xl space-y-1 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Cumulative Platform Wallets</span>
          <div className="text-2xl font-black text-purple-600 flex items-center gap-1.5 font-mono">
            <span>₦{loadingUsers ? '...' : totalSystemBalance.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white border border-purple-100 p-4 rounded-2xl space-y-1 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Audit Logged Overrides</span>
          <div className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-600" />
            <span>{loadingLedger ? '...' : recentOverrides.length}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: User Selection (Left) vs Override Terminal (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: User Directory & Selection */}
        <div className="lg:col-span-5 bg-white border border-purple-100 rounded-3xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-sm text-slate-900">Select Target User</h3>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              {filteredUsers.length} Users Found
            </span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FAF5FF] border border-purple-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
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
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-50 text-slate-700 hover:text-slate-900 border border-purple-200'
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
                <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                <span>Loading users from database...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500 border border-dashed border-purple-200 rounded-2xl">
                No users found matching query.
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedUser?.uid === u.uid;
                const rawB = u.walletBalance !== undefined ? u.walletBalance : (u as any).balance;
                const balance = typeof rawB === 'number' ? rawB : Number(rawB || 0);

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
                        ? 'bg-purple-50 border-purple-300 shadow-xs'
                        : 'bg-white border-purple-100 hover:border-purple-200 hover:bg-purple-50/40'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 truncate max-w-[160px]">
                          {u.displayName || u.email?.split('@')[0] || 'User'}
                        </span>
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                          u.role === 'admin' || u.role === 'owner'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : u.role === 'seller'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {u.role || 'buyer'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{u.email}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-black text-purple-700">
                        ₦{balance.toLocaleString()}
                      </div>
                      <span className="text-[9px] text-slate-400">Current Balance</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: Override Execution Terminal */}
        <div className="lg:col-span-7 bg-white border border-purple-100 rounded-3xl p-5 sm:p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-purple-100 pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              <h3 className="font-extrabold text-base text-slate-900">Override Configuration</h3>
            </div>
            {selectedUser && (
              <span className="text-xs font-mono bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-xl">
                Target: {selectedUser.email}
              </span>
            )}
          </div>

          {!selectedUser ? (
            <div className="text-center py-16 space-y-3 border border-dashed border-purple-200 rounded-2xl">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto text-purple-600">
                <UserIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">No User Selected</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Please select a user from the directory on the left to review their balance and configure an override.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleExecuteOverride} className="space-y-5">
              {/* Target User Status Card */}
              <div className="bg-purple-50/50 border border-purple-100 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-purple-600 tracking-wider">Active Account</span>
                  <div className="font-bold text-sm text-slate-900 mt-0.5">{selectedUser.displayName || 'Unnamed User'}</div>
                  <div className="text-xs text-slate-600 font-mono">{selectedUser.email} • UID: <code className="text-[10px] text-slate-500">{selectedUser.uid}</code></div>
                </div>

                <div className="bg-white border border-purple-200 px-4 py-2.5 rounded-xl sm:text-right shrink-0 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Current Balance</span>
                  <div className="text-lg font-black text-purple-700 font-mono">
                    ₦{currentSelectedBalance.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Action Mode Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">Adjustment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAction('set')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                      action === 'set'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-purple-50 text-slate-700 border-purple-200 hover:bg-purple-100'
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
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-purple-50 text-slate-700 border-purple-200 hover:bg-purple-100'
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
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-purple-50 text-slate-700 border-purple-200 hover:bg-purple-100'
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
                  <label className="text-xs font-bold text-slate-800">
                    {action === 'set' ? 'New Target Balance (₦)' : 'Adjustment Amount (₦)'}
                  </label>
                  {action !== 'set' && (
                    <span className="text-[11px] text-slate-500">Quick Presets</span>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-purple-600 font-bold text-sm">₦</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Enter amount..."
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full bg-white border border-purple-200 rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
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
                        className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer"
                      >
                        +₦{p.toLocaleString()}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Real-time Calculation Summary Box */}
              <div className="bg-purple-50/40 border border-purple-100 p-4 rounded-2xl space-y-3">
                <div className="text-[11px] uppercase font-bold text-slate-500">Preview & Impact Summary</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white p-2 rounded-xl border border-purple-100">
                    <span className="text-[10px] text-slate-500">Previous</span>
                    <div className="text-xs font-mono font-bold text-slate-900 mt-0.5">
                      ₦{currentSelectedBalance.toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-white p-2 rounded-xl border border-purple-100">
                    <span className="text-[10px] text-slate-500">Delta</span>
                    <div className="text-xs font-mono font-extrabold mt-0.5 text-purple-700">
                      {balanceDelta > 0 ? `+₦${balanceDelta.toLocaleString()}` : balanceDelta < 0 ? `-₦${Math.abs(balanceDelta).toLocaleString()}` : '₦0'}
                    </div>
                  </div>

                  <div className="bg-white p-2 rounded-xl border border-purple-300">
                    <span className="text-[10px] text-purple-700 font-bold">New Balance</span>
                    <div className="text-xs font-mono font-black text-purple-900 mt-0.5">
                      ₦{previewNewBalance.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Audit Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Reason for Override <span className="text-slate-500 text-[11px]">(Recorded in ledger)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Customer dispute resolution refund, Manual bank wire credit, Correction"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-white border border-purple-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
                />
              </div>

              {/* Feedback Banner */}
              {feedback && (
                <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-200 ${
                  feedback.type === 'success'
                    ? 'bg-purple-50 border-purple-300 text-purple-950'
                    : 'bg-purple-50 border-purple-300 text-purple-950'
                }`}>
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5 flex-1">
                    <p className="font-bold">{feedback.message}</p>
                    {feedback.txId && (
                      <p className="text-[10px] font-mono text-purple-700">Transaction ID: {feedback.txId}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
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
      <div className="bg-white border border-purple-100 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-sm text-slate-900">Recent Admin Override Ledger Records</h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {recentOverrides.length} Ledger Entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-purple-50/70 border-b border-purple-100 text-[10px] text-slate-700 uppercase font-black tracking-wider">
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
            <tbody className="divide-y divide-purple-100/60 font-mono">
              {recentOverrides.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 font-sans text-xs">
                    No manual wallet override records logged yet.
                  </td>
                </tr>
              ) : (
                recentOverrides.slice(0, 10).map((record) => (
                  <tr key={record.id} className="hover:bg-purple-50/40 transition">
                    <td className="p-3 text-[11px] text-slate-600 whitespace-nowrap font-sans">
                      {record.date ? new Date(record.date).toLocaleString() : 'N/A'}
                    </td>
                    <td className="p-3 text-slate-900 font-bold whitespace-nowrap">
                      {record.userEmail || record.userId}
                    </td>
                    <td className="p-3">
                      <span className="text-[9px] px-2 py-0.5 rounded font-black uppercase bg-purple-50 text-purple-700 border border-purple-200">
                        {record.action || record.type}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      ₦{(record.amount || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-slate-600">
                      ₦{(record.previousBalance || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-purple-700 font-bold">
                      ₦{(record.newBalance || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-[11px] text-slate-600 font-sans">
                      {record.adminEmail || 'Azeezmusharaf4@gmail.com'}
                    </td>
                    <td className="p-3 text-[11px] text-slate-600 font-sans max-w-xs truncate">
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
