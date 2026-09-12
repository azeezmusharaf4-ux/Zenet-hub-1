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
  }, [isOpen, user?.uid]);

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
      <div id="zenet-update-modal" className="fixed inset-0 z-50 overflow-y-auto flex justify-center items-start sm:items-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div 
          className="relative w-full max-w-3xl my-auto bg-white border border-[#E9E2FA] rounded-2xl sm:rounded-[28px] shadow-2xl flex flex-col overflow-visible sm:overflow-hidden text-[#171329]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-white px-4 sm:px-6 py-4 border-b border-[#E9E2FA] flex items-center justify-between shrink-0 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#EDE9FE] border border-[#DDD6FE] flex items-center justify-center text-[#7C3AED] shrink-0 shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-[#171329] text-base sm:text-lg">ZENET HUB Update</h3>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>LIVE</span>
                  </span>
                </div>
                <p className="text-xs text-[#716B82]">
                  Exclusive digital tools, premium methods, and official updates verified by ZENET HUB.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-[#716B82] hover:text-[#171329] bg-[#F8F7FF] hover:bg-[#EDE9FE] border border-[#E9E2FA] rounded-full transition cursor-pointer shrink-0"
              title="Close modal"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Sub-Tabs & Live Wallet Bar */}
          <div className="bg-[#F8F7FF] border-b border-[#E9E2FA] px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              <button
                onClick={() => setActiveTab('marketplace')}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'marketplace'
                    ? 'bg-[#7C3AED] text-white shadow-xs'
                    : 'bg-white text-[#58516D] hover:text-[#171329] hover:bg-[#EDE9FE]/50 border border-[#E9E2FA]'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                <span>Products ({products.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('purchases')}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'purchases'
                    ? 'bg-[#7C3AED] text-white shadow-xs'
                    : 'bg-white text-[#58516D] hover:text-[#171329] hover:bg-[#EDE9FE]/50 border border-[#E9E2FA]'
                }`}
              >
                <Unlock className="w-3.5 h-3.5 shrink-0" />
                <span>My Purchased Updates ({purchasedOrders.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('system_updates')}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'system_updates'
                    ? 'bg-[#7C3AED] text-white shadow-xs'
                    : 'bg-white text-[#58516D] hover:text-[#171329] hover:bg-[#EDE9FE]/50 border border-[#E9E2FA]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>System News</span>
              </button>
            </div>

            {/* Wallet Balance Display & Fund CTA */}
            <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
              <div className="flex items-center gap-2 bg-white border border-[#E9E2FA] px-3 py-1.5 rounded-xl shadow-xs">
                <span className="text-[#716B82] font-bold uppercase text-[10px] tracking-wider">Wallet Balance</span>
                <span className="font-mono font-extrabold text-[#171329] text-xs sm:text-sm">
                  ₦{walletBalance.toLocaleString()}
                </span>
              </div>
              {onOpenWallet && (
                <button
                  onClick={() => { onClose(); onOpenWallet(); }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] active:bg-[#5B21B6] text-white font-bold text-xs transition cursor-pointer shadow-xs flex items-center gap-1 uppercase tracking-wider"
                >
                  <span>+ Fund</span>
                </button>
              )}
            </div>
          </div>

          {/* Owner-Only Quick Link to Product Generator */}
          {isOwner && onOpenAdminGenerator && (
            <div className="bg-amber-50/90 border-b border-amber-200/80 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2 text-amber-900 font-bold">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Authorized Owner Mode (Azeezmusharaf4@gmail.com)</span>
              </div>
              <button
                onClick={() => { onClose(); onOpenAdminGenerator(); }}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] uppercase tracking-wider flex items-center space-x-1 shadow-xs cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
                <span>Add Product to Generate Update</span>
              </button>
            </div>
          )}

          {/* Error Notice */}
          {errorNotice && (
            <div className="bg-rose-50 border-b border-rose-200 px-4 sm:px-6 py-2.5 text-xs text-rose-700 font-semibold flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{errorNotice}</span>
              </div>
              <button onClick={() => setErrorNotice(null)} className="text-rose-400 hover:text-rose-700 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Main Body */}
          <div className="flex-1 overflow-visible sm:overflow-y-auto p-4 sm:p-6 space-y-6 max-h-none sm:max-h-[calc(92vh-180px)] bg-[#FAF9FF]">
            {/* TAB 1: PRODUCT MARKETPLACE */}
            {activeTab === 'marketplace' && (
              <div className="space-y-4">
                {loading ? (
                  <div className="py-16 flex flex-col items-center justify-center space-y-2 text-[#7C3AED]">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-xs font-bold text-[#716B82]">Loading updates marketplace...</p>
                  </div>
                ) : products.length === 0 ? (
                  <div className="py-16 text-center bg-white border border-dashed border-[#DDD6FE] rounded-3xl p-8 space-y-3 shadow-xs">
                    <ShoppingBag className="w-12 h-12 text-[#7C3AED]/40 mx-auto" />
                    <h4 className="text-base font-bold text-[#171329]">No Update Products Available Yet</h4>
                    <p className="text-xs text-[#716B82] max-w-md mx-auto">
                      Authorized administrators can generate and publish products with cover images and private delivery links directly from the menu.
                    </p>
                    {(isOwner || isAdmin) && onOpenAdminGenerator && (
                      <button
                        onClick={() => { onClose(); onOpenAdminGenerator(); }}
                        className="mt-2 px-5 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold transition cursor-pointer shadow-xs inline-flex items-center space-x-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Product to Generate Update</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {products.map((product) => {
                      const isPurchasingThis = purchasingProductId === product.id;
                      const hasPurchased = purchasedOrders.some((o) => o.productId === product.id);

                      return (
                        <div
                          key={product.id}
                          className="bg-white border border-[#E9E2FA] hover:border-[#C4B5FD] rounded-2xl sm:rounded-[24px] overflow-hidden flex flex-col shadow-xs hover:shadow-md transition-all duration-200 group"
                        >
                          {/* PRODUCT COVER IMAGE */}
                          <div className="relative aspect-[16/10] w-full bg-[#F3F0FF] overflow-hidden border-b border-[#E9E2FA]">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-[#7C3AED]/30 space-y-1">
                                <ImageIcon className="w-10 h-10" />
                                <span className="text-[11px] font-bold text-[#7C3AED]/60">ZENET UPDATE</span>
                              </div>
                            )}

                            {/* Official Update Badge */}
                            <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md border border-[#DDD6FE] text-[#7C3AED] text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg flex items-center space-x-1.5 shadow-xs">
                              <Sparkles className="w-3 h-3 text-[#7C3AED]" />
                              <span>OFFICIAL UPDATE</span>
                            </div>

                            {/* Unlocked Badge */}
                            {hasPurchased && (
                              <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg flex items-center space-x-1 shadow-xs">
                                <CheckCircle2 className="w-3 h-3 text-white" />
                                <span>UNLOCKED</span>
                              </div>
                            )}
                          </div>

                          {/* PRODUCT DETAILS */}
                          <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4 bg-white">
                            <div className="space-y-1.5">
                              <h4 className="text-base sm:text-lg font-black text-[#171329] tracking-tight leading-snug">
                                {product.name}
                              </h4>
                              <p className="text-xs text-[#58516D] leading-relaxed line-clamp-3">
                                {product.description}
                              </p>
                            </div>

                            <div className="pt-3 border-t border-[#F1ECFD] space-y-3">
                              {/* Price Display */}
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#716B82]">
                                  Price
                                </span>
                                <div className="text-lg sm:text-xl font-black text-[#171329] font-mono flex items-center space-x-0.5">
                                  <span className="text-[#7C3AED]">₦</span>
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
                                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-xs flex items-center justify-center space-x-2 cursor-pointer"
                                >
                                  <Unlock className="w-4 h-4" />
                                  <span>VIEW UNLOCKED PRODUCT</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleBuyProduct(product)}
                                  disabled={isPurchasingThis}
                                  className="w-full py-3 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] active:bg-[#5B21B6] text-white font-extrabold text-xs uppercase tracking-wider transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 active:scale-[0.99]"
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
                  <div className="py-16 text-center bg-white border border-dashed border-[#DDD6FE] rounded-3xl p-8 space-y-3 shadow-xs">
                    <Lock className="w-10 h-10 text-[#7C3AED]/40 mx-auto" />
                    <h4 className="text-base font-bold text-[#171329]">Sign In to View Your Purchases</h4>
                    <p className="text-xs text-[#716B82] max-w-sm mx-auto">
                      Log in to access your unlocked private delivery links and purchased update products.
                    </p>
                    {onOpenAuth && (
                      <button
                        onClick={() => { onClose(); onOpenAuth('login'); }}
                        className="px-5 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold transition cursor-pointer shadow-xs"
                      >
                        Sign In Now
                      </button>
                    )}
                  </div>
                ) : purchasedOrders.length === 0 ? (
                  <div className="py-16 text-center bg-white border border-dashed border-[#DDD6FE] rounded-3xl p-8 space-y-3 shadow-xs">
                    <ShoppingBag className="w-10 h-10 text-[#7C3AED]/40 mx-auto" />
                    <h4 className="text-base font-bold text-[#171329]">No Purchased Updates Yet</h4>
                    <p className="text-xs text-[#716B82] max-w-sm mx-auto">
                      When you purchase products from ZENET HUB Update, your private delivery links unlock instantly here.
                    </p>
                    <button
                      onClick={() => setActiveTab('marketplace')}
                      className="px-5 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold transition cursor-pointer shadow-xs"
                    >
                      Browse Products
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {purchasedOrders.map((order) => (
                      <div
                        key={order.id}
                        className="p-4 rounded-2xl bg-white border border-[#E9E2FA] hover:border-[#C4B5FD] transition duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
                      >
                        <div className="flex items-center space-x-3.5">
                          {order.productImage ? (
                            <img
                              src={order.productImage}
                              alt={order.productName}
                              className="w-14 h-14 rounded-xl object-cover border border-[#E9E2FA] shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-[#EDE9FE] border border-[#DDD6FE] flex items-center justify-center shrink-0 text-[#7C3AED]">
                              <Unlock className="w-6 h-6" />
                            </div>
                          )}
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2 flex-wrap">
                              <h4 className="font-extrabold text-[#171329] text-sm">{order.productName}</h4>
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] uppercase font-bold px-2 py-0.5 rounded">
                                ACTIVE ACCESS
                              </span>
                            </div>
                            <div className="flex items-center space-x-3 text-[11px] text-[#716B82] font-mono">
                              <span>Paid: ₦{order.price.toLocaleString()}</span>
                              <span>•</span>
                              <span>{new Date(order.purchasedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openDeliveryLink(order.secretDeliveryInfo)}
                            className="px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-extrabold text-xs uppercase tracking-wider flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
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
                <div className="text-[11px] font-black uppercase tracking-widest text-[#7C3AED]">
                  Platform Infrastructure Upgrades
                </div>

                <div className="space-y-3">
                  {systemUpdates.map((item) => {
                    const IconComp = item.icon;
                    return (
                      <div 
                        key={item.id}
                        className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E9E2FA] hover:border-[#C4B5FD] transition duration-200 space-y-2 group shadow-xs"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="p-2.5 rounded-xl bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE] shrink-0">
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2 flex-wrap">
                              <h4 className="font-bold text-[#171329] text-sm">{item.title}</h4>
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded border uppercase bg-[#EDE9FE] text-[#6D28D9] border-[#DDD6FE]">
                                {item.tag}
                              </span>
                            </div>
                            <span className="text-[10px] text-[#716B82] font-mono">{item.date}</span>
                          </div>
                        </div>

                        <p className="text-xs text-[#58516D] leading-relaxed pl-1">
                          {item.description}
                        </p>

                        {item.actionText && item.actionKey && onNavigateService && (
                          <div className="pt-1 pl-1">
                            <button
                              onClick={() => {
                                onClose();
                                onNavigateService(item.actionKey);
                              }}
                              className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#7C3AED] hover:text-[#5B21B6] transition cursor-pointer"
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
          <div className="p-4 bg-[#F8F7FF] border-t border-[#E9E2FA] flex items-center justify-between text-xs">
            <span className="text-[#716B82] font-medium">
              Real-time escrow-backed digital deliveries.
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold transition cursor-pointer shadow-xs"
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
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div 
            className="relative w-full max-w-md bg-white border border-[#E9E2FA] rounded-[28px] shadow-2xl p-6 text-center text-[#171329] space-y-5 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 shadow-sm animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                PURCHASE SUCCESSFUL
              </span>
              <h3 className="text-xl font-black text-[#171329] tracking-tight mt-2">
                Your product is ready.
              </h3>
              <p className="text-xs text-[#58516D]">
                You have successfully acquired <strong className="text-[#171329]">"{unlockedOrder.productName}"</strong>. Your private delivery link has been unlocked below.
              </p>
            </div>

            {/* Unlocked Link Box */}
            <div className="p-4 rounded-2xl bg-[#F8F7FF] border border-[#E9E2FA] text-left space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black uppercase text-emerald-700">
                <span className="flex items-center space-x-1.5">
                  <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Private Delivery Access</span>
                </span>
                <span className="text-[10px] text-emerald-600 font-mono">UNLOCKED</span>
              </div>
              <p className="text-xs text-[#171329] font-mono break-all select-all bg-white p-2.5 rounded-xl border border-[#E9E2FA]">
                {unlockedOrder.secretDeliveryInfo}
              </p>
            </div>

            {/* Actions: [ 🔓 OPEN PRODUCT ] and Dismiss */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => openDeliveryLink(unlockedOrder.secretDeliveryInfo)}
                className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-sm uppercase tracking-wider transition-all shadow-sm flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
              >
                <span>🔓 OPEN PRODUCT</span>
                <ExternalLink className="w-4 h-4" />
              </button>

              <button
                onClick={() => setUnlockedOrder(null)}
                className="w-full py-2.5 text-xs text-[#716B82] hover:text-[#171329] font-bold transition cursor-pointer"
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
