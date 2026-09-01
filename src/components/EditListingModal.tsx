import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { AccountListing, CategoryType, UserProfile } from '../types';
import { X, Save, Image, Plus, Trash2, Check, ShieldCheck, Sparkles, AlertCircle, Key, Lock, Eye, EyeOff, Edit, PlusCircle, Layers, RefreshCw, CheckCircle2, ShieldAlert, AlertTriangle, Copy } from 'lucide-react';
import { db, storage, sanitizeFirestorePayload } from '../lib/firebase';
import { doc, setDoc, updateDoc, collection, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { processAndCompressImage } from '../lib/imageUtils';

interface EditListingModalProps {
  listing: AccountListing;
  onClose: () => void;
  onSuccess: (updated: Partial<AccountListing>) => void;
  user?: User | null;
  userProfile?: UserProfile | null;
  isOwner?: boolean;
}

interface DuplicateGroup {
  identifier: string;
  items: any[];
  keepItem: any;
  removeItems: any[];
}

export const EditListingModal: React.FC<EditListingModalProps> = ({
  listing,
  onClose,
  onSuccess,
  user,
  userProfile,
  isOwner
}) => {
  // Determine if active user is website Owner or authorized manager
  const isUserOwner = Boolean(
    isOwner ||
    user?.email?.toLowerCase() === 'azeezmusharaf4@gmail.com' ||
    userProfile?.role === 'owner' ||
    userProfile?.email?.toLowerCase() === 'azeezmusharaf4@gmail.com'
  );

  const creatorId = listing.creatorId || listing.createdBy || listing.sellerId || listing.owner_id;
  const creatorEmail = (listing.creatorEmail || listing.sellerEmail || '').toLowerCase();
  const currentEmail = (user?.email || '').toLowerCase();
  const isProductCreator = Boolean(user && (creatorId === user.uid || (!!currentEmail && !!creatorEmail && creatorEmail === currentEmail)));

  const canManageStock = Boolean(
    isUserOwner || isProductCreator
  );

  const [title, setTitle] = useState(listing.title);
  const [category, setCategory] = useState<CategoryType>(listing.category);
  const [price, setPrice] = useState<string>(String(listing.price));
  const [followers, setFollowers] = useState(listing.followers || '');
  const [accountAge, setAccountAge] = useState(listing.accountAge || '');
  const [pva, setPva] = useState(listing.pva);
  const [twoFactor, setTwoFactor] = useState(listing.twoFactor);
  const [monetized, setMonetized] = useState(listing.monetized || false);
  const [warrantyDays, setWarrantyDays] = useState<number>(listing.warrantyDays || 7);
  const [country, setCountry] = useState(listing.country || 'Nigeria');
  const [niche, setNiche] = useState(listing.niche || 'General');
  const [description, setDescription] = useState(listing.description);
  const [status, setStatus] = useState<'active' | 'sold' | 'reserved'>(listing.status || 'active');
  const [imageUrl, setImageUrl] = useState(listing.imageUrl || '');
  const [images, setImages] = useState<string[]>(
    listing.images && listing.images.length > 0 ? listing.images : (listing.imageUrl ? [listing.imageUrl] : [])
  );
  const [newImageUrl, setNewImageUrl] = useState('');

  // Digital Product Details input fields for adding or editing single stock items (initialized blank)
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [recoveryInfo, setRecoveryInfo] = useState('');
  const [twoFactorSecretKey, setTwoFactorSecretKey] = useState('');
  const [twoFactorBackupCodes, setTwoFactorBackupCodes] = useState('');
  const [backupCodes, setBackupCodes] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Multi-stock inventory state
  const [inventoryAccounts, setInventoryAccounts] = useState<any[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deletedAccountIds, setDeletedAccountIds] = useState<string[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [stockInputMode, setStockInputMode] = useState<'bulk' | 'detailed'>('bulk');
  const [bulkStockText, setBulkStockText] = useState('');
  const [stockFilterTab, setStockFilterTab] = useState<'all' | 'available' | 'sold'>('available');

  // Custom non-blocking iframe-safe notification and password reveal states
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);
  const [modalNotification, setModalNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const triggerNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    setModalNotification({ type, message });
    setTimeout(() => {
      setModalNotification(prev => prev?.message === message ? null : prev);
    }, 6000);
  };

  // Duplicate stock cleanup modal states
  const [showDuplicateCleanupModal, setShowDuplicateCleanupModal] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);
  const [cleanSuccessMessage, setCleanSuccessMessage] = useState('');

  // Normalize login / email / username identifier
  const getAccountIdentifier = (item: { accountEmail?: string; delivery_value?: string; [key: string]: any }): string => {
    let raw = (item.accountEmail || item.delivery_value || '').trim();
    if (raw.includes('|')) {
      raw = raw.split('|')[0].trim();
    } else if (raw.includes(':') && !raw.startsWith('http')) {
      raw = raw.split(':')[0].trim();
    }
    return raw.toLowerCase();
  };

  // Group inventory items by identifier to detect duplicates
  const findDuplicateGroups = (items: any[]): DuplicateGroup[] => {
    const map = new Map<string, any[]>();
    for (const item of items) {
      const ident = getAccountIdentifier(item);
      if (!ident) continue;
      if (!map.has(ident)) {
        map.set(ident, []);
      }
      map.get(ident)!.push(item);
    }

    const groups: DuplicateGroup[] = [];
    map.forEach((itemList, ident) => {
      if (itemList.length > 1) {
        // Keep sold item if present, else keep item with password or most complete info or oldest existing item
        let keepItem = itemList.find(i => (i.status || '').toLowerCase() === 'sold');
        if (!keepItem) {
          keepItem = itemList.find(i => (i.accountPassword && i.accountPassword.trim().length > 0) || i.twoFactorSecretKey) || itemList[0];
        }
        const removeItems = itemList.filter(i => i.id !== keepItem.id);
        groups.push({
          identifier: ident,
          items: itemList,
          keepItem,
          removeItems
        });
      }
    });

    return groups;
  };

  useEffect(() => {
    async function loadInventory() {
      setLoadingInventory(true);
      try {
        const colRef = collection(db, 'listings', listing.id, 'inventory');
        const snap = await getDocs(colRef);
        let items: any[] = [];
        if (!snap.empty) {
          items = await Promise.all(snap.docs.map(async (inventoryDoc) => {
            const itemData = inventoryDoc.data();
            let secureData: any = {};
            try {
              const secureRef = doc(db, 'listings', listing.id, 'inventory', inventoryDoc.id, 'secure', 'details');
              const secureSnap = await getDoc(secureRef);
              if (secureSnap.exists()) {
                secureData = secureSnap.data();
              }
            } catch (err) {
              console.warn('Failed to load secure info for', inventoryDoc.id, err);
            }
            const rawStatus = (itemData.status || '').toLowerCase();
            const normalizedStatus = (rawStatus === 'sold' || itemData.status === 'Sold') ? 'Sold' : 'Available';
            return {
              id: inventoryDoc.id,
              status: normalizedStatus,
              accountEmail: secureData.accountEmail || itemData.accountEmail || '',
              accountPassword: secureData.accountPassword || itemData.accountPassword || '',
              recoveryInfo: secureData.recoveryInfo || secureData.notes || itemData.recoveryInfo || '',
              twoFactorSecretKey: secureData.twoFactorSecretKey || itemData.twoFactorSecretKey || '',
              twoFactorBackupCodes: secureData.twoFactorBackupCodes || secureData.backupCodes || itemData.twoFactorBackupCodes || '',
              backupCodes: secureData.twoFactorBackupCodes || secureData.backupCodes || itemData.backupCodes || '',
              additionalInstructions: secureData.additionalInstructions || itemData.additionalInstructions || '',
              delivery_value: secureData.accountEmail || itemData.accountEmail || '',
              soldTo: itemData.soldTo || null,
              orderId: itemData.orderId || null,
              soldAt: itemData.soldAt || null
            };
          }));
        } else if (Array.isArray(listing.inventory) && listing.inventory.length > 0) {
          items = listing.inventory.map((item, idx) => {
            const rawStatus = (item.status || '').toLowerCase();
            const normalizedStatus = (rawStatus === 'sold' || item.status === 'Sold') ? 'Sold' : 'Available';
            return {
              id: item.id || `inv_${idx + 1}`,
              status: normalizedStatus,
              accountEmail: item.accountEmail || '',
              accountPassword: item.accountPassword || '',
              recoveryInfo: item.recoveryInfo || item.notes || '',
              twoFactorSecretKey: item.twoFactorSecretKey || '',
              twoFactorBackupCodes: item.twoFactorBackupCodes || item.backupCodes || '',
              backupCodes: item.backupCodes || item.twoFactorBackupCodes || '',
              additionalInstructions: item.additionalInstructions || '',
              delivery_value: item.accountEmail || '',
              soldTo: item.soldTo || null,
              orderId: item.orderId || null,
              soldAt: item.soldAt || null
            };
          });
        } else if (listing.digitalProductDetails?.accountEmail) {
          items = [{
            id: 'inv_1',
            status: 'Available',
            accountEmail: listing.digitalProductDetails.accountEmail || '',
            accountPassword: listing.digitalProductDetails.accountPassword || '',
            recoveryInfo: listing.digitalProductDetails.recoveryInfo || '',
            twoFactorSecretKey: listing.digitalProductDetails.twoFactorSecretKey || '',
            twoFactorBackupCodes: listing.digitalProductDetails.twoFactorBackupCodes || listing.digitalProductDetails.backupCodes || '',
            backupCodes: listing.digitalProductDetails.backupCodes || '',
            additionalInstructions: listing.digitalProductDetails.additionalInstructions || '',
            delivery_value: listing.digitalProductDetails.accountEmail || '',
            soldTo: null,
            orderId: null,
            soldAt: null
          }];
        }
        setInventoryAccounts(items);
      } catch (err) {
        console.error('Failed to load inventory:', err);
      } finally {
        setLoadingInventory(false);
      }
    }
    loadInventory();
  }, [listing.id]);

  // Handle adding bulk stock items (one per line) with duplicate prevention
  const handleAddBulkStock = async () => {
    if (!bulkStockText.trim()) {
      triggerNotification('error', 'Please enter at least one stock item line.');
      return;
    }
    const lines = bulkStockText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) {
      triggerNotification('error', 'No valid stock lines found.');
      return;
    }

    const existingIdents = new Set(inventoryAccounts.map(i => getAccountIdentifier(i)));
    const seenInBatch = new Set<string>();
    const validNewItems: any[] = [];
    let skippedDuplicatesCount = 0;

    for (const line of lines) {
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

      const ident = getAccountIdentifier({ accountEmail: email, delivery_value: line });
      if (!ident) continue;

      if (existingIdents.has(ident) || seenInBatch.has(ident)) {
        skippedDuplicatesCount++;
        continue;
      }

      seenInBatch.add(ident);
      existingIdents.add(ident);

      validNewItems.push({
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
        status: 'Available',
        soldTo: null,
        orderId: null,
        soldAt: null
      });
    }

    if (validNewItems.length === 0) {
      triggerNotification('warning', `Duplicate Warning: All ${lines.length} lines were duplicates of existing stock or appeared multiple times in your input. No duplicate items were added.`);
      return;
    }

    const nextInventory = [...inventoryAccounts, ...validNewItems];
    setInventoryAccounts(nextInventory);
    setBulkStockText('');
    setStockFilterTab('available');

    // Instant real-time database sync
    try {
      const unusedCount = nextInventory.filter(acc => (acc.status || '').toLowerCase() !== 'sold').length;
      for (const item of validNewItems) {
        const itemRef = doc(db, 'listings', listing.id, 'inventory', item.id);
        const secureRef = doc(db, 'listings', listing.id, 'inventory', item.id, 'secure', 'details');
        await setDoc(itemRef, {
          id: item.id,
          status: 'Available',
          soldTo: null,
          orderId: null,
          soldAt: null,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        await setDoc(secureRef, {
          id: item.id,
          accountEmail: item.accountEmail || '',
          accountPassword: item.accountPassword || '',
          notes: item.recoveryInfo || '',
          recoveryInfo: item.recoveryInfo || '',
          twoFactorSecretKey: item.twoFactorSecretKey || '',
          twoFactorBackupCodes: item.twoFactorBackupCodes || '',
          additionalInstructions: item.additionalInstructions || '',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      const cleanedInventoryForDoc = nextInventory.map(item => ({
        id: item.id,
        status: item.status || 'Available',
        accountEmail: item.accountEmail || '',
        recoveryInfo: item.recoveryInfo || '',
        additionalInstructions: item.additionalInstructions || '',
        twoFactorSecretKey: item.twoFactorSecretKey || '',
        twoFactorBackupCodes: item.twoFactorBackupCodes || item.backupCodes || '',
        backupCodes: item.backupCodes || item.twoFactorBackupCodes || '',
        soldTo: item.soldTo || null,
        orderId: item.orderId || null,
        soldAt: item.soldAt || null
      }));

      await updateDoc(doc(db, 'listings', listing.id), {
        stock: unusedCount,
        stockCount: unusedCount,
        status: unusedCount > 0 ? (status === 'reserved' ? 'reserved' : 'active') : 'sold',
        inventory: cleanedInventoryForDoc
      });

      if (onSuccess) {
        onSuccess({
          stock: unusedCount,
          stockCount: unusedCount,
          status: unusedCount > 0 ? (status === 'reserved' ? 'reserved' : 'active') : 'sold',
          inventory: cleanedInventoryForDoc
        });
      }
    } catch (autoErr) {
      console.warn('Auto-save bulk stock notice:', autoErr);
    }

    if (skippedDuplicatesCount > 0) {
      triggerNotification('success', `Added & saved ${validNewItems.length} unique accounts (Total: ${nextInventory.filter(i => (i.status||'').toLowerCase() !== 'sold').length} in stock). ${skippedDuplicatesCount} duplicates skipped.`);
    } else {
      triggerNotification('success', `Added & saved ${validNewItems.length} new stock items! Total stock is now ${nextInventory.filter(i => (i.status||'').toLowerCase() !== 'sold').length}.`);
    }
  };

  const handleAddAccountToInventory = async () => {
    if (!accountEmail.trim()) {
      triggerNotification('error', 'Please provide an Email or Username or Delivery Code for the stock item.');
      return;
    }

    const normEmail = getAccountIdentifier({ accountEmail });
    
    // Check for duplicate login/email identifier in existing stock list
    const duplicateFound = inventoryAccounts.some((item, idx) => {
      if (editingIndex !== null && idx === editingIndex) return false;
      return getAccountIdentifier(item) === normEmail;
    });

    if (duplicateFound) {
      triggerNotification('error', `Duplicate Prevented: Account "${accountEmail.trim()}" is already in this product's inventory. Duplicate accounts cannot be added.`);
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
      status: editingIndex !== null ? (inventoryAccounts[editingIndex].status || 'Available') : 'Available',
      soldTo: editingIndex !== null ? inventoryAccounts[editingIndex].soldTo : null,
      orderId: editingIndex !== null ? inventoryAccounts[editingIndex].orderId : null,
      soldAt: editingIndex !== null ? inventoryAccounts[editingIndex].soldAt : null
    };

    let nextInventory: any[];
    if (editingIndex !== null) {
      nextInventory = [...inventoryAccounts];
      nextInventory[editingIndex] = currentAccount;
      setEditingIndex(null);
    } else {
      nextInventory = [...inventoryAccounts, currentAccount];
    }
    setInventoryAccounts(nextInventory);

    // Instant real-time database sync
    try {
      const unusedCount = nextInventory.filter(acc => (acc.status || '').toLowerCase() !== 'sold').length;
      const itemRef = doc(db, 'listings', listing.id, 'inventory', currentAccount.id);
      const secureRef = doc(db, 'listings', listing.id, 'inventory', currentAccount.id, 'secure', 'details');

      await setDoc(itemRef, {
        id: currentAccount.id,
        status: currentAccount.status,
        soldTo: currentAccount.soldTo || null,
        orderId: currentAccount.orderId || null,
        soldAt: currentAccount.soldAt || null,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await setDoc(secureRef, {
        id: currentAccount.id,
        accountEmail: currentAccount.accountEmail || '',
        accountPassword: currentAccount.accountPassword || '',
        notes: currentAccount.recoveryInfo || '',
        recoveryInfo: currentAccount.recoveryInfo || '',
        twoFactorSecretKey: currentAccount.twoFactorSecretKey || '',
        twoFactorBackupCodes: currentAccount.twoFactorBackupCodes || '',
        additionalInstructions: currentAccount.additionalInstructions || '',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      const cleanedInventoryForDoc = nextInventory.map(item => ({
        id: item.id,
        status: item.status || 'Available',
        accountEmail: item.accountEmail || '',
        recoveryInfo: item.recoveryInfo || '',
        additionalInstructions: item.additionalInstructions || '',
        twoFactorSecretKey: item.twoFactorSecretKey || '',
        twoFactorBackupCodes: item.twoFactorBackupCodes || item.backupCodes || '',
        backupCodes: item.backupCodes || item.twoFactorBackupCodes || '',
        soldTo: item.soldTo || null,
        orderId: item.orderId || null,
        soldAt: item.soldAt || null
      }));

      await updateDoc(doc(db, 'listings', listing.id), {
        stock: unusedCount,
        stockCount: unusedCount,
        status: unusedCount > 0 ? (status === 'reserved' ? 'reserved' : 'active') : 'sold',
        inventory: cleanedInventoryForDoc
      });

      if (onSuccess) {
        onSuccess({
          stock: unusedCount,
          stockCount: unusedCount,
          status: unusedCount > 0 ? (status === 'reserved' ? 'reserved' : 'active') : 'sold',
          inventory: cleanedInventoryForDoc
        });
      }
    } catch (autoErr) {
      console.warn('Auto-save single stock notice:', autoErr);
    }

    triggerNotification('success', `Saved stock item to database! (Total stock: ${nextInventory.filter(i => (i.status||'').toLowerCase() !== 'sold').length})`);

    // Reset inputs
    setAccountEmail('');
    setAccountPassword('');
    setRecoveryInfo('');
    setTwoFactorSecretKey('');
    setTwoFactorBackupCodes('');
    setBackupCodes('');
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
    setBackupCodes(acc.twoFactorBackupCodes || acc.backupCodes || '');
    setAdditionalInstructions(acc.additionalInstructions || '');
  };

  const handleRemoveAccountLocal = async (index: number) => {
    const acc = inventoryAccounts[index];
    if (!acc) return;

    // Check manager / owner permissions
    if (!canManageStock) {
      triggerNotification('error', 'Access Denied: You do not have permission to delete stock accounts from this listing.');
      return;
    }

    const isSold = (acc.status || '').toLowerCase() === 'sold';
    if (isSold) {
      triggerNotification('error', 'Cannot delete this stock item because it has already been sold to a customer.');
      return;
    }
    const itemLabel = acc.accountEmail || acc.delivery_value || `Stock Item #${index + 1}`;

    const itemId = acc.id;
    const remaining = inventoryAccounts.filter((_, idx) => idx !== index);
    setInventoryAccounts(remaining);
    if (itemId) {
      setDeletedAccountIds(prev => [...prev, itemId]);
    }
    if (editingIndex === index) {
      setEditingIndex(null);
      setAccountEmail('');
      setAccountPassword('');
      setRecoveryInfo('');
      setTwoFactorSecretKey('');
      setTwoFactorBackupCodes('');
      setBackupCodes('');
      setAdditionalInstructions('');
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }

    // Direct, immediate, permanent database deletion from Firestore
    try {
      if (listing.id && itemId) {
        // 1. Delete secure details subcollection doc
        try {
          const secureRef = doc(db, 'listings', listing.id, 'inventory', itemId, 'secure', 'details');
          await deleteDoc(secureRef);
        } catch (e) {
          console.warn('Direct delete secure doc notice:', e);
        }

        // 2. Delete inventory subcollection doc
        try {
          const itemRef = doc(db, 'listings', listing.id, 'inventory', itemId);
          await deleteDoc(itemRef);
        } catch (e) {
          console.warn('Direct delete inventory doc notice:', e);
        }

        // 3. Update parent listing doc in Firestore (stock, stockCount, status, and clean inventory array)
        const unusedCount = remaining.filter(item => (item.status || '').toLowerCase() !== 'sold').length;
        const cleanedInventoryForDoc = remaining.map(item => ({
          id: item.id,
          status: item.status || 'Available',
          accountEmail: item.accountEmail || '',
          recoveryInfo: item.recoveryInfo || '',
          additionalInstructions: item.additionalInstructions || '',
          twoFactorSecretKey: item.twoFactorSecretKey || '',
          twoFactorBackupCodes: item.twoFactorBackupCodes || item.backupCodes || '',
          backupCodes: item.backupCodes || item.twoFactorBackupCodes || '',
          soldTo: item.soldTo || null,
          orderId: item.orderId || null,
          soldAt: item.soldAt || null
        }));

        await updateDoc(doc(db, 'listings', listing.id), {
          stock: unusedCount,
          stockCount: unusedCount,
          status: unusedCount > 0 ? (status === 'reserved' ? 'reserved' : 'active') : 'sold',
          inventory: cleanedInventoryForDoc
        });

        if (onSuccess) {
          onSuccess({
            stock: unusedCount,
            stockCount: unusedCount,
            status: unusedCount > 0 ? (status === 'reserved' ? 'reserved' : 'active') : 'sold',
            inventory: cleanedInventoryForDoc
          });
        }
      }
    } catch (dbErr) {
      console.error('Error during immediate database deletion of stock item:', dbErr);
    }
  };

  // Trigger duplicate detection and open Owner Preview Modal
  const handleScanDuplicates = () => {
    if (!canManageStock) {
      triggerNotification('error', 'Access Denied: You do not have permission to perform duplicate cleanup.');
      return;
    }
    const groups = findDuplicateGroups(inventoryAccounts);
    if (groups.length === 0) {
      triggerNotification('success', `No duplicates found! All ${inventoryAccounts.length} stock items in this product have unique login/email identifiers.`);
      return;
    }
    setDuplicateGroups(groups);
    setShowDuplicateCleanupModal(true);
  };

  // Permanently delete duplicate records from Firestore
  const handleExecuteDuplicateCleanup = async () => {
    if (!canManageStock) {
      triggerNotification('error', 'Access Denied: You are not authorized to clean duplicate stock.');
      return;
    }
    setIsCleaningDuplicates(true);
    try {
      const removeIds: string[] = [];
      duplicateGroups.forEach(g => {
        g.removeItems.forEach(r => {
          if (r.id) removeIds.push(r.id);
        });
      });

      const removeSet = new Set(removeIds);
      const updatedInventory = inventoryAccounts.filter(item => !removeSet.has(item.id));

      // 1. Delete duplicate documents permanently from Firestore subcollection
      for (const delId of removeIds) {
        try {
          const secureRef = doc(db, 'listings', listing.id, 'inventory', delId, 'secure', 'details');
          await deleteDoc(secureRef);
        } catch (e) {
          console.warn('Direct delete secure duplicate notice:', delId, e);
        }
        try {
          const itemRef = doc(db, 'listings', listing.id, 'inventory', delId);
          await deleteDoc(itemRef);
        } catch (e) {
          console.warn('Direct delete duplicate item doc notice:', delId, e);
        }
      }

      // 2. Recalculate stock and update parent listing document in Firestore
      const unusedCount = updatedInventory.filter(item => (item.status || '').toLowerCase() !== 'sold').length;
      const cleanedInventoryForDoc = updatedInventory.map(item => ({
        id: item.id,
        status: item.status || 'Available',
        accountEmail: item.accountEmail || '',
        recoveryInfo: item.recoveryInfo || item.notes || '',
        additionalInstructions: item.additionalInstructions || '',
        twoFactorSecretKey: item.twoFactorSecretKey || '',
        twoFactorBackupCodes: item.twoFactorBackupCodes || item.backupCodes || '',
        backupCodes: item.backupCodes || item.twoFactorBackupCodes || '',
        soldTo: item.soldTo || null,
        orderId: item.orderId || null,
        soldAt: item.soldAt || null
      }));

      await updateDoc(doc(db, 'listings', listing.id), {
        stock: unusedCount,
        stockCount: unusedCount,
        status: unusedCount > 0 ? (status === 'reserved' ? 'reserved' : 'active') : 'sold',
        inventory: cleanedInventoryForDoc
      });

      // 3. Update local state
      setInventoryAccounts(updatedInventory);
      setDeletedAccountIds(prev => [...prev, ...removeIds]);

      if (onSuccess) {
        onSuccess({
          stock: unusedCount,
          stockCount: unusedCount,
          status: unusedCount > 0 ? (status === 'reserved' ? 'reserved' : 'active') : 'sold',
          inventory: cleanedInventoryForDoc
        });
      }

      const totalRemoved = removeIds.length;
      setShowDuplicateCleanupModal(false);
      setCleanSuccessMessage(`Cleaned ${totalRemoved} duplicate stock records. Kept 1 copy for each unique account (${updatedInventory.length} total remaining).`);
      setTimeout(() => setCleanSuccessMessage(''), 8000);
    } catch (cleanErr: any) {
      console.error('Error executing duplicate cleanup:', cleanErr);
      triggerNotification('error', `Cleanup failed: ${cleanErr?.message || 'Please try again.'}`);
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Check if any core listing fields differ from initial listing prop
  const hasUnsavedChanges = Boolean(
    title.trim() !== listing.title.trim() ||
    category !== listing.category ||
    price !== String(listing.price) ||
    followers.trim() !== (listing.followers || '').trim() ||
    accountAge.trim() !== (listing.accountAge || '').trim() ||
    pva !== listing.pva ||
    twoFactor !== listing.twoFactor ||
    monetized !== (listing.monetized || false) ||
    warrantyDays !== (listing.warrantyDays || 7) ||
    country.trim() !== (listing.country || 'Nigeria').trim() ||
    niche.trim() !== (listing.niche || 'General').trim() ||
    description.trim() !== (listing.description || '').trim() ||
    deletedAccountIds.length > 0 ||
    bulkStockText.trim().length > 0
  );

  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      setShowCancelConfirm(true);
    } else {
      onClose();
    }
  };

  // Sample image presets by category
  const defaultCategoryImages: Record<CategoryType, string[]> = {
    Facebook: [
      'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80'
    ],
    TikTok: [
      'https://images.unsplash.com/photo-1611605698335-8b1569810432?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1598550476439-6847785fcea6?auto=format&fit=crop&w=800&q=80'
    ],
    Instagram: [
      'https://images.unsplash.com/photo-1611262588024-d12430b98920?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80'
    ],
    Gmail: [
      'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80'
    ],
    'Twitter/X': [
      'https://images.unsplash.com/photo-1611605698323-b1e992d37a8c?auto=format&fit=crop&w=800&q=80'
    ],
    Telegram: [
      'https://images.unsplash.com/photo-1614680376593-902f749f705c?auto=format&fit=crop&w=800&q=80'
    ],
    Discord: [
      'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?auto=format&fit=crop&w=800&q=80'
    ],
    Reddit: [
      'https://images.unsplash.com/photo-1614680376408-81e91ffe3db7?auto=format&fit=crop&w=800&q=80'
    ],
    Snapchat: [
      'https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&w=800&q=80'
    ],
    LinkedIn: [
      'https://images.unsplash.com/photo-1611944212129-29977ae1398c?auto=format&fit=crop&w=800&q=80'
    ],
    Pinterest: [
      'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?auto=format&fit=crop&w=800&q=80'
    ],
    Threads: [
      'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80'
    ],
    WhatsApp: [
      'https://images.unsplash.com/photo-1614680376593-902f749f705c?auto=format&fit=crop&w=800&q=80'
    ],
    YouTube: [
      'https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&w=800&q=80'
    ],
    All: [
      'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80'
    ],
    Other: [
      'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80'
    ]
  };

  const handleAddImage = (urlToAdd?: string) => {
    const target = (urlToAdd || newImageUrl).trim();
    if (!target) return;
    if (images.includes(target)) {
      setNewImageUrl('');
      return;
    }
    const updated = [...images, target];
    setImages(updated);
    if (!imageUrl) {
      setImageUrl(target);
    }
    setNewImageUrl('');
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const updated = images.filter((_, idx) => idx !== indexToRemove);
    setImages(updated);
    if (updated.length > 0) {
      setImageUrl(updated[0]);
    } else {
      setImageUrl('');
    }
  };

  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    setImageUploadError('');

    try {
      for (const file of Array.from(files) as File[]) {
        if (!file.type.startsWith('image/')) continue;

        // 1. Instant compressed preview (< 30ms)
        const compressedDataUrl = await processAndCompressImage(file, {
          maxWidth: 800,
          maxHeight: 800,
          quality: 0.82
        });

        // Show immediately in gallery
        handleAddImage(compressedDataUrl);

        // 2. Background storage upload with timeout
        try {
          const response = await fetch(compressedDataUrl);
          const blob = await response.blob();
          const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const fileRef = ref(storage, `product-images/${listing.id}/${Date.now()}_${cleanName}`);
          
          const uploadPromise = uploadBytes(fileRef, blob).then((snap) => getDownloadURL(snap.ref));
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
          const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);

          if (downloadUrl && typeof downloadUrl === 'string') {
            setImages((prev) => prev.map((img) => (img === compressedDataUrl ? downloadUrl : img)));
            setImageUrl((prev) => (prev === compressedDataUrl ? downloadUrl : prev));
          }
        } catch (storageErr) {
          console.warn('Storage sync fallback to compressed image:', storageErr);
        }
      }
    } catch (err: any) {
      console.error('Image upload error:', err);
      setImageUploadError(err.message || 'Failed to process image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageStock) {
      setError('Permission Denied: Admins can only edit products that they personally created.');
      return;
    }
    if (!title.trim() || !price || Number(price) <= 0) {
      setError('Please provide a valid listing title and positive price.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Build inventory list from current inventory state, applying editingIndex changes if user was editing an existing item
      let finalInventory = [...inventoryAccounts];
      if (editingIndex !== null && accountEmail.trim()) {
        const accountId = inventoryAccounts[editingIndex].id;
        finalInventory[editingIndex] = {
          id: accountId,
          accountEmail: accountEmail.trim(),
          accountPassword: accountPassword.trim(),
          recoveryInfo: recoveryInfo.trim(),
          twoFactorSecretKey: twoFactorSecretKey.trim(),
          twoFactorBackupCodes: twoFactorBackupCodes.trim(),
          backupCodes: twoFactorBackupCodes.trim() || twoFactorSecretKey.trim(),
          additionalInstructions: additionalInstructions.trim(),
          status: inventoryAccounts[editingIndex].status || 'Available',
          soldTo: inventoryAccounts[editingIndex].soldTo || null,
          orderId: inventoryAccounts[editingIndex].orderId || null,
          soldAt: inventoryAccounts[editingIndex].soldAt || null
        };
      }

      // Normalize all statuses to strictly 'Available' or 'Sold'
      finalInventory = finalInventory.map(item => {
        const isSold = (item.status || '').toLowerCase() === 'sold' || item.status === 'Sold';
        return {
          ...item,
          status: isSold ? 'Sold' : 'Available'
        };
      });

      // Calculate stock using ONLY available inventory:
      // stockCount = inventory.filter(acc => acc.status === 'Available').length
      const stockCount = finalInventory.filter(acc => acc.status === 'Available').length;

      // 1. Process deletions and clean up unreferenced subcollections
      const finalItemIds = new Set(finalInventory.map(item => item.id));
      try {
        const existingSubSnap = await getDocs(collection(db, 'listings', listing.id, 'inventory'));
        for (const subDoc of existingSubSnap.docs) {
          if (!finalItemIds.has(subDoc.id) || deletedAccountIds.includes(subDoc.id)) {
            try {
              const secureRef = doc(db, 'listings', listing.id, 'inventory', subDoc.id, 'secure', 'details');
              await deleteDoc(secureRef);
            } catch {}
            try {
              await deleteDoc(subDoc.ref);
            } catch {}
          }
        }
      } catch (colErr) {
        console.warn('Subcollection cleanup warning:', colErr);
      }

      for (const delId of deletedAccountIds) {
        if (delId) {
          try {
            const secureRef = doc(db, 'listings', listing.id, 'inventory', delId, 'secure', 'details');
            await deleteDoc(secureRef);
            const itemRef = doc(db, 'listings', listing.id, 'inventory', delId);
            await deleteDoc(itemRef);
          } catch (delErr) {
            console.error('Error deleting inventory item:', delId, delErr);
          }
        }
      }

      // 2. Save active inventory accounts into subcollection
      for (const item of finalInventory) {
        const itemId = item.id || 'inv_' + Math.random().toString(36).substr(2, 9);
        const itemRef = doc(db, 'listings', listing.id, 'inventory', itemId);
        const secureRef = doc(db, 'listings', listing.id, 'inventory', itemId, 'secure', 'details');

        // Save public/meta item document
        await setDoc(itemRef, {
          id: itemId,
          status: item.status, // 'Available' or 'Sold'
          soldTo: item.soldTo || null,
          orderId: item.orderId || null,
          soldAt: item.soldAt || null,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // Save secure item details
        await setDoc(secureRef, {
          id: itemId,
          accountEmail: item.accountEmail || '',
          accountPassword: item.accountPassword || '',
          notes: item.recoveryInfo || '',
          recoveryInfo: item.recoveryInfo || '',
          twoFactorSecretKey: item.twoFactorSecretKey || '',
          twoFactorBackupCodes: item.twoFactorBackupCodes || item.backupCodes || '',
          backupCodes: item.twoFactorBackupCodes || item.backupCodes || '',
          additionalInstructions: item.additionalInstructions || '',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // 3. Clean inventory array for parent listing doc
      const inventoryForDoc = finalInventory.map(item => ({
        id: item.id,
        status: item.status, // 'Available' or 'Sold'
        accountEmail: item.accountEmail || '',
        recoveryInfo: item.recoveryInfo || '',
        additionalInstructions: item.additionalInstructions || '',
        twoFactorSecretKey: item.twoFactorSecretKey || '',
        twoFactorBackupCodes: item.twoFactorBackupCodes || item.backupCodes || '',
        backupCodes: item.backupCodes || item.twoFactorBackupCodes || '',
        soldTo: item.soldTo || null,
        orderId: item.orderId || null,
        soldAt: item.soldAt || null
      }));

      const mainImg = imageUrl.trim() || (images.length > 0 ? images[0] : defaultCategoryImages[category][0]);

      // Fallback single-stock details for backwards compatibility
      const firstAvailable = finalInventory.find(acc => acc.status === 'Available') || finalInventory[0];
      const mainDigitalDetails = firstAvailable ? {
        accountEmail: firstAvailable.accountEmail || '',
        accountPassword: firstAvailable.accountPassword || '',
        recoveryInfo: firstAvailable.recoveryInfo || '',
        twoFactorSecretKey: firstAvailable.twoFactorSecretKey || '',
        twoFactorBackupCodes: firstAvailable.twoFactorBackupCodes || firstAvailable.backupCodes || '',
        backupCodes: firstAvailable.backupCodes || '',
        additionalInstructions: firstAvailable.additionalInstructions || ''
      } : {
        accountEmail: '',
        accountPassword: '',
        recoveryInfo: '',
        twoFactorSecretKey: '',
        twoFactorBackupCodes: '',
        backupCodes: '',
        additionalInstructions: ''
      };

      const updatedData = sanitizeFirestorePayload({
        title: title.trim(),
        category,
        price: Number(price) || 0,
        followers: followers.trim() || 'N/A',
        accountAge: accountAge.trim() || 'Aged',
        pva: Boolean(pva),
        twoFactor: Boolean(twoFactor),
        monetized: Boolean(monetized),
        warrantyDays: Number(warrantyDays) || 7,
        country: country.trim() || 'Nigeria',
        niche: niche.trim() || 'General',
        description: description.trim(),
        status: stockCount > 0 ? 'active' : 'sold',
        approvalStatus: listing.approvalStatus || 'approved',
        featured: Boolean(listing.featured),
        imageUrl: mainImg,
        images: images.length > 0 ? images : [mainImg],
        badges: [pva ? 'PVA Verified' : '', twoFactor ? '2FA Enabled' : '', monetized ? 'Monetized' : ''].filter(Boolean),
        stock: stockCount,
        stockCount: stockCount,
        inventory: inventoryForDoc,
        digitalProductDetails: mainDigitalDetails,
        sellerId: listing.sellerId,
        owner_id: listing.owner_id || listing.sellerId
      });

      // Real-time update/upsert in Firestore
      const listingRef = doc(db, 'listings', listing.id);
      await setDoc(listingRef, updatedData, { merge: true });

      const fullUpdated: AccountListing = {
        ...listing,
        ...updatedData,
        id: listing.id
      } as AccountListing;

      onSuccess(fullUpdated);
      onClose();
    } catch (err: any) {
      console.error('Update listing error:', err);
      setError(err.message || 'Failed to update listing in Firestore.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#05020c]/85 backdrop-blur-md overflow-y-auto">
      <div 
        className="bg-[#120826] border border-[#2d1952] rounded-2xl sm:rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-auto relative animate-in fade-in zoom-in-95 duration-200 text-purple-100 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0c051a] px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#251347] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-900/40 border border-purple-500/40 rounded-xl text-purple-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-white text-base sm:text-lg">Edit Account Listing</h2>
              <span className="text-xs text-purple-300/60 font-mono">Ref ID: {listing.id}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRequestClose}
            className="p-2 text-purple-300 hover:text-white bg-[#1c0f38] border border-[#361d66] rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 text-xs sm:text-sm">
          {modalNotification && (
            <div className={`p-3 border rounded-2xl text-xs flex items-center gap-2 animate-in fade-in duration-300 ${
              modalNotification.type === 'error'
                ? 'bg-rose-950/80 border-rose-800/80 text-rose-200'
                : modalNotification.type === 'warning'
                ? 'bg-amber-950/80 border-amber-800/80 text-amber-200'
                : 'bg-emerald-950/80 border-emerald-800/80 text-emerald-200'
            }`}>
              <AlertCircle className={`w-4 h-4 shrink-0 ${
                modalNotification.type === 'error'
                  ? 'text-rose-400'
                  : modalNotification.type === 'warning'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`} />
              <span className="font-medium">{modalNotification.message}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-950/80 border border-rose-800/80 rounded-2xl text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Listing Title */}
          <div>
            <label className="block text-xs font-extrabold uppercase text-purple-300 mb-1">
              Listing Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Aged 2019 Facebook Account (5K Friends, Active Feed, PVA)"
              className="w-full bg-[#0a0416] text-white p-3 rounded-2xl border border-[#2d1952] focus:outline-none focus:border-purple-500 text-xs sm:text-sm"
              required
            />
          </div>

          {/* Category & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold uppercase text-purple-300 mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryType)}
                className="w-full bg-[#0a0416] text-white p-3 rounded-2xl border border-[#2d1952] focus:outline-none focus:border-purple-500 text-xs sm:text-sm"
              >
                <option value="Facebook">Facebook Account</option>
                <option value="TikTok">TikTok Account</option>
                <option value="Instagram">Instagram Account</option>
                <option value="Gmail">Gmail / Google PVA</option>
                <option value="Other">Other Verified Account</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-purple-300 mb-1">
                Price (NGN ₦) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400 font-extrabold">₦</span>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="95000"
                  className="w-full bg-[#0a0416] text-white pl-8 pr-3 py-3 rounded-2xl border border-[#2d1952] focus:outline-none focus:border-purple-500 text-xs sm:text-sm font-mono font-bold"
                  required
                />
              </div>
            </div>
          </div>

          {/* Followers & Account Age */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold uppercase text-purple-300 mb-1">
                Followers / Friends Count
              </label>
              <input
                type="text"
                value={followers}
                onChange={(e) => setFollowers(e.target.value)}
                placeholder="e.g. 15.4K Followers, 4,800 Friends"
                className="w-full bg-[#0a0416] text-white p-3 rounded-2xl border border-[#2d1952] focus:outline-none focus:border-purple-500 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-purple-300 mb-1">
                Account Age
              </label>
              <input
                type="text"
                value={accountAge}
                onChange={(e) => setAccountAge(e.target.value)}
                placeholder="e.g. 4 Years Old (Creation 2020)"
                className="w-full bg-[#0a0416] text-white p-3 rounded-2xl border border-[#2d1952] focus:outline-none focus:border-purple-500 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Status Select */}
          <div>
            <label className="block text-xs font-extrabold uppercase text-purple-300 mb-1">
              Listing Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'active', label: '🟢 Active', color: 'border-emerald-500 bg-emerald-950/40 text-emerald-200' },
                { key: 'sold', label: '🔴 Sold', color: 'border-rose-500 bg-rose-950/40 text-rose-200' },
                { key: 'reserved', label: '🟡 Reserved', color: 'border-amber-500 bg-amber-950/40 text-amber-200' }
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setStatus(st.key as any)}
                  className={`p-2.5 rounded-2xl border font-bold text-xs transition cursor-pointer text-center ${
                    status === st.key
                      ? st.color
                      : 'bg-[#0a0416] border-[#2a164c] text-purple-300/60 hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Security Features Checkboxes */}
          <div className="bg-[#0c051b] p-4 rounded-2xl border border-[#261346] space-y-3">
            <span className="text-xs font-extrabold uppercase text-purple-300 block">Verification & Security Badges</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 cursor-pointer bg-[#140a2a] p-2.5 rounded-xl border border-[#2b164f]">
                <input
                  type="checkbox"
                  checked={pva}
                  onChange={(e) => setPva(e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
                <span className="text-xs font-bold text-purple-100">Phone Verified (PVA)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-[#140a2a] p-2.5 rounded-xl border border-[#2b164f]">
                <input
                  type="checkbox"
                  checked={twoFactor}
                  onChange={(e) => setTwoFactor(e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
                <span className="text-xs font-bold text-purple-100">2FA Included</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-[#140a2a] p-2.5 rounded-xl border border-[#2b164f]">
                <input
                  type="checkbox"
                  checked={monetized}
                  onChange={(e) => setMonetized(e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
                <span className="text-xs font-bold text-purple-100">Monetization Active</span>
              </label>
            </div>
          </div>

          {/* Secure Digital Product Details Section (Multi-Stock Inventory Manager) */}
          <div className="bg-[#180938] border border-[#3b1d73] p-4 sm:p-5 rounded-3xl space-y-4 shadow-xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/20 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-900/60 border border-purple-500/40 flex items-center justify-center text-amber-300">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                    Product Stock / Inventory
                    <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-400" /> Private Escrow
                    </span>
                  </h3>
                  <p className="text-[11px] text-purple-200/70">
                    Each stock item is unique and sold only once to one customer.
                  </p>
                </div>
              </div>

              {/* Stock Count Indicators */}
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <div className="px-3 py-1 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-black flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Available: {inventoryAccounts.filter(i => (i.status || '').toLowerCase() !== 'sold').length}</span>
                </div>
                {inventoryAccounts.some(i => (i.status || '').toLowerCase() === 'sold') && (
                  <div className="px-2.5 py-1 bg-rose-950/80 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-1 shadow-sm">
                    <span>Sold: {inventoryAccounts.filter(i => (i.status || '').toLowerCase() === 'sold').length}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Privacy Alert Banner */}
            <div className="bg-purple-950/60 border border-purple-500/30 p-3 rounded-2xl flex items-start gap-2.5 text-xs text-purple-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong className="text-white font-bold">Confidential & Encrypted:</strong> Details stored here remain private. They are never rendered publicly on product pages or search results, and are automatically revealed <span className="text-emerald-300 font-bold">ONLY to the buyer</span> after payment.
              </p>
            </div>

            {/* Existing Stock Items List */}
            {loadingInventory ? (
              <div className="py-4 text-center text-purple-300/60 text-xs flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></span>
                <span>Loading active inventory stock...</span>
              </div>
            ) : (
              inventoryAccounts.length > 0 && (
                <div className="space-y-2 mb-4 bg-[#12062a] p-3.5 rounded-2xl border border-purple-500/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[11px] uppercase font-black text-purple-300 tracking-wider">
                      Stock Inventory ({inventoryAccounts.length} Total)
                    </span>
                    
                    {/* Stock filter tab */}
                    <div className="flex items-center gap-1 bg-[#1a0c3a] p-0.5 rounded-lg border border-purple-900/50 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setStockFilterTab('available')}
                        className={`px-2 py-0.5 rounded transition cursor-pointer ${
                          stockFilterTab === 'available'
                            ? 'bg-emerald-600 text-white shadow'
                            : 'text-purple-300/70 hover:text-white'
                        }`}
                      >
                        Available ({inventoryAccounts.filter(i => (i.status || '').toLowerCase() !== 'sold').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStockFilterTab('sold')}
                        className={`px-2 py-0.5 rounded transition cursor-pointer ${
                          stockFilterTab === 'sold'
                            ? 'bg-rose-600 text-white shadow'
                            : 'text-purple-300/70 hover:text-white'
                        }`}
                      >
                        Sold ({inventoryAccounts.filter(i => (i.status || '').toLowerCase() === 'sold').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStockFilterTab('all')}
                        className={`px-2 py-0.5 rounded transition cursor-pointer ${
                          stockFilterTab === 'all'
                            ? 'bg-purple-600 text-white shadow'
                            : 'text-purple-300/70 hover:text-white'
                        }`}
                      >
                        All ({inventoryAccounts.length})
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                    {inventoryAccounts
                      .filter(item => {
                        const isSold = (item.status || '').toLowerCase() === 'sold';
                        if (stockFilterTab === 'available') return !isSold;
                        if (stockFilterTab === 'sold') return isSold;
                        return true;
                      })
                      .map((item, idx) => {
                        const originalIdx = inventoryAccounts.findIndex(i => i.id === item.id);
                        const isSold = (item.status || '').toLowerCase() === 'sold';
                        return (
                          <div 
                            key={item.id}
                            onClick={() => {
                              if (!isSold) {
                                setStockInputMode('detailed');
                                handleEditAccountLocal(originalIdx);
                              }
                            }}
                            className={`p-2.5 rounded-xl flex items-center justify-between gap-3 text-xs border transition ${
                              isSold
                                ? 'bg-rose-950/20 border-rose-900/40 opacity-85'
                                : 'bg-[#1a0c3a]/70 border-purple-900/60 hover:border-purple-500/40 cursor-pointer hover:bg-[#251254]/80'
                            }`}
                            title={isSold ? undefined : "Click anywhere on this card to edit details"}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                                  isSold
                                    ? 'bg-rose-950 text-rose-300 border-rose-800'
                                    : 'bg-purple-900/80 text-purple-200 border-purple-700/50'
                                }`}>
                                  Item #{originalIdx + 1}
                                </span>
                                <span 
                                  className="text-white font-mono font-medium truncate max-w-[220px] select-all hover:text-purple-300 flex items-center gap-1 cursor-text"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const val = item.accountEmail || item.delivery_value || '';
                                    if (val) {
                                      navigator.clipboard.writeText(val);
                                      triggerNotification('success', `Copied Login/Email: ${val}`);
                                    }
                                  }}
                                  title="Click to select/copy Login/Email"
                                >
                                  <span>{item.accountEmail || item.delivery_value || 'Stock Item'}</span>
                                  <Copy className="w-3 h-3 text-purple-400/60 hover:text-purple-300 shrink-0 cursor-pointer" />
                                </span>
                                {item.accountPassword && (
                                  <span className="text-purple-300/60 font-mono text-[11px] flex items-center gap-1 bg-black/30 px-1.5 py-0.5 rounded border border-purple-900/30">
                                    <span>• pass:</span>
                                    <span 
                                      className="text-white font-extrabold select-all hover:text-purple-300 flex items-center gap-1 cursor-text"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (revealedPasswords[item.id]) {
                                          navigator.clipboard.writeText(item.accountPassword);
                                          triggerNotification('success', 'Copied password to clipboard!');
                                        } else {
                                          setRevealedPasswords(prev => ({ ...prev, [item.id]: true }));
                                          navigator.clipboard.writeText(item.accountPassword);
                                          triggerNotification('success', 'Password revealed and copied!');
                                        }
                                      }}
                                      title="Click to reveal & copy password"
                                    >
                                      <span>{revealedPasswords[item.id] ? item.accountPassword : '••••••'}</span>
                                      <Copy className="w-2.5 h-2.5 text-purple-400/60 hover:text-purple-300 shrink-0 cursor-pointer" />
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRevealedPasswords(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                                      }}
                                      className="text-purple-400 hover:text-white transition cursor-pointer p-0.5"
                                    >
                                      {revealedPasswords[item.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                    </button>
                                  </span>
                                )}
                                {isSold && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-900">
                                    Sold {item.soldTo ? `to ${item.soldTo.substring(0, 8)}...` : ''}
                                  </span>
                                )}
                                {!isSold && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-900">
                                    Available
                                  </span>
                                )}
                                {editingIndex === originalIdx && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-900 animate-pulse">
                                    Editing
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {confirmDeleteIdx === originalIdx ? (
                                <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-800/80 px-2 py-1 rounded-xl animate-pulse">
                                  <span className="text-[10px] text-rose-300 font-bold mr-1">Delete?</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveAccountLocal(originalIdx);
                                      setConfirmDeleteIdx(null);
                                    }}
                                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] rounded transition cursor-pointer"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteIdx(null);
                                    }}
                                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-extrabold text-[10px] rounded transition cursor-pointer"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setStockInputMode('detailed');
                                      handleEditAccountLocal(originalIdx);
                                    }}
                                    className="p-1.5 text-purple-300 hover:text-white hover:bg-purple-900/40 rounded-lg transition cursor-pointer"
                                    title="Edit Stock Item"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  {!isSold ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteIdx(originalIdx);
                                      }}
                                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                                      title="Delete Stock Item"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <span 
                                      className="p-1.5 text-slate-600 cursor-not-allowed opacity-40"
                                      title="Cannot delete sold stock item"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )
            )}

            {/* Input Mode Selector */}
            <div className="flex rounded-xl bg-[#100624] p-1 border border-purple-900/40">
              <button
                type="button"
                onClick={() => {
                  setStockInputMode('bulk');
                  setEditingIndex(null);
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  stockInputMode === 'bulk'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-purple-300 hover:text-white'
                }`}
              >
                <span>Add Items One Per Line (Bulk)</span>
              </button>
              <button
                type="button"
                onClick={() => setStockInputMode('detailed')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  stockInputMode === 'detailed'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-purple-300 hover:text-white'
                }`}
              >
                <span>Detailed Credentials Form</span>
              </button>
            </div>

            {/* MODE 1: BULK ONE PER LINE */}
            {stockInputMode === 'bulk' && (
              <div className="bg-[#13072b] p-3.5 rounded-2xl border border-purple-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-purple-200 text-xs font-bold">
                    Paste More Stock Items (One per line)
                  </label>
                  <span className="text-[10px] text-purple-300/60">
                    Appends without deleting existing stock
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={bulkStockText}
                  onChange={(e) => setBulkStockText(e.target.value)}
                  placeholder={`CODE-005\nCODE-006\nuser2@domain.com:password123 | 2FA:JBSWY3DPEHPK3PXP\nacc_login2@gmail.com:StrongPass2024!`}
                  className="w-full bg-[#0a0418] text-purple-100 text-xs font-mono p-3 rounded-xl border border-[#331b63] focus:outline-none focus:border-purple-400 placeholder:text-purple-400/30"
                />
                <button
                  type="button"
                  onClick={handleAddBulkStock}
                  className="w-full bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-purple-950/50"
                >
                  <PlusCircle className="w-4 h-4 text-purple-300" />
                  <span>+ Add Line(s) to Stock Inventory (Preserves Existing)</span>
                </button>
              </div>
            )}

            {/* MODE 2: DETAILED FORM */}
            {stockInputMode === 'detailed' && (
              <div className="bg-[#13072b] p-3.5 rounded-2xl border border-purple-500/20 space-y-3.5">
                <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider block">
                  {editingIndex !== null ? `Edit Stock Item #${editingIndex + 1}` : 'Enter Single Stock Item Details'}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-purple-200 text-xs font-bold mb-1">Stock Item Login / Email / Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. CODE-001 or account@gmail.com"
                      value={accountEmail}
                      onChange={(e) => setAccountEmail(e.target.value)}
                      className="w-full bg-[#0e0420] text-purple-100 text-xs p-2.5 rounded-xl border border-[#331b63] focus:outline-none focus:border-purple-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-purple-200 text-xs font-bold mb-1">Account Password (If applicable)</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="e.g. AccountPass123!"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        className="w-full bg-[#0e0420] text-purple-100 text-xs p-2.5 pr-9 rounded-xl border border-[#331b63] focus:outline-none focus:border-purple-400 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-purple-400 hover:text-white transition cursor-pointer"
                        title={showPassword ? 'Hide Password' : 'Show Password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-purple-200 text-xs font-bold mb-1">Recovery Info / Note</label>
                    <input
                      type="text"
                      placeholder="e.g. recovery@gmail.com"
                      value={recoveryInfo}
                      onChange={(e) => setRecoveryInfo(e.target.value)}
                      className="w-full bg-[#0e0420] text-purple-100 text-xs p-2.5 rounded-xl border border-[#331b63] focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div>
                    <label className="block text-purple-200 text-xs font-bold mb-1">2FA Secret Key</label>
                    <input
                      type="text"
                      placeholder="e.g. JBSWY3DPEHPK3PXP"
                      value={twoFactorSecretKey}
                      onChange={(e) => setTwoFactorSecretKey(e.target.value)}
                      className="w-full bg-[#0e0420] text-purple-100 text-xs p-2.5 rounded-xl border border-[#331b63] focus:outline-none focus:border-purple-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-purple-200 text-xs font-bold mb-1">2FA Backup Codes</label>
                    <input
                      type="text"
                      placeholder="e.g. 1234-5678, 8765-4321..."
                      value={twoFactorBackupCodes}
                      onChange={(e) => setTwoFactorBackupCodes(e.target.value)}
                      className="w-full bg-[#0e0420] text-purple-100 text-xs p-2.5 rounded-xl border border-[#331b63] focus:outline-none focus:border-purple-400 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-purple-200 text-xs font-bold mb-1">Additional Transfer Instructions</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Clean IP access instructions, original email access notes..."
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    className="w-full bg-[#0e0420] text-purple-100 text-xs p-2.5 rounded-xl border border-[#331b63] focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleAddAccountToInventory}
                    className="w-full bg-[#261250] hover:bg-[#321868] border border-[#48229b] text-purple-100 font-extrabold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4 text-purple-400" />
                    <span>{editingIndex !== null ? '💾 Save Item Changes' : '＋ Add This Item to Stock'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-extrabold uppercase text-purple-300 mb-1">
              Account Description & Proof Details
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the account history, niche, engagement rates, transfer instructions..."
              className="w-full bg-[#0a0416] text-white p-3 rounded-2xl border border-[#2d1952] focus:outline-none focus:border-purple-500 text-xs sm:text-sm"
              required
            />
          </div>

          {/* Multiple Images Upload & Gallery */}
          <div className="bg-[#0c051b] p-4 rounded-2xl border border-[#261346] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase text-purple-300 flex items-center gap-1.5">
                <Image className="w-4 h-4 text-purple-400" />
                Account Screenshots & Images ({images.length})
              </span>
              <label className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                <span>{uploadingImage ? 'Uploading...' : 'Upload Local File'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploadingImage}
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {uploadingImage && (
              <div className="text-[11px] text-cyan-400 animate-pulse bg-cyan-950/20 border border-cyan-800/30 p-2 rounded-xl flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>Uploading screenshots to Firebase Storage...</span>
              </div>
            )}

            {imageUploadError && (
              <div className="text-[11px] text-rose-400 bg-rose-950/20 border border-rose-800/30 p-2 rounded-xl">
                ⚠️ {imageUploadError}
              </div>
            )}

            {/* Input image URL */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="Or paste image URL (https://...)"
                className="flex-1 bg-[#0a0416] text-white p-2.5 rounded-xl border border-[#2b164f] text-xs focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={() => handleAddImage()}
                disabled={!newImageUrl.trim()}
                className="bg-[#241348] hover:bg-[#341b68] text-purple-200 font-bold px-3 py-2 rounded-xl text-xs border border-[#3e1f7a] transition disabled:opacity-40"
              >
                Add URL
              </button>
            </div>

            {/* Category Presets */}
            <div>
              <span className="text-[10px] text-purple-300/60 font-semibold block mb-1">Quick Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                {(defaultCategoryImages[category] || defaultCategoryImages.Facebook).map((imgUrl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleAddImage(imgUrl)}
                    className="bg-[#170a30] hover:bg-[#25104e] text-purple-300 text-[10px] px-2.5 py-1 rounded-lg border border-[#31185f] transition"
                  >
                    + Preset {i + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Thumbnail Grid */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-2 border-t border-[#231140]">
                {images.map((img, idx) => (
                  <div 
                    key={idx} 
                    className={`relative rounded-xl overflow-hidden border group bg-[#06030c] aspect-video ${
                      imageUrl === img ? 'border-emerald-400 ring-2 ring-emerald-500/30' : 'border-[#2d1952]'
                    }`}
                  >
                    <img src={img} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1 p-1">
                      <button
                        type="button"
                        onClick={() => setImageUrl(img)}
                        className="p-1 bg-emerald-600 text-white rounded-lg text-[9px] font-bold"
                        title="Set as Main Cover Image"
                      >
                        Main
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="p-1 bg-rose-600 text-white rounded-lg"
                        title="Remove Image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {imageUrl === img && (
                      <span className="absolute top-1 left-1 bg-emerald-500 text-black text-[9px] font-black px-1.5 rounded uppercase">
                        Cover
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-[#251347] flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={handleRequestClose}
              className="px-4 py-2.5 text-purple-300 hover:text-white bg-[#1a0c36] hover:bg-[#25124e] border border-[#301661] rounded-2xl text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold rounded-2xl shadow-lg transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving Changes...' : 'Save Listing Updates'}</span>
            </button>
          </div>
        </form>

        {/* Unsaved Changes Confirmation Overlay */}
        {showCancelConfirm && (
          <div className="absolute inset-0 z-50 bg-[#05020d]/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-[#160b30] border border-[#3d1d70] p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl text-center">
              <div className="w-12 h-12 bg-amber-950/80 border border-amber-500/40 rounded-2xl flex items-center justify-center mx-auto text-amber-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              
              <div className="space-y-1">
                <h3 className="font-extrabold text-white text-base sm:text-lg">Unsaved Changes</h3>
                <p className="text-xs text-purple-300/80 leading-relaxed">
                  You have unsaved changes. Are you sure you want to cancel?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="py-2.5 px-3 bg-[#241344] hover:bg-[#321a5d] text-purple-200 border border-[#3e1f73] rounded-xl font-bold text-xs transition cursor-pointer"
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
