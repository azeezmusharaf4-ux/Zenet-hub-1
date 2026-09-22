import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { CategoryType, AccountListing, UserProfile } from '../types';
import { isAuthorizedOwner } from '../lib/authorizedOwners';
import { X, PlusCircle, ShieldCheck, Sparkles, Image, Check, AlertCircle, Key, Lock, Eye, EyeOff, Info, Edit, Trash2 } from 'lucide-react';

interface CreateListingModalProps {
  user: User | null;
  userProfile: UserProfile | null;
  onClose: () => void;
  onSubmit: (
    listingData: Omit<AccountListing, 'id' | 'createdAt' | 'sellerId'>,
    inventoryList?: any[]
  ) => Promise<void>;
}

export const CreateListingModal: React.FC<CreateListingModalProps> = ({
  user,
  userProfile,
  onClose,
  onSubmit
}) => {
  const [category, setCategory] = useState<CategoryType>('Facebook');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState<string>('95000');
  const [followers, setFollowers] = useState('');
  const [accountAge, setAccountAge] = useState('3 Years Old');
  const [pva, setPva] = useState(true);
  const [twoFactor, setTwoFactor] = useState(true);
  const [monetized, setMonetized] = useState(false);
  const [warrantyDays, setWarrantyDays] = useState<number>(7);
  const [country, setCountry] = useState('Nigeria');
  const [niche, setNiche] = useState('General / Marketing');
  const [description, setDescription] = useState('');
  const [sellerWhatsapp, setSellerWhatsapp] = useState(userProfile?.whatsapp || '');
  const [sellerTelegram, setSellerTelegram] = useState(userProfile?.telegram || '');
  const [imageUrl, setImageUrl] = useState('');

  // Private Digital Product Details Credentials
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [recoveryInfo, setRecoveryInfo] = useState('');
  const [twoFactorSecretKey, setTwoFactorSecretKey] = useState('');
  const [twoFactorBackupCodes, setTwoFactorBackupCodes] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Multi-stock inventory state
  const [inventoryAccounts, setInventoryAccounts] = useState<any[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [stockInputMode, setStockInputMode] = useState<'bulk' | 'detailed'>('bulk');
  const [bulkStockText, setBulkStockText] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const resetAllFormState = () => {
    setCategory('Facebook');
    setTitle('');
    setPrice('95000');
    setFollowers('');
    setAccountAge('3 Years Old');
    setPva(true);
    setTwoFactor(true);
    setMonetized(false);
    setWarrantyDays(7);
    setCountry('Nigeria');
    setNiche('General / Marketing');
    setDescription('');
    setImageUrl('');
    setAccountEmail('');
    setAccountPassword('');
    setRecoveryInfo('');
    setTwoFactorSecretKey('');
    setTwoFactorBackupCodes('');
    setAdditionalInstructions('');
    setInventoryAccounts([]);
    setEditingIndex(null);
    setBulkStockText('');
    setError('');
  };

  // Check if form has modified/unsaved data
  const hasUnsavedChanges = Boolean(
    title.trim() || 
    price !== '95000' || 
    followers.trim() || 
    description.trim() || 
    accountEmail.trim() || 
    accountPassword.trim() || 
    recoveryInfo.trim() || 
    twoFactorSecretKey.trim() ||
    twoFactorBackupCodes.trim() || 
    additionalInstructions.trim() || 
    bulkStockText.trim() ||
    imageUrl.trim() ||
    monetized ||
    inventoryAccounts.length > 0
  );

  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      setShowCancelConfirm(true);
    } else {
      resetAllFormState();
      onClose();
    }
  };

  // Handle adding bulk stock items (one per line) without replacing existing stock
  const handleAddBulkStock = () => {
    if (!bulkStockText.trim()) {
      alert('Please enter at least one stock item line.');
      return;
    }
    const lines = bulkStockText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) {
      alert('No valid stock lines found.');
      return;
    }

    // Filter out duplicates within the bulk text itself AND against the existing local inventoryAccounts!
    const existingEmails = new Set(inventoryAccounts.map(item => (item.accountEmail || '').toLowerCase().trim()));
    const uniqueLines: string[] = [];
    const duplicateEmailsInBulk = new Set<string>();

    for (const line of lines) {
      let email = line;
      if (line.includes('|')) {
        email = line.split('|')[0].trim();
      } else if (line.includes(':') && !line.startsWith('http')) {
        email = line.split(':')[0].trim();
      }
      const emailLower = email.toLowerCase().trim();
      if (existingEmails.has(emailLower)) {
        duplicateEmailsInBulk.add(email);
      } else {
        existingEmails.add(emailLower);
        uniqueLines.push(line);
      }
    }

    if (duplicateEmailsInBulk.size > 0 && uniqueLines.length === 0) {
      alert(`All accounts in your bulk list are already in the inventory list. Duplicates are not allowed.`);
      return;
    }

    const newItems = uniqueLines.map(line => {
      // Check if line is formatted as email:pass or email|pass
      let email = line;
      let password = '';
      let notes = '';

      if (line.includes('|')) {
        const parts = line.split('|').map(p => p.trim());
        email = parts[0] || line;
        password = parts[1] || '';
        notes = parts.slice(2).join(' | ');
      } else if (line.includes(':') && !line.startsWith('http')) {
        const parts = line.split(':').map(p => p.trim());
        email = parts[0] || line;
        password = parts[1] || '';
        notes = parts.slice(2).join(':');
      }

      return {
        id: 'inv_' + Math.random().toString(36).substr(2, 9),
        accountEmail: email,
        accountPassword: password,
        recoveryInfo: notes,
        delivery_value: line,
        notes: notes,
        twoFactorSecretKey: '',
        twoFactorBackupCodes: '',
        backupCodes: '',
        additionalInstructions: line !== email ? `Original Line: ${line}` : '',
        status: 'Available'
      };
    });

    if (duplicateEmailsInBulk.size > 0) {
      alert(`Ignored ${duplicateEmailsInBulk.size} duplicate account(s) that were already in your inventory list:\n${Array.from(duplicateEmailsInBulk).join(', ')}`);
    }

    setInventoryAccounts(prev => [...prev, ...newItems]);
    setBulkStockText('');
  };

  const handleAddAccountToInventory = () => {
    if (!accountEmail.trim()) {
      alert('Please provide an Email or Username or Delivery Code for the stock item.');
      return;
    }

    const emailLower = accountEmail.trim().toLowerCase();
    const isDuplicate = inventoryAccounts.some((item, index) => 
      index !== editingIndex && (item.accountEmail || '').toLowerCase().trim() === emailLower
    );
    if (isDuplicate) {
      alert('This account email/username is already in your inventory list for this listing. Duplicate accounts are not allowed.');
      return;
    }

    const currentAccount = {
      id: editingIndex !== null ? inventoryAccounts[editingIndex].id : 'inv_' + Math.random().toString(36).substr(2, 9),
      accountEmail: accountEmail.trim(),
      accountPassword: accountPassword.trim(),
      recoveryInfo: recoveryInfo.trim(),
      twoFactorSecretKey: twoFactorSecretKey.trim(),
      twoFactorBackupCodes: twoFactorBackupCodes.trim(),
      backupCodes: twoFactorBackupCodes.trim() || twoFactorSecretKey.trim(),
      additionalInstructions: additionalInstructions.trim(),
      delivery_value: accountEmail.trim() + (accountPassword.trim() ? ` | ${accountPassword.trim()}` : ''),
      status: 'Available'
    };

    if (editingIndex !== null) {
      const updated = [...inventoryAccounts];
      updated[editingIndex] = currentAccount;
      setInventoryAccounts(updated);
      setEditingIndex(null);
    } else {
      setInventoryAccounts([...inventoryAccounts, currentAccount]);
    }

    // Reset inputs for next account
    setAccountEmail('');
    setAccountPassword('');
    setRecoveryInfo('');
    setTwoFactorSecretKey('');
    setTwoFactorBackupCodes('');
    setAdditionalInstructions('');
  };

  const handleEditAccountLocal = (index: number) => {
    const acc = inventoryAccounts[index];
    setEditingIndex(index);
    setAccountEmail(acc.accountEmail || '');
    setAccountPassword(acc.accountPassword || '');
    setRecoveryInfo(acc.recoveryInfo || '');
    setTwoFactorSecretKey(acc.twoFactorSecretKey || '');
    setTwoFactorBackupCodes(acc.twoFactorBackupCodes || acc.backupCodes || '');
    setAdditionalInstructions(acc.additionalInstructions || '');
  };

  const handleRemoveAccountLocal = (index: number) => {
    if (confirm(`Remove Account #${index + 1}?`)) {
      setInventoryAccounts(prev => prev.filter((_, idx) => idx !== index));
      if (editingIndex === index) {
        setEditingIndex(null);
        setAccountEmail('');
        setAccountPassword('');
        setRecoveryInfo('');
        setTwoFactorSecretKey('');
        setTwoFactorBackupCodes('');
        setAdditionalInstructions('');
      } else if (editingIndex !== null && editingIndex > index) {
        setEditingIndex(editingIndex - 1);
      }
    }
  };

  // Default sample images by category
  const defaultImages: Record<CategoryType, string> = {
    Facebook: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80',
    TikTok: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?auto=format&fit=crop&w=800&q=80',
    Instagram: 'https://images.unsplash.com/photo-1611262588024-d12430b98920?auto=format&fit=crop&w=800&q=80',
    Gmail: 'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?auto=format&fit=crop&w=800&q=80',
    'Twitter/X': 'https://images.unsplash.com/photo-1611605698323-b1e992d37a8c?auto=format&fit=crop&w=800&q=80',
    Telegram: 'https://images.unsplash.com/photo-1614680376593-902f749f705c?auto=format&fit=crop&w=800&q=80',
    Discord: 'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?auto=format&fit=crop&w=800&q=80',
    Reddit: 'https://images.unsplash.com/photo-1614680376408-81e91ffe3db7?auto=format&fit=crop&w=800&q=80',
    Snapchat: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&w=800&q=80',
    LinkedIn: 'https://images.unsplash.com/photo-1611944212129-29977ae1398c?auto=format&fit=crop&w=800&q=80',
    Pinterest: 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?auto=format&fit=crop&w=800&q=80',
    Threads: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80',
    WhatsApp: 'https://images.unsplash.com/photo-1614680376593-902f749f705c?auto=format&fit=crop&w=800&q=80',
    YouTube: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&w=800&q=80',
    All: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80',
    Other: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to post an account listing.');
      return;
    }

    if (userProfile?.role === 'buyer') {
      setError('Account restriction: Only verified Sellers and Administrators can post listings on Zenet Hub. Please contact support/admin to upgrade your account role.');
      return;
    }

    if (!title.trim() || !price || Number(price) <= 0) {
      setError('Please provide a valid listing title and price.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Auto-add current typed fields if email is populated but not added yet
      let finalInventory = [...inventoryAccounts];
      if (accountEmail.trim()) {
        const accountId = editingIndex !== null ? inventoryAccounts[editingIndex].id : 'inv_' + Math.random().toString(36).substr(2, 9);
        const currentAccount = {
          id: accountId,
          accountEmail: accountEmail.trim(),
          accountPassword: accountPassword.trim(),
          recoveryInfo: recoveryInfo.trim(),
          twoFactorSecretKey: twoFactorSecretKey.trim(),
          twoFactorBackupCodes: twoFactorBackupCodes.trim(),
          backupCodes: twoFactorBackupCodes.trim() || twoFactorSecretKey.trim(),
          additionalInstructions: additionalInstructions.trim()
        };
        if (editingIndex !== null) {
          finalInventory[editingIndex] = currentAccount;
        } else {
          finalInventory.push(currentAccount);
        }
      }

      const finalInventoryList = finalInventory.map(acc => ({
        id: acc.id,
        status: 'Available' as const,
        accountEmail: acc.accountEmail,
        accountPassword: acc.accountPassword,
        notes: acc.recoveryInfo || '',
        recoveryInfo: acc.recoveryInfo || '',
        twoFactorSecretKey: acc.twoFactorSecretKey || '',
        twoFactorBackupCodes: acc.twoFactorBackupCodes || acc.backupCodes || '',
        backupCodes: acc.twoFactorBackupCodes || acc.backupCodes || '',
        additionalInstructions: acc.additionalInstructions || ''
      }));

      const stockCount = finalInventoryList.filter(acc => acc.status === 'Available').length;

      const inventoryForDoc = finalInventoryList.map(acc => ({
        id: acc.id,
        status: 'Available' as const,
        accountEmail: acc.accountEmail,
        recoveryInfo: acc.recoveryInfo || '',
        additionalInstructions: acc.additionalInstructions || '',
        twoFactorSecretKey: acc.twoFactorSecretKey || '',
        twoFactorBackupCodes: acc.twoFactorBackupCodes || acc.backupCodes || '',
        backupCodes: acc.backupCodes || acc.twoFactorBackupCodes || '',
        soldTo: null,
        orderId: null,
        soldAt: null
      }));

      // Keep single-stock fallback details in digitalProductDetails
      const mainDigitalDetails = finalInventoryList.length > 0 ? {
        accountEmail: finalInventoryList[0].accountEmail,
        accountPassword: finalInventoryList[0].accountPassword,
        recoveryInfo: finalInventoryList[0].recoveryInfo,
        twoFactorSecretKey: finalInventoryList[0].twoFactorSecretKey,
        twoFactorBackupCodes: finalInventoryList[0].twoFactorBackupCodes,
        backupCodes: finalInventoryList[0].backupCodes,
        additionalInstructions: finalInventoryList[0].additionalInstructions
      } : {
        accountEmail: accountEmail.trim(),
        accountPassword: accountPassword.trim(),
        recoveryInfo: recoveryInfo.trim(),
        twoFactorSecretKey: twoFactorSecretKey.trim(),
        twoFactorBackupCodes: twoFactorBackupCodes.trim(),
        backupCodes: twoFactorBackupCodes.trim() || twoFactorSecretKey.trim(),
        additionalInstructions: additionalInstructions.trim()
      };

      await onSubmit({
        title: title.trim(),
        category,
        price: Number(price) || 0,
        followers: followers.trim() || 'N/A',
        accountAge: accountAge.trim() || 'Aged',
        pva,
        monetized,
        twoFactor,
        warrantyDays,
        country: country.trim() || 'Nigeria',
        niche: niche.trim() || 'General',
        description: description.trim() || 'No additional description provided.',
        creatorId: user.uid,
        createdBy: user.uid,
        creatorEmail: user.email || '',
        creatorRole: userProfile?.role || 'admin',
        sellerName: user.displayName || userProfile?.displayName || user.email?.split('@')[0] || 'Market Seller',
        sellerEmail: user.email || '',
        sellerWhatsapp: sellerWhatsapp.trim(),
        sellerTelegram: sellerTelegram.trim(),
        sellerRating: 5.0,
        sellerSalesCount: 1,
        status: stockCount > 0 ? 'active' : 'sold',
        approvalStatus: 'approved',
        featured: false,
        imageUrl: imageUrl.trim(),
        images: imageUrl.trim() ? [imageUrl.trim()] : [],
        badges: [pva ? 'PVA Verified' : '', twoFactor ? '2FA Enabled' : '', monetized ? 'Monetized' : ''].filter(Boolean),
        stock: stockCount > 0 ? stockCount : 1,
        stockCount: stockCount > 0 ? stockCount : 1,
        inventory: inventoryForDoc,
        digitalProductDetails: mainDigitalDetails
      }, finalInventoryList);
      resetAllFormState();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  // RBAC Guard: Only Admins & Owner can list products
  const canManageProducts = userProfile?.role === 'admin' || isAuthorizedOwner(user, userProfile);

  if (!canManageProducts) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white border border-rose-200 rounded-2xl w-full max-w-md p-6 text-center shadow-2xl space-y-4">
          <div className="w-12 h-12 bg-rose-50 border border-rose-200 rounded-full flex items-center justify-center mx-auto text-rose-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-[#0F172A]">Access Restricted</h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Product creation and listing management are strictly reserved for authorized Admin accounts.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-[#5B4DF5] hover:bg-[#4838EE] text-white font-bold py-2.5 px-4 rounded-xl transition cursor-pointer text-xs shadow-sm"
          >
            Return to Marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        className="bg-white border border-[#EBE7F7] rounded-2xl sm:rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-auto max-h-[92vh] flex flex-col relative text-[#0F172A]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="bg-[#F8F7FD] px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#EBE7F7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-[#5B4DF5]" />
            <h2 className="font-extrabold text-[#0F172A] text-base sm:text-lg">List Social Media Account</h2>
          </div>
          <button
            type="button"
            onClick={handleRequestClose}
            className="p-1.5 sm:p-2 text-[#64748B] hover:text-[#0F172A] bg-white border border-[#EBE7F7] rounded-full transition cursor-pointer shadow-2xs"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-5 text-xs sm:text-sm">
          
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Category Picker */}
          <div>
            <label className="block text-[#64748B] font-semibold mb-2">Account Platform Category *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {([
                'Facebook', 'Instagram', 'TikTok', 'YouTube', 'Gmail',
                'Twitter/X', 'Telegram', 'WhatsApp', 'Discord', 'Reddit',
                'Snapchat', 'LinkedIn', 'Pinterest', 'Threads', 'Other'
              ] as CategoryType[]).map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`py-2 px-2.5 rounded-full font-bold border transition text-center text-xs cursor-pointer truncate ${
                    category === cat
                      ? 'bg-[#EDE9FE] text-[#5B4DF5] border-[#5B4DF5] shadow-xs ring-2 ring-[#5B4DF5]/20'
                      : 'bg-[#F8F7FD] text-[#64748B] border-[#EBE7F7] hover:border-[#5B4DF5]/40 hover:text-[#0F172A]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Title & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[#64748B] font-semibold mb-1">Listing Title *</label>
              <input
                type="text"
                placeholder="e.g., Monetized 120K Followers TikTok Account (USA Audience)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-[#F8F7FD] text-[#0F172A] p-2.5 rounded-2xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[#64748B] font-semibold mb-1">Price (₦ Naira) *</label>
              <input
                type="number"
                min="1"
                placeholder="95000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className="w-full bg-[#F8F7FD] text-[#0F172A] p-2.5 rounded-2xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white"
              />
            </div>
          </div>

          {/* Followers / Audience & Account Age */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#64748B] font-semibold mb-1">Followers / Audience / Batch Size</label>
              <input
                type="text"
                placeholder="e.g., 50,000 Followers or 5 Aged Accounts"
                value={followers}
                onChange={(e) => setFollowers(e.target.value)}
                className="w-full bg-[#F8F7FD] text-[#0F172A] p-2.5 rounded-2xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[#64748B] font-semibold mb-1">Account Age / Creation Year</label>
              <input
                type="text"
                placeholder="e.g., 4 Years Old (2020)"
                value={accountAge}
                onChange={(e) => setAccountAge(e.target.value)}
                className="w-full bg-[#F8F7FD] text-[#0F172A] p-2.5 rounded-2xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white"
              />
            </div>
          </div>

          {/* Toggle Flags (PVA, 2FA, Monetized) */}
          <div className="bg-[#F8F7FD] p-4 rounded-3xl border border-[#EBE7F7] space-y-3">
            <span className="block text-xs font-bold text-[#64748B] uppercase">Verification & Security Features</span>
            
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-[#0F172A]">
                <input
                  type="checkbox"
                  checked={pva}
                  onChange={(e) => setPva(e.target.checked)}
                  className="w-4 h-4 rounded bg-white border-[#EBE7F7] text-[#5B4DF5] focus:ring-0"
                />
                <span>Phone Verified (PVA)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-[#0F172A]">
                <input
                  type="checkbox"
                  checked={twoFactor}
                  onChange={(e) => setTwoFactor(e.target.checked)}
                  className="w-4 h-4 rounded bg-white border-[#EBE7F7] text-[#5B4DF5] focus:ring-0"
                />
                <span>2FA Enabled</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-[#0F172A]">
                <input
                  type="checkbox"
                  checked={monetized}
                  onChange={(e) => setMonetized(e.target.checked)}
                  className="w-4 h-4 rounded bg-white border-[#EBE7F7] text-amber-500 focus:ring-0"
                />
                <span>Monetized / Ad Ready</span>
              </label>
            </div>
          </div>

          {/* Country, Niche, Guarantee */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[#64748B] font-semibold mb-1">Target Country</label>
              <input
                type="text"
                placeholder="Nigeria, United States, UK, Global"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-[#F8F7FD] text-[#0F172A] p-2.5 rounded-2xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[#64748B] font-semibold mb-1">Niche / Category</label>
              <input
                type="text"
                placeholder="Gaming, Crypto, Fashion, E-commerce"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="w-full bg-[#F8F7FD] text-[#0F172A] p-2.5 rounded-2xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[#64748B] font-semibold mb-1">Warranty Days</label>
              <select
                value={warrantyDays}
                onChange={(e) => setWarrantyDays(Number(e.target.value))}
                className="w-full bg-[#F8F7FD] text-[#0F172A] p-2.5 rounded-2xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white"
              >
                <option value={3}>3 Days Replacement</option>
                <option value={7}>7 Days Replacement</option>
                <option value={14}>14 Days Replacement</option>
                <option value={30}>30 Days Replacement</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[#64748B] font-semibold mb-1">Account Description & Public Overview *</label>
            <textarea
              rows={3}
              placeholder="Describe account engagement, reach, audience demographics, monetization status, and general highlights for buyers..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#F8F7FD] text-[#0F172A] p-3 rounded-2xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white"
            />
          </div>

          {/* Secure Digital Product Details Section (Multi-Stock Inventory Manager) */}
          <div className="bg-[#F8F7FD] border border-[#EBE7F7] p-4 sm:p-5 rounded-3xl space-y-4 shadow-xs relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EBE7F7] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#EDE9FE] border border-[#DDD6FE] flex items-center justify-center text-[#5B4DF5]">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#0F172A] text-sm flex items-center gap-2">
                    Product Stock / Inventory
                    <span className="bg-white text-[#5B4DF5] border border-[#DDD6FE] text-[10px] px-2 py-0.5 rounded-full uppercase font-bold flex items-center gap-1 shadow-2xs">
                      <Lock className="w-3 h-3 text-[#5B4DF5]" /> Private Escrow
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Each stock item is unique and sold only once to one customer.
                  </p>
                </div>
              </div>

              {/* Stock Count Pill */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="px-3 py-1 bg-white border border-[#DDD6FE] rounded-xl text-[#5B4DF5] text-xs font-black flex items-center gap-1.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-[#5B4DF5] animate-pulse" />
                  <span>Available Stock: {inventoryAccounts.length}</span>
                </div>
              </div>
            </div>

            {/* Privacy Alert Banner */}
            <div className="bg-white border border-[#EBE7F7] p-3 rounded-2xl flex items-start gap-2.5 text-xs text-[#64748B] shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-[#5B4DF5] shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong className="text-[#0F172A] font-bold">Confidential & Encrypted:</strong> Customers never see unused stock. Upon purchase, the server atomically reserves and reveals <span className="text-[#5B4DF5] font-bold">exactly ONE unique item</span> to the buyer.
              </p>
            </div>

            {/* List of currently added accounts in the inventory */}
            {inventoryAccounts.length > 0 && (
              <div className="space-y-2 mb-4 bg-white p-3.5 rounded-2xl border border-[#EBE7F7] shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-black text-[#0F172A] tracking-wider flex items-center gap-1.5">
                    <span>Available Stock Items ({inventoryAccounts.length})</span>
                  </span>
                  <span className="text-[10px] text-[#64748B] font-semibold">
                    1 item sold per customer purchase
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                  {inventoryAccounts.map((item, idx) => (
                    <div 
                      key={item.id}
                      className="bg-[#F8F7FD] border border-[#EBE7F7] hover:border-[#5B4DF5]/40 p-2.5 rounded-xl flex items-center justify-between gap-3 text-xs transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-[#EDE9FE] text-[#5B4DF5] text-[10px] font-black px-2 py-0.5 rounded-md border border-[#DDD6FE]">
                            Item #{idx + 1}
                          </span>
                          <span className="text-[#0F172A] font-mono font-medium truncate max-w-[240px]">
                            {item.accountEmail || item.delivery_value || 'Stock Item'}
                          </span>
                          {item.accountPassword && (
                            <span className="text-[#64748B] font-mono text-[11px]">
                              • pass: ••••••
                            </span>
                          )}
                          {editingIndex === idx && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              Editing
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setStockInputMode('detailed');
                            handleEditAccountLocal(idx);
                          }}
                          className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#EDE9FE] rounded-lg transition cursor-pointer"
                          title="Edit Stock Item"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAccountLocal(idx)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete Stock Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Input Mode Selector */}
            <div className="flex rounded-xl bg-white p-1 border border-[#EBE7F7] shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setStockInputMode('bulk');
                  setEditingIndex(null);
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  stockInputMode === 'bulk'
                    ? 'bg-[#5B4DF5] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <span>Add Items One Per Line (Bulk)</span>
              </button>
              <button
                type="button"
                onClick={() => setStockInputMode('detailed')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  stockInputMode === 'detailed'
                    ? 'bg-[#5B4DF5] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <span>Detailed Credentials Form</span>
              </button>
            </div>

            {/* MODE 1: BULK ONE PER LINE */}
            {stockInputMode === 'bulk' && (
              <div className="bg-white p-3.5 rounded-2xl border border-[#EBE7F7] space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="block text-[#0F172A] text-xs font-bold">
                    Paste Multiple Stock Items (One per line)
                  </label>
                  <span className="text-[10px] text-[#64748B]">
                    Supports code, email:pass, or delivery lines
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={bulkStockText}
                  onChange={(e) => setBulkStockText(e.target.value)}
                  placeholder={`CODE-001\nCODE-002\nCODE-003\nuser@domain.com:password123 | 2FA:JBSWY3DPEHPK3PXP\nacc_login@gmail.com:StrongPass2024!`}
                  className="w-full bg-[#F8F7FD] text-[#0F172A] text-xs font-mono p-3 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white placeholder:text-[#94A3B8]"
                />
                <button
                  type="button"
                  onClick={handleAddBulkStock}
                  className="w-full bg-[#5B4DF5] hover:bg-[#4838EE] text-white font-extrabold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                >
                  <PlusCircle className="w-4 h-4 text-white" />
                  <span>+ Add Line(s) to Stock Inventory (Preserves Existing)</span>
                </button>
              </div>
            )}

            {/* MODE 2: DETAILED FORM */}
            {stockInputMode === 'detailed' && (
              <div className="bg-white p-3.5 rounded-2xl border border-[#EBE7F7] space-y-3.5 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-[#5B4DF5] tracking-wider block">
                  {editingIndex !== null ? `Edit Stock Item #${editingIndex + 1}` : 'Enter Single Stock Item Details'}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#0F172A] text-xs font-bold mb-1">Stock Item Login / Email / Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. CODE-001 or account@gmail.com"
                      value={accountEmail}
                      onChange={(e) => setAccountEmail(e.target.value)}
                      className="w-full bg-[#F8F7FD] text-[#0F172A] text-xs p-2.5 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[#0F172A] text-xs font-bold mb-1">Account Password (If applicable)</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="e.g. AccountPass123!"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        className="w-full bg-[#F8F7FD] text-[#0F172A] text-xs p-2.5 pr-9 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-[#64748B] hover:text-[#0F172A] transition cursor-pointer"
                        title={showPassword ? 'Hide Password' : 'Show Password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[#0F172A] text-xs font-bold mb-1">Recovery Info / Note</label>
                    <input
                      type="text"
                      placeholder="e.g. recovery@gmail.com"
                      value={recoveryInfo}
                      onChange={(e) => setRecoveryInfo(e.target.value)}
                      className="w-full bg-[#F8F7FD] text-[#0F172A] text-xs p-2.5 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[#0F172A] text-xs font-bold mb-1">2FA Secret Key</label>
                    <input
                      type="text"
                      placeholder="e.g. JBSWY3DPEHPK3PXP"
                      value={twoFactorSecretKey}
                      onChange={(e) => setTwoFactorSecretKey(e.target.value)}
                      className="w-full bg-[#F8F7FD] text-[#0F172A] text-xs p-2.5 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[#0F172A] text-xs font-bold mb-1">2FA Backup Codes</label>
                    <input
                      type="text"
                      placeholder="e.g. 1234-5678, 8765-4321..."
                      value={twoFactorBackupCodes}
                      onChange={(e) => setTwoFactorBackupCodes(e.target.value)}
                      className="w-full bg-[#F8F7FD] text-[#0F172A] text-xs p-2.5 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#0F172A] text-xs font-bold mb-1">Additional Transfer Instructions</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Clean IP access instructions, original email access notes..."
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    className="w-full bg-[#F8F7FD] text-[#0F172A] text-xs p-2.5 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleAddAccountToInventory}
                    className="w-full bg-[#EDE9FE] hover:bg-[#DDD6FE] border border-[#DDD6FE] text-[#5B4DF5] font-extrabold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4 text-[#5B4DF5]" />
                    <span>{editingIndex !== null ? '💾 Save Item Changes' : '＋ Add This Item to Stock'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Direct Seller Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#64748B] font-semibold mb-1">WhatsApp Number (Optional)</label>
              <input
                type="text"
                placeholder="e.g. +2348012345678"
                value={sellerWhatsapp}
                onChange={(e) => setSellerWhatsapp(e.target.value)}
                className="w-full bg-[#F8F7FD] text-[#0F172A] p-2.5 rounded-2xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[#64748B] font-semibold mb-1">Telegram Username (Optional)</label>
              <input
                type="text"
                placeholder="e.g. @zenet_seller"
                value={sellerTelegram}
                onChange={(e) => setSellerTelegram(e.target.value)}
                className="w-full bg-[#F8F7FD] text-[#0F172A] p-2.5 rounded-2xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] focus:bg-white"
              />
            </div>
          </div>

          {/* Submit & Cancel Actions */}
          <div className="pt-3 border-t border-[#EBE7F7] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleRequestClose}
              className="px-5 py-3 text-[#64748B] hover:text-[#0F172A] bg-[#F8F7FD] hover:bg-[#F2EFFC] border border-[#EBE7F7] rounded-full font-bold text-xs sm:text-sm transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#5B4DF5] hover:bg-[#4838EE] text-white font-extrabold py-3 rounded-full shadow-md transition cursor-pointer disabled:opacity-50 text-xs sm:text-sm flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{loading ? 'Publishing Listing...' : 'Publish Account Listing'}</span>
            </button>
          </div>

        </form>

        {/* Unsaved Changes Confirmation Dialog */}
        {showCancelConfirm && (
          <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-[#EBE7F7] p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl text-center">
              <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto text-amber-500">
                <AlertCircle className="w-6 h-6" />
              </div>
              
              <div className="space-y-1">
                <h3 className="font-extrabold text-[#0F172A] text-base sm:text-lg">Unsaved Changes</h3>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  You have unsaved changes. Are you sure you want to cancel?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="py-2.5 px-3 bg-[#F8F7FD] hover:bg-[#F2EFFC] text-[#0F172A] border border-[#EBE7F7] rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Continue Editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelConfirm(false);
                    onClose();
                  }}
                  className="py-2.5 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-extrabold text-xs shadow-md transition cursor-pointer"
                >
                  Discard Changes
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
