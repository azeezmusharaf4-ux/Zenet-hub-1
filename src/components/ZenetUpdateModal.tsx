import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Phone, 
  UserCheck, 
  Wallet, 
  ArrowRight, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  ExternalLink, 
  ShoppingBag, 
  Loader2, 
  AlertCircle, 
  Image as ImageIcon,
  Clock,
  ShieldCheck,
  Plus
} from 'lucide-react';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp, 
  query, 
  where, 
  orderBy 
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, sanitizeFirestorePayload } from '../lib/firebase';
import { UserProfile, ZenedUpdateProduct, ZenedUpdateOrder } from '../types';

interface ZenetUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  userProfile: UserProfile | null;
  walletBalance: number;
  isOwner?: boolean;
  isAdmin?: boolean;
  onOpenAuth?: (mode: 'login' | 'signup') => void;
  onOpenWallet?: () => void;
  onOpenAdminGenerator?: () => void;
  onNavigateService?: (service: 'virtual-numbers' | 'log-accounts' | 'wallet') => void;
}

export const ZenetUpdateModal: React.FC<ZenetUpdateModalProps> = ({
  isOpen,
  onClose,
  user,
  userProfile,
  walletBalance,
  isOwner = false,
  isAdmin = false,
  onOpenAuth,
  onOpenWallet,
  onOpenAdminGenerator,
  onNavigateService
}) => {
  const [activeTab, setActiveTab] = useState<'marketplace' | 'purchases' | 'system_updates'>('marketplace');
  const [products, setProducts] = useState<ZenedUpdateProduct[]>([]);
  const [purchasedOrders, setPurchasedOrders] = useState<ZenedUpdateOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Success modal after purchase
  const [unlockedOrder, setUnlockedOrder] = useState<ZenedUpdateOrder | null>(null);

  // 1. Fetch live generated update products
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const productsRef = collection(db, 'zenedUpdateProducts');
    const q = query(productsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: ZenedUpdateProduct[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || '',
            price: Number(data.price) || 0,
            description: data.description || '',
            imageUrl: data.imageUrl || '',
            status: data.status || 'active',
            // Private delivery link is only populated for admin in edit view; hidden for buyers
            secretDeliveryInfo: isAdmin || isOwner ? (data.privateDeliveryLink || data.secretDeliveryInfo) : undefined,
            privateDeliveryLink: isAdmin || isOwner ? (data.privateDeliveryLink || data.secretDeliveryInfo) : undefined,
            createdBy: data.createdBy || '',
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || undefined
          };
        });
        setProducts(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching zenedUpdateProducts:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen, isAdmin, isOwner]);

  // 2. Fetch user's purchased orders
  useEffect(() => {
    if (!isOpen || !user) {
      setPurchasedOrders([]);
      return;
    }

    const ordersRef = collection(db, 'zenedUpdateOrders');
    const q = query(
      ordersRef, 
      where('buyerId', '==', user.uid),
      orderBy('purchasedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const orders: ZenedUpdateOrder[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            productId: data.productId || '',
            productName: data.productName || 'Update Product',
            productImage: data.productImage || '',
            price: Number(data.price) || 0,
            buyerId: data.buyerId || '',
            buyerEmail: data.buyerEmail || '',
            buyerName: data.buyerName || '',
            secretDeliveryInfo: data.secretDeliveryInfo || data.privateDeliveryLink || '',
            purchasedAt: data.purchasedAt?.toDate?.()?.toISOString?.() || data.purchasedAt || new Date().toISOString(),
            status: data.status || 'completed',
            transactionId: data.transactionId || ''
          };
        });
        setPurchasedOrders(orders);
      },
      (err) => {
        console.error('Error fetching purchased orders:', err);
      }
    );

    return () => unsubscribe();
  }, [isOpen, user]);

  // System feature updates for the second tab
  const systemUpdates = [
    {
      id: 'update-vn',
      title: 'Global Virtual Numbers Engine 2.0',
      tag: 'Live Service',
      tagColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: Phone,
      date: 'Latest Release',
      description: 'Acquire active temporary and long-term virtual phone numbers across 30+ countries with high-speed SMS OTP delivery and auto-refund protection.',
      actionText: 'Browse Virtual Numbers',
      actionKey: 'virtual-numbers' as const
    },
    {
      id: 'update-logs',
      title: 'Verified Digital Logs Marketplace',
      tag: 'Enhanced',
      tagColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      icon: UserCheck,
      date: 'Latest Release',
      description: 'Instant delivery of 100% verified social, streaming, and software account logs with escrow-backed credentials and seller ratings.',
      actionText: 'Explore Log Accounts',
      actionKey: 'log-accounts' as const
    },
    {
      id: 'update-dva',
      title: 'Instant Dedicated Virtual Bank Account Funding',
      tag: 'Upgrade',
      tagColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      icon: Wallet,
      date: 'System Upgrade',
      description: 'Every registered user receives a personal Dedicated Virtual Account (Wema Bank) for automatic, zero-wait wallet balance top-ups.',
      actionText: 'View Wallet & DVA',
      actionKey: 'wallet' as const
    }
  ];

  // 3. Buyer Purchase Flow
  const handleBuyProduct = async (product: ZenedUpdateProduct) => {
    setErrorNotice(null);

    // Step 1: Authentication Verification
    if (!user) {
      if (onOpenAuth) {
        onClose();
        onOpenAuth('login');
      } else {
        setErrorNotice('Please sign in to your ZENET HUB account to purchase this product.');
      }
      return;
    }

    // Step 2: Wallet Balance Verification
    if (walletBalance < product.price) {
      setErrorNotice(
        `Insufficient wallet balance (₦${walletBalance.toLocaleString()}). Product cost is ₦${product.price.toLocaleString()}. Please fund your wallet.`
      );
      return;
    }

    setPurchasingProductId(product.id);

    try {
      // Step 3: Fetch fresh product record from server to verify real price and availability
      const productRef = doc(db, 'zenedUpdateProducts', product.id);
      const productSnap = await getDoc(productRef);

      if (!productSnap.exists()) {
        throw new Error('This product is no longer available in the catalog.');
      }

      const freshData = productSnap.data();
      const realPrice = Number(freshData.price) || 0;
      const secretLink = freshData.privateDeliveryLink || freshData.secretDeliveryInfo || '';

      if (!secretLink) {
        throw new Error('This product has not been assigned a delivery link yet. Please contact support.');
      }

      // Step 4: Re-verify wallet on user doc
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const currentBalance = userSnap.exists() ? (Number(userSnap.data()?.walletBalance) || 0) : walletBalance;

      if (currentBalance < realPrice) {
        throw new Error(`Insufficient wallet balance. You have ₦${currentBalance.toLocaleString()}, but ₦${realPrice.toLocaleString()} is required.`);
      }

      const newBalance = Math.max(0, currentBalance - realPrice);

      // Step 5: Charge buyer wallet
      await updateDoc(userRef, {
        walletBalance: newBalance,
        updatedAt: serverTimestamp()
      });

      // Step 6: Create Wallet Transaction record
      const txDocRef = doc(collection(db, 'wallet_transactions'));
      await setDoc(txDocRef, sanitizeFirestorePayload({
        id: txDocRef.id,
        userId: user.uid,
        userEmail: user.email || '',
        type: 'purchase',
        amount: realPrice,
        description: `Purchase: ${freshData.name || product.name}`,
        date: new Date().toISOString(),
        status: 'completed',
        reference: `ZENET-UPD-${Date.now()}`
      }));

      // Step 7: Create Order Record with unlocked secret link
      const orderDocRef = doc(collection(db, 'zenedUpdateOrders'));
      const orderData: ZenedUpdateOrder = {
        id: orderDocRef.id,
        productId: product.id,
        productName: freshData.name || product.name,
        productImage: freshData.imageUrl || product.imageUrl || '',
        price: realPrice,
        buyerId: user.uid,
        userId: user.uid,
        buyerEmail: user.email || '',
        buyerName: userProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'Buyer',
        secretDeliveryInfo: secretLink,
        purchasedAt: new Date().toISOString(),
        status: 'completed',
        transactionId: txDocRef.id
      };

      await setDoc(orderDocRef, sanitizeFirestorePayload({
        ...orderData,
        createdAt: serverTimestamp()
      }));

      // Also create a record in global purchases for escrow/orders tab consistency
      const globalPurchaseRef = doc(collection(db, 'purchases'));
      await setDoc(globalPurchaseRef, sanitizeFirestorePayload({
        id: globalPurchaseRef.id,
        listingId: product.id,
        listingTitle: freshData.name || product.name,
        buyerId: user.uid,
        buyerEmail: user.email || '',
        buyerName: userProfile?.displayName || user.displayName || 'Buyer',
        sellerId: 'zenet-official',
        sellerName: 'ZENET HUB Official Updates',
        amount: realPrice,
        price: realPrice,
        category: 'Zenet Update',
        status: 'completed',
        secretDetails: secretLink,
        credentials: secretLink,
        date: new Date().toISOString(),
        purchasedAt: serverTimestamp()
      }));

      // Step 8: Open Success Unlock Modal
      setUnlockedOrder(orderData);
    } catch (err: any) {
      console.error('Purchase error:', err);
      setErrorNotice(err?.message || 'Transaction failed. Please try again or contact support.');
    } finally {
      setPurchasingProductId(null);
    }
  };

  const openDeliveryLink = (url: string) => {
    if (!url) return;
    const finalUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  return (
    <>
      <div id="zenet-update-modal" className="fixed inset-0 z-50 overflow-y-auto flex justify-center items-start sm:items-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
        <div 
          className="relative w-full max-w-3xl my-auto bg-[#0c051f] border border-[#2b165c] rounded-2xl sm:rounded-[28px] shadow-[0_0_60px_rgba(125,76,247,0.3)] flex flex-col overflow-visible sm:overflow-hidden text-slate-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Glowing Badge */}
          <div className="relative p-5 sm:p-6 bg-gradient-to-b from-[#1c0d3d] to-[#0c051f] border-b border-[#2b165c] flex flex-col sm:flex-row items-center sm:justify-between text-center sm:text-left gap-4">
            {/* Close Button in top right corner on mobile, static on desktop */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 sm:static p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer border border-white/10 z-10"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-[#2a1359] border border-[#7d4cf7]/40 text-[#bd93f9] shadow-lg flex items-center justify-center shrink-0">
                <Sparkles className="w-5.5 h-5.5 text-[#bd93f9]" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h3 className="text-xl font-black text-white tracking-tight">ZENET HUB Update</h3>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] uppercase font-black px-2 py-0.5 rounded-md tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>LIVE</span>
                  </span>
                </div>
                <p className="text-xs text-purple-300/60 font-medium max-w-md">
                  Exclusive digital tools, premium methods, and official updates verified by ZENET HUB.
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Sub-Tabs & Live Wallet Bar */}
          <div className="bg-[#14082e] border-b border-[#24114f] px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('marketplace')}
                className={`px-1 sm:px-3.5 py-2 rounded-xl text-[10px] sm:text-xs font-black transition cursor-pointer flex items-center justify-center gap-1 ${
                  activeTab === 'marketplace'
                    ? 'bg-[#7d4cf7] text-white shadow-[0_0_12px_rgba(125,76,247,0.4)] border border-[#7d4cf7]'
                    : 'bg-[#1e0e3a] text-purple-300 hover:text-white border border-[#30166a]'
                }`}
              >
                <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span>Products ({products.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('purchases')}
                className={`px-1 sm:px-3.5 py-2 rounded-xl text-[10px] sm:text-xs font-black transition cursor-pointer flex items-center justify-center gap-1 ${
                  activeTab === 'purchases'
                    ? 'bg-[#7d4cf7] text-white shadow-[0_0_12px_rgba(125,76,247,0.4)] border border-[#7d4cf7]'
                    : 'bg-[#1e0e3a] text-purple-300 hover:text-white border border-[#30166a]'
                }`}
              >
                <Unlock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">My Purchased Updates ({purchasedOrders.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('system_updates')}
                className={`px-1 sm:px-3.5 py-2 rounded-xl text-[10px] sm:text-xs font-black transition cursor-pointer flex items-center justify-center gap-1 ${
                  activeTab === 'system_updates'
                    ? 'bg-[#7d4cf7] text-white shadow-[0_0_12px_rgba(125,76,247,0.4)] border border-[#7d4cf7]'
                    : 'bg-[#1e0e3a] text-purple-300 hover:text-white border border-[#30166a]'
                }`}
              >
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span>System News</span>
              </button>
            </div>

            {/* Wallet Balance Display & Fund CTA - Full Width on Mobile */}
            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-3 text-xs bg-purple-950/20 sm:bg-transparent border border-purple-900/30 sm:border-none p-2.5 sm:p-0 rounded-xl sm:rounded-none">
              <div className="flex items-center gap-2">
                <span className="text-purple-300/60 font-black uppercase text-[10px]">Wallet Balance</span>
                <span className="font-mono font-extrabold text-white text-sm bg-black/40 px-2.5 py-1 rounded-lg border border-purple-900/40 shadow-sm">
                  ₦{walletBalance.toLocaleString()}
                </span>
              </div>
              {onOpenWallet && (
                <button
                  onClick={() => { onClose(); onOpenWallet(); }}
                  className="px-3.5 py-1.5 rounded-lg bg-[#7d4cf7] hover:bg-[#8e5ff9] text-white font-black text-xs transition cursor-pointer shadow active:scale-95 flex items-center gap-1 uppercase tracking-wider"
                >
                  <span>+ Fund</span>
                </button>
              )}
            </div>
          </div>

          {/* Owner-Only Quick Link to Product Generator */}
          {isOwner && onOpenAdminGenerator && (
            <div className="bg-[#1a0c3b] border-b border-[#34186d] px-6 py-2 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 text-amber-300 font-bold">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Authorized Owner Mode (Azeezmusharaf4@gmail.com)</span>
              </div>
              <button
                onClick={() => { onClose(); onOpenAdminGenerator(); }}
                className="px-3 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-[11px] uppercase tracking-wider flex items-center space-x-1 shadow cursor-pointer"
              >
                <Plus className="w-3 h-3 text-black" />
                <span>Add Product to Generate Update</span>
              </button>
            </div>
          )}

          {/* Error Notice */}
          {errorNotice && (
            <div className="bg-rose-500/15 border-b border-rose-500/30 px-6 py-3 text-xs text-rose-300 font-semibold flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorNotice}</span>
              </div>
              <button onClick={() => setErrorNotice(null)} className="text-rose-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Main Body - Natural Scrolling on Mobile, Contained on Desktop */}
          <div className="flex-1 overflow-visible sm:overflow-y-auto p-4 sm:p-6 space-y-6 max-h-none sm:max-h-[calc(92vh-170px)]">
            {/* TAB 1: PRODUCT MARKETPLACE (LARGE VISUAL PRODUCT CARDS) */}
            {activeTab === 'marketplace' && (
              <div className="space-y-4">
                {loading ? (
                  <div className="py-16 flex flex-col items-center justify-center space-y-2 text-purple-300/50">
                    <Loader2 className="w-8 h-8 animate-spin text-[#bd93f9]" />
                    <p className="text-xs font-bold">Loading updates marketplace...</p>
                  </div>
                ) : products.length === 0 ? (
                  <div className="py-16 text-center bg-[#12082b] border border-[#210f45] rounded-3xl p-8 space-y-3">
                    <ShoppingBag className="w-12 h-12 text-purple-400/40 mx-auto" />
                    <h4 className="text-base font-bold text-white">No Update Products Available Yet</h4>
                    <p className="text-xs text-purple-300/60 max-w-md mx-auto">
                      Authorized administrators can generate and publish products with cover images and private delivery links directly from the menu.
                    </p>
                    {(isOwner || isAdmin) && onOpenAdminGenerator && (
                      <button
                        onClick={() => { onClose(); onOpenAdminGenerator(); }}
                        className="mt-2 px-5 py-2.5 rounded-xl bg-[#7d4cf7] hover:bg-[#8e5ff9] text-white text-xs font-black transition cursor-pointer shadow-md inline-flex items-center space-x-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Product to Generate Update</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {products.map((product) => {
                      const isPurchasingThis = purchasingProductId === product.id;
                      const hasPurchased = purchasedOrders.some((o) => o.productId === product.id);

                      return (
                        <div
                          key={product.id}
                          className="bg-[#0f0624] border border-[#2b165c] hover:border-[#5c30b5] rounded-[24px] overflow-hidden flex flex-col shadow-xl transition-all duration-300 group"
                        >
                          {/* =================================================== */}
                          {/* LARGE PRODUCT COVER IMAGE (REQUESTED CARD LAYOUT) */}
                          {/* =================================================== */}
                          <div className="relative aspect-[16/10] w-full bg-[#070214] overflow-hidden border-b border-[#210f45]">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-purple-400/30 space-y-1">
                                <ImageIcon className="w-10 h-10" />
                                <span className="text-[11px] font-bold">ZENET UPDATE</span>
                              </div>
                            )}

                            {/* Verified Badge */}
                            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md border border-purple-500/30 text-[#bd93f9] text-[10px] font-black uppercase px-2.5 py-1 rounded-lg flex items-center space-x-1 shadow">
                              <Sparkles className="w-3 h-3 text-[#bd93f9]" />
                              <span>OFFICIAL UPDATE</span>
                            </div>

                            {/* Status or Owned Badge */}
                            {hasPurchased && (
                              <div className="absolute top-3 right-3 bg-emerald-500 text-black text-[10px] font-black uppercase px-2.5 py-1 rounded-lg flex items-center space-x-1 shadow">
                                <CheckCircle2 className="w-3 h-3 text-black" />
                                <span>UNLOCKED</span>
                              </div>
                            )}
                          </div>

                          {/* =================================================== */}
                          {/* PRODUCT DETAILS (NAME, DESCRIPTION, PRICE, BUY) */}
                          {/* =================================================== */}
                          <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                            <div className="space-y-2">
                              <h4 className="text-base sm:text-lg font-black text-white tracking-tight leading-snug">
                                {product.name}
                              </h4>
                              <p className="text-xs text-purple-200/70 leading-relaxed line-clamp-3">
                                {product.description}
                              </p>
                            </div>

                            <div className="pt-2 border-t border-[#1d0d3b] space-y-3">
                              {/* Price Display */}
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-purple-300/50">
                                  Price
                                </span>
                                <div className="text-lg sm:text-xl font-black text-white font-mono flex items-center space-x-1">
                                  <span className="text-[#a16eff]">₦</span>
                                  <span>{product.price.toLocaleString()}</span>
                                </div>
                              </div>

                              {/* Action Button: BUY or OPEN IF ALREADY PURCHASED */}
                              {hasPurchased ? (
                                <button
                                  onClick={() => {
                                    const matching = purchasedOrders.find((o) => o.productId === product.id);
                                    if (matching) setUnlockedOrder(matching);
                                  }}
                                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center space-x-2 cursor-pointer"
                                >
                                  <Unlock className="w-4 h-4" />
                                  <span>VIEW UNLOCKED PRODUCT</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleBuyProduct(product)}
                                  disabled={isPurchasingThis}
                                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#7d4cf7] via-[#8e5ff9] to-[#a16eff] hover:from-[#8e5ff9] hover:to-[#b37eff] text-white font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-[0_0_18px_rgba(125,76,247,0.35)] hover:shadow-[0_0_25px_rgba(125,76,247,0.5)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 active:scale-[0.98]"
                                >
                                  {isPurchasingThis ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      <span>PROCESSING PAYMENT...</span>
                                    </>
                                  ) : (
                                    <>
                                      <ShoppingBag className="w-4 h-4" />
                                      <span>BUY</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: MY PURCHASED UPDATES (UNLOCKED ACCESS) */}
            {activeTab === 'purchases' && (
              <div className="space-y-4">
                {!user ? (
                  <div className="py-16 text-center bg-[#12082b] border border-[#210f45] rounded-3xl p-8 space-y-3">
                    <Lock className="w-10 h-10 text-purple-400/40 mx-auto" />
                    <h4 className="text-base font-bold text-white">Sign In to View Your Purchases</h4>
                    <p className="text-xs text-purple-300/60 max-w-sm mx-auto">
                      Log in to access your unlocked private delivery links and purchased update products.
                    </p>
                    {onOpenAuth && (
                      <button
                        onClick={() => { onClose(); onOpenAuth('login'); }}
                        className="px-5 py-2.5 rounded-xl bg-[#7d4cf7] hover:bg-[#8e5ff9] text-white text-xs font-bold transition cursor-pointer"
                      >
                        Sign In Now
                      </button>
                    )}
                  </div>
                ) : purchasedOrders.length === 0 ? (
                  <div className="py-16 text-center bg-[#12082b] border border-[#210f45] rounded-3xl p-8 space-y-3">
                    <ShoppingBag className="w-10 h-10 text-purple-400/40 mx-auto" />
                    <h4 className="text-base font-bold text-white">No Purchased Updates Yet</h4>
                    <p className="text-xs text-purple-300/60 max-w-sm mx-auto">
                      When you purchase products from ZENET HUB Update, your private delivery links unlock instantly here.
                    </p>
                    <button
                      onClick={() => setActiveTab('marketplace')}
                      className="px-5 py-2.5 rounded-xl bg-[#7d4cf7] hover:bg-[#8e5ff9] text-white text-xs font-black transition cursor-pointer"
                    >
                      Browse Products
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {purchasedOrders.map((order) => (
                      <div
                        key={order.id}
                        className="p-4 rounded-2xl bg-[#12082b] border border-[#261352] hover:border-[#5c30b5] transition duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-center space-x-3.5">
                          {order.productImage ? (
                            <img
                              src={order.productImage}
                              alt={order.productName}
                              className="w-14 h-14 rounded-xl object-cover border border-purple-500/30 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-[#1d0e42] border border-[#30166a] flex items-center justify-center shrink-0 text-[#bd93f9]">
                              <Unlock className="w-6 h-6" />
                            </div>
                          )}
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2 flex-wrap">
                              <h4 className="font-extrabold text-white text-sm">{order.productName}</h4>
                              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] uppercase font-black px-2 py-0.5 rounded">
                                ACTIVE ACCESS
                              </span>
                            </div>
                            <div className="flex items-center space-x-3 text-[11px] text-purple-300/60 font-mono">
                              <span>Paid: ₦{order.price.toLocaleString()}</span>
                              <span>•</span>
                              <span>{new Date(order.purchasedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openDeliveryLink(order.secretDeliveryInfo)}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7d4cf7] to-[#a16eff] hover:from-[#8e5ff9] hover:to-[#b37eff] text-white font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 transition cursor-pointer shadow"
                          >
                            <span>🔓 OPEN PRODUCT</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: SYSTEM NEWS & CORE SERVICE UPDATES */}
            {activeTab === 'system_updates' && (
              <div className="space-y-3.5">
                <div className="text-[11px] font-black uppercase tracking-widest text-[#9e67fa]">
                  Platform Infrastructure Upgrades
                </div>

                <div className="space-y-3">
                  {systemUpdates.map((item) => {
                    const IconComp = item.icon;
                    return (
                      <div 
                        key={item.id}
                        className="p-4 rounded-2xl bg-[#12082b] border border-[#210f45] hover:border-[#4d24a3] transition duration-200 space-y-2 group"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="p-2.5 rounded-xl bg-[#1d0e42] text-[#c1a0ff] border border-[#30166a] shrink-0">
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="font-bold text-white text-sm">{item.title}</h4>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase ${item.tagColor}`}>
                                {item.tag}
                              </span>
                            </div>
                            <span className="text-[10px] text-purple-300/40 font-mono">{item.date}</span>
                          </div>
                        </div>

                        <p className="text-xs text-purple-200/70 leading-relaxed pl-1">
                          {item.description}
                        </p>

                        {item.actionText && item.actionKey && onNavigateService && (
                          <div className="pt-1 pl-1">
                            <button
                              onClick={() => {
                                onClose();
                                onNavigateService(item.actionKey);
                              }}
                              className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#b37eff] hover:text-white transition cursor-pointer"
                            >
                              <span>{item.actionText}</span>
                              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-[#12082b] border-t border-[#24114f] flex items-center justify-between text-xs">
            <span className="text-purple-300/40 font-medium">
              Real-time escrow-backed digital deliveries.
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#7d4cf7] hover:bg-[#8e5ff9] text-white font-bold transition cursor-pointer shadow-md"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* =================================================== */}
      {/* SUCCESS UNLOCK MODAL (PURCHASE SUCCESSFUL) */}
      {/* =================================================== */}
      {unlockedOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-in fade-in zoom-in-95 duration-200">
          <div 
            className="relative w-full max-w-md bg-[#0c051f] border-2 border-emerald-500/70 rounded-[28px] shadow-[0_0_60px_rgba(16,185,129,0.35)] p-6 text-center text-slate-200 space-y-5 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center mx-auto text-emerald-400 shadow-lg animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                PURCHASE SUCCESSFUL
              </span>
              <h3 className="text-xl font-black text-white tracking-tight mt-2">
                Your product is ready.
              </h3>
              <p className="text-xs text-purple-200/70">
                You have successfully acquired <strong className="text-white">"{unlockedOrder.productName}"</strong>. Your private delivery link has been unlocked below.
              </p>
            </div>

            {/* Unlocked Link Box */}
            <div className="p-4 rounded-2xl bg-[#14082e] border border-emerald-500/40 text-left space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black uppercase text-emerald-300">
                <span className="flex items-center space-x-1.5">
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Private Delivery Access</span>
                </span>
                <span className="text-[10px] text-emerald-400/70 font-mono">UNLOCKED</span>
              </div>
              <p className="text-xs text-purple-200 font-mono break-all select-all bg-[#080214] p-2.5 rounded-xl border border-purple-900/40">
                {unlockedOrder.secretDeliveryInfo}
              </p>
            </div>

            {/* Actions: [ 🔓 OPEN PRODUCT ] and Dismiss */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => openDeliveryLink(unlockedOrder.secretDeliveryInfo)}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-sm uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(16,185,129,0.4)] flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
              >
                <span>🔓 OPEN PRODUCT</span>
                <ExternalLink className="w-4 h-4" />
              </button>

              <button
                onClick={() => setUnlockedOrder(null)}
                className="w-full py-2.5 text-xs text-purple-300 hover:text-white font-bold transition cursor-pointer"
              >
                Keep Browsing ZENET HUB Update
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
