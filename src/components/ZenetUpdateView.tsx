import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, sanitizeFirestorePayload } from '../lib/firebase';
import { UserProfile, ZenedUpdateProduct, ZenedUpdateOrder, WalletTransaction } from '../types';
import { 
  Sparkles, 
  ArrowLeft, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  ShoppingCart, 
  Lock, 
  Unlock, 
  Copy, 
  Check, 
  ExternalLink, 
  Upload, 
  Package, 
  AlertCircle, 
  X, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Tag, 
  Layers, 
  RefreshCw, 
  ShieldCheck, 
  Info,
  Clock,
  Key,
  DollarSign,
  Boxes,
  ShoppingBag
} from 'lucide-react';

interface ZenetUpdateViewProps {
  user: User | null;
  userProfile: UserProfile | null;
  walletBalance: number;
  onBackToMarketplace: () => void;
  onOpenWallet: () => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onRefreshProfile?: () => void;
}

const CATEGORY_TAGS = [
  'All',
  'Tools & Software',
  'Methods & Guides',
  'Digital Assets',
  'Updates & Scripts',
  'VIP Access',
  'Other'
];

export const ZenetUpdateView: React.FC<ZenetUpdateViewProps> = ({
  user,
  userProfile,
  walletBalance,
  onBackToMarketplace,
  onOpenWallet,
  onOpenAuth,
  onRefreshProfile
}) => {
  // Check admin/owner permissions
  const isOwner = user?.email?.toLowerCase() === 'azeezmusharaf4@gmail.com';
  const isAdmin = isOwner || userProfile?.role === 'admin' || userProfile?.role === 'owner';

  // Products state
  const [products, setProducts] = useState<ZenedUpdateProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // User orders state
  const [myOrders, setMyOrders] = useState<ZenedUpdateOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);

  // Active sub-tab: 'marketplace' | 'my-orders'
  const [activeTab, setActiveTab] = useState<'marketplace' | 'my-orders'>('marketplace');

  // Filter & search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Modal states
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ZenedUpdateProduct | null>(null);

  // Form states for Add/Edit
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategory, setFormCategory] = useState('Tools & Software');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formStock, setFormStock] = useState('10');
  const [formSecretInfo, setFormSecretInfo] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'out_of_stock'>('active');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Purchase Confirmation & Success States
  const [confirmingProduct, setConfirmingProduct] = useState<ZenedUpdateProduct | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchasedOrderSuccess, setPurchasedOrderSuccess] = useState<ZenedUpdateOrder | null>(null);
  const [insufficientFundsFor, setInsufficientFundsFor] = useState<ZenedUpdateProduct | null>(null);

  // Secret Info View Modal for past orders
  const [viewingSecretOrder, setViewingSecretOrder] = useState<ZenedUpdateOrder | null>(null);

  // Copied state helper
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // 1. Listen for Products in Firestore
  useEffect(() => {
    setLoading(true);
    const productsRef = collection(db, 'zenedUpdateProducts');
    const unsubscribe = onSnapshot(
      productsRef,
      (snapshot) => {
        const list: ZenedUpdateProduct[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        // Sort newest first
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setProducts(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching zenedUpdateProducts:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. Listen for User Orders in Firestore if logged in
  useEffect(() => {
    if (!user?.uid) {
      setMyOrders([]);
      return;
    }

    setLoadingOrders(true);
    const ordersRef = collection(db, 'zenedUpdateOrders');
    const q = query(ordersRef, where('buyerId', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ZenedUpdateOrder[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        list.sort((a, b) => new Date(b.purchasedAt || 0).getTime() - new Date(a.purchasedAt || 0).getTime());
        setMyOrders(list);
        setLoadingOrders(false);
      },
      (error) => {
        console.error('Error fetching zenedUpdateOrders:', error);
        setLoadingOrders(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      // Category filter
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }
      // Search query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchName = item.name?.toLowerCase().includes(query);
        const matchDesc = item.description?.toLowerCase().includes(query);
        const matchCat = item.category?.toLowerCase().includes(query);
        return matchName || matchDesc || matchCat;
      }
      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormPrice('');
    setFormCategory('Tools & Software');
    setFormDescription('');
    setFormImageUrl('');
    setFormStock('10');
    setFormSecretInfo('');
    setFormStatus('active');
    setFormError('');
    setIsAddEditModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (prod: ZenedUpdateProduct) => {
    setEditingProduct(prod);
    setFormName(prod.name || '');
    setFormPrice(prod.price ? String(prod.price) : '');
    setFormCategory(prod.category || 'Tools & Software');
    setFormDescription(prod.description || '');
    setFormImageUrl(prod.imageUrl || '');
    setFormStock(prod.stock !== undefined ? String(prod.stock) : '10');
    setFormSecretInfo(prod.secretDeliveryInfo || '');
    setFormStatus(prod.status === 'out_of_stock' ? 'out_of_stock' : 'active');
    setFormError('');
    setIsAddEditModalOpen(true);
  };

  // Image Upload handler
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFormError('Image size exceeds 10MB limit.');
      return;
    }

    try {
      setIsUploadingImage(true);
      setUploadProgress(10);

      const storageRef = ref(storage, `zened_products/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Storage upload error:', error);
          setFormError('Failed to upload image to Firebase Storage. You can also paste an image URL directly.');
          setIsUploadingImage(false);
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          setFormImageUrl(downloadUrl);
          setIsUploadingImage(false);
          setUploadProgress(100);
        }
      );
    } catch (err: any) {
      console.error('Upload handler error:', err);
      setFormError(err?.message || 'Upload failed');
      setIsUploadingImage(false);
    }
  };

  // Save/Update Product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Product Name is required.');
      return;
    }
    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError('Please enter a valid price in ₦ NGN.');
      return;
    }
    if (!formDescription.trim()) {
      setFormError('Description is required.');
      return;
    }
    if (!formSecretInfo.trim()) {
      setFormError('Secret Delivery Information is required so the buyer receives access upon purchase.');
      return;
    }

    const stockNum = parseInt(formStock, 10);
    const validStock = isNaN(stockNum) ? 1 : Math.max(0, stockNum);

    setFormSubmitting(true);
    try {
      if (editingProduct) {
        // Update existing product
        const prodRef = doc(db, 'zenedUpdateProducts', editingProduct.id);
        const updateData: Partial<ZenedUpdateProduct> = {
          name: formName.trim(),
          price: priceNum,
          category: formCategory,
          description: formDescription.trim(),
          imageUrl: formImageUrl.trim() || undefined,
          stock: validStock,
          status: validStock === 0 ? 'out_of_stock' : formStatus,
          secretDeliveryInfo: formSecretInfo.trim(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(prodRef, sanitizeFirestorePayload(updateData), { merge: true });
      } else {
        // Create new product
        const newDocRef = doc(collection(db, 'zenedUpdateProducts'));
        const newProduct: ZenedUpdateProduct = {
          id: newDocRef.id,
          name: formName.trim(),
          price: priceNum,
          category: formCategory,
          description: formDescription.trim(),
          imageUrl: formImageUrl.trim() || undefined,
          stock: validStock,
          status: validStock === 0 ? 'out_of_stock' : formStatus,
          secretDeliveryInfo: formSecretInfo.trim(),
          createdBy: user?.uid || 'admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(newDocRef, sanitizeFirestorePayload(newProduct));
      }

      setIsAddEditModalOpen(false);
      setEditingProduct(null);
    } catch (err: any) {
      console.error('Error saving product:', err);
      setFormError(err?.message || 'Failed to save product. Please check connection.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${productName}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'zenedUpdateProducts', productId));
    } catch (err: any) {
      console.error('Error deleting product:', err);
      alert('Failed to delete product: ' + (err?.message || 'Error occurred'));
    }
  };

  // Trigger Buy Flow
  const handleInitiateBuy = (prod: ZenedUpdateProduct) => {
    if (!user) {
      onOpenAuth('login');
      return;
    }

    if (prod.status === 'out_of_stock' || (prod.stock !== undefined && prod.stock <= 0)) {
      alert('This product is currently out of stock.');
      return;
    }

    // Check balance
    if (walletBalance < prod.price) {
      setInsufficientFundsFor(prod);
      return;
    }

    // Prompt purchase confirmation
    setConfirmingProduct(prod);
  };

  // Execute Purchase
  const handleExecutePurchase = async () => {
    if (!user || !confirmingProduct) return;

    const prod = confirmingProduct;
    setIsPurchasing(true);

    try {
      // 1. Double check fresh wallet balance from Firestore
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      let currentBalance = walletBalance;
      if (userSnap.exists()) {
        const bal = userSnap.data().walletBalance;
        currentBalance = typeof bal === 'number' ? bal : Number(bal || 0);
      }

      if (currentBalance < prod.price) {
        setIsPurchasing(false);
        setConfirmingProduct(null);
        setInsufficientFundsFor(prod);
        return;
      }

      // 2. Fetch fresh secret delivery info from product doc
      const prodRef = doc(db, 'zenedUpdateProducts', prod.id);
      const prodSnap = await getDoc(prodRef);
      let deliveryInfo = prod.secretDeliveryInfo || 'No secret delivery details found. Please contact support.';
      let remainingStock = (prod.stock ?? 1) - 1;

      if (prodSnap.exists()) {
        const data = prodSnap.data() as ZenedUpdateProduct;
        if (data.secretDeliveryInfo) {
          deliveryInfo = data.secretDeliveryInfo;
        }
        if (data.stock !== undefined) {
          remainingStock = Math.max(0, data.stock - 1);
        }
      }

      const txId = `ZENED_TX_${Date.now()}`;
      const newBalance = currentBalance - prod.price;

      // 3. Deduct wallet balance
      await setDoc(
        userRef,
        {
          walletBalance: newBalance,
          totalPurchasesAmount: (userProfile?.totalPurchasesAmount || 0) + prod.price
        },
        { merge: true }
      );

      // 4. Create wallet_transactions record
      const walletTx: WalletTransaction = {
        id: `tx-${Date.now()}`,
        userId: user.uid,
        type: 'purchase',
        amount: prod.price,
        description: `ZENED U Update: ${prod.name}`,
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        status: 'completed',
        reference: txId
      };
      await addDoc(collection(db, 'wallet_transactions'), walletTx);

      // 5. Create zenedUpdateOrders record (with secret delivery info)
      const orderRef = doc(collection(db, 'zenedUpdateOrders'));
      const orderRecord: ZenedUpdateOrder = {
        id: orderRef.id,
        productId: prod.id,
        productName: prod.name,
        productImage: prod.imageUrl,
        price: prod.price,
        buyerId: user.uid,
        buyerEmail: user.email || '',
        buyerName: user.displayName || user.email?.split('@')[0] || 'Buyer',
        secretDeliveryInfo: deliveryInfo,
        purchasedAt: new Date().toISOString(),
        status: 'completed',
        transactionId: txId
      };
      await setDoc(orderRef, sanitizeFirestorePayload(orderRecord));

      // 6. Also create a standard purchase record for universal order history
      const globalPurchaseRef = doc(collection(db, 'purchases'));
      await setDoc(globalPurchaseRef, sanitizeFirestorePayload({
        id: globalPurchaseRef.id,
        listingId: prod.id,
        listingTitle: `[ZENED UPDATE] ${prod.name}`,
        category: 'Other',
        price: prod.price,
        paidAmount: prod.price,
        currency: 'NGN',
        sellerId: prod.createdBy || 'admin',
        sellerName: 'ZENET HUB Official',
        sellerEmail: 'support@zenethub.com',
        buyerId: user.uid,
        buyerName: user.displayName || user.email?.split('@')[0] || 'Buyer',
        buyerEmail: user.email || '',
        paymentGateway: 'wallet',
        transactionId: txId,
        purchasedAt: new Date().toISOString(),
        status: 'completed',
        transferCode: `ZENED-${Math.floor(1000 + Math.random() * 9000)}-DELIVERY`,
        imageUrl: prod.imageUrl,
        digitalProductDetails: {
          additionalInstructions: deliveryInfo
        }
      }));

      // 7. Update product stock in Firestore
      await setDoc(
        prodRef,
        {
          stock: remainingStock,
          status: remainingStock <= 0 ? 'out_of_stock' : prod.status
        },
        { merge: true }
      );

      // 8. Refresh profile balance
      if (onRefreshProfile) {
        onRefreshProfile();
      }

      setConfirmingProduct(null);
      setPurchasedOrderSuccess(orderRecord);
    } catch (err: any) {
      console.error('Error executing purchase:', err);
      alert('Purchase failed: ' + (err?.message || 'Unknown error occurred.'));
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div id="zened-update-section" className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-16">
      
      {/* 1. Header Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2b165c]/60">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMarketplace}
            className="flex items-center gap-2 text-purple-200 hover:text-white font-black text-xs transition bg-[#170c30] hover:bg-[#221047] px-4 py-2.5 rounded-xl border border-purple-900/40 cursor-pointer shadow-sm active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Marketplace</span>
          </button>

          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-purple-950/40 border border-purple-500/20 text-[10px] font-black uppercase tracking-wider text-purple-300">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>Official Digital Catalog</span>
          </div>
        </div>

        {/* User Balance & Fund Button */}
        <div className="flex items-center space-x-3 self-end sm:self-auto">
          <div className="flex items-center space-x-2 bg-[#12082b] border border-[#2b165c] px-3.5 py-1.5 rounded-xl">
            <span className="text-[10px] font-bold text-purple-300/60 uppercase">Wallet</span>
            <span className="text-sm font-black text-white font-mono">₦{walletBalance.toLocaleString()}</span>
          </div>
          <button
            onClick={onOpenWallet}
            className="px-3.5 py-1.5 rounded-xl bg-[#7d4cf7] hover:bg-[#8e5ff9] text-white font-black text-xs transition cursor-pointer shadow-md active:scale-95 flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Fund</span>
          </button>
        </div>
      </div>

      {/* 2. Hero Presentation Banner */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1c0d3d] via-[#12082b] to-[#0c051f] border border-[#3b1c78] p-6 sm:p-8 shadow-[0_0_50px_rgba(125,76,247,0.15)]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#7d4cf7]/20 border border-[#7d4cf7]/40 text-[#c8a6ff] text-[10px] font-black uppercase tracking-wider">
                ZENED U UPDATE SYSTEM
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase">
                Instant Auto-Delivery
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              ZENED U Update Products & Digital Releases
            </h1>
            <p className="text-xs sm:text-sm text-purple-200/70 leading-relaxed">
              Explore verified software tools, exclusive scripts, private guides, and premium digital updates. Purchased items immediately deliver private credentials, links, and license data to your account.
            </p>
          </div>

          {/* Admin Add Button */}
          {isAdmin && (
            <div className="shrink-0 flex flex-col items-start sm:items-end gap-2 bg-[#1b0d3d]/80 border border-[#4a2496] p-4 rounded-2xl">
              <div className="flex items-center space-x-2 text-[11px] font-black text-[#c8a6ff]">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Admin Management Mode</span>
              </div>
              <button
                id="admin-add-zened-product-btn"
                onClick={handleOpenAddModal}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs uppercase tracking-wider transition-all duration-200 shadow-lg shadow-emerald-900/30 flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Product</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs: Products vs My Purchased Updates */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#210f3f] pb-3">
        <div className="flex items-center space-x-2 bg-[#0c051f] p-1.5 rounded-2xl border border-[#210f3f]">
          <button
            onClick={() => setActiveTab('marketplace')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center space-x-2 ${
              activeTab === 'marketplace'
                ? 'bg-gradient-to-r from-[#7d4cf7] to-[#9e67fa] text-white shadow-md'
                : 'text-purple-300/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Product Catalog</span>
            <span className="bg-black/30 px-1.5 py-0.5 rounded text-[10px]">{products.length}</span>
          </button>

          <button
            onClick={() => {
              if (!user) {
                onOpenAuth('login');
                return;
              }
              setActiveTab('my-orders');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center space-x-2 ${
              activeTab === 'my-orders'
                ? 'bg-gradient-to-r from-[#7d4cf7] to-[#9e67fa] text-white shadow-md'
                : 'text-purple-300/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>My Purchased Updates</span>
            {user && (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px]">
                {myOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Bar */}
        {activeTab === 'marketplace' && (
          <div className="relative flex-1 max-w-xs min-w-[220px]">
            <Search className="w-4 h-4 text-purple-400/60 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, tools, guides..."
              className="w-full bg-[#0c051f] border border-[#210f3f] focus:border-[#7d4cf7] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-purple-300/40 focus:outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-400 hover:text-white text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. Category Filter Pills (Marketplace Tab) */}
      {activeTab === 'marketplace' && (
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_TAGS.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer border ${
                  isSelected
                    ? 'bg-[#7d4cf7]/25 text-[#d8baff] border-[#7d4cf7] shadow-sm'
                    : 'bg-[#0c051f] text-purple-300/60 border-[#210f3f] hover:border-purple-800/60 hover:text-purple-200'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* 5. MAIN CONTENT: PRODUCT CATALOG TAB */}
      {activeTab === 'marketplace' && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-96 rounded-[24px] bg-[#12082b]/80 border border-[#24114f] animate-pulse p-4 flex flex-col justify-between"
                >
                  <div className="w-full h-48 bg-[#1f0e42] rounded-2xl" />
                  <div className="space-y-2">
                    <div className="h-5 bg-[#1f0e42] rounded-lg w-3/4" />
                    <div className="h-3 bg-[#1f0e42] rounded-lg w-full" />
                  </div>
                  <div className="h-10 bg-[#281354] rounded-xl" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center rounded-[28px] bg-[#0c051f] border border-[#210f3f] space-y-4 max-w-lg mx-auto my-6">
              <div className="w-16 h-16 rounded-2xl bg-purple-950/40 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-400">
                <Package className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-white">No Products Available Yet</h3>
                <p className="text-xs text-purple-300/60">
                  {searchQuery || selectedCategory !== 'All'
                    ? 'No products match your active search or category filters.'
                    : 'The ZENED U Update catalog is being refreshed. Check back shortly!'}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={handleOpenAddModal}
                  className="px-5 py-2.5 rounded-xl bg-[#7d4cf7] hover:bg-[#8e5ff9] text-white font-black text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  + Add First Product
                </button>
              )}
            </div>
          ) : (
            /* Large Visual Product Cards Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => {
                const isOutOfStock = product.status === 'out_of_stock' || (product.stock !== undefined && product.stock <= 0);

                return (
                  <div
                    key={product.id}
                    className="group relative flex flex-col justify-between rounded-[26px] bg-[#0f0724] border border-[#24114f] hover:border-[#6032bd] transition-all duration-300 overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(125,76,247,0.2)]"
                  >
                    {/* Top Image Container with Visual Backdrop */}
                    <div className="relative w-full h-52 sm:h-56 bg-[#170b36] overflow-hidden flex items-center justify-center">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            // Fallback if image breaks
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1f0e42] to-[#0c051f] p-4 text-center">
                          <Sparkles className="w-10 h-10 text-[#a578ff] mb-2" />
                          <span className="text-xs font-black text-purple-200/80 uppercase tracking-widest">
                            {product.category || 'ZENED UPDATE'}
                          </span>
                        </div>
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                        <span className="px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-white text-[10px] font-black uppercase tracking-wider shadow-md">
                          {product.category || 'Update'}
                        </span>
                        {isOutOfStock ? (
                          <span className="px-2 py-1 rounded-lg bg-red-500/80 backdrop-blur-md text-white text-[10px] font-black uppercase shadow-md">
                            Out of Stock
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-lg bg-emerald-500/80 backdrop-blur-md text-white text-[10px] font-black uppercase shadow-md flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span>In Stock ({product.stock ?? 'Available'})</span>
                          </span>
                        )}
                      </div>

                      {/* Admin Quick Action Buttons */}
                      {isAdmin && (
                        <div className="absolute top-3 right-3 flex items-center space-x-1.5 bg-black/70 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-lg">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(product);
                            }}
                            className="p-1.5 rounded-lg bg-purple-600/60 hover:bg-purple-600 text-white transition cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProduct(product.id, product.name);
                            }}
                            className="p-1.5 rounded-lg bg-red-600/60 hover:bg-red-600 text-white transition cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Bottom Image Gradient Overlay */}
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0f0724] to-transparent pointer-events-none" />
                    </div>

                    {/* Card Body */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-base sm:text-lg font-black text-white leading-tight group-hover:text-[#c49aff] transition-colors">
                          {product.name}
                        </h3>
                        <p className="text-xs text-purple-200/70 leading-relaxed line-clamp-3">
                          {product.description}
                        </p>
                      </div>

                      {/* Security & Instant Delivery Guarantee Pill */}
                      <div className="flex items-center space-x-2 text-[10px] font-bold text-emerald-300/80 bg-emerald-950/30 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl">
                        <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">Secret Delivery Info unlocked upon purchase</span>
                      </div>

                      {/* Price and Buy Button */}
                      <div className="pt-3 border-t border-[#210f3f] flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-extrabold text-purple-400/60 uppercase tracking-wider block">
                            Price
                          </span>
                          <span className="text-lg sm:text-xl font-black text-white font-mono tracking-tight">
                            ₦{product.price.toLocaleString()}
                          </span>
                        </div>

                        <button
                          disabled={isOutOfStock}
                          onClick={() => handleInitiateBuy(product)}
                          className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center space-x-1.5 shadow-md active:scale-95 ${
                            isOutOfStock
                              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                              : 'bg-gradient-to-r from-[#7d4cf7] to-[#a16eff] hover:from-[#8e5ff9] hover:to-[#b080ff] text-white shadow-purple-900/40 hover:shadow-purple-900/60'
                          }`}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>{isOutOfStock ? 'Sold Out' : 'Buy Now'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 6. SECOND TAB: MY PURCHASED UPDATES */}
      {activeTab === 'my-orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-white tracking-tight flex items-center space-x-2">
                <ShoppingBag className="w-5 h-5 text-emerald-400" />
                <span>My Purchased ZENED U Updates</span>
              </h2>
              <p className="text-xs text-purple-300/60">
                All software licenses, secret login instructions, and download packages you have acquired are stored here permanently.
              </p>
            </div>
          </div>

          {loadingOrders ? (
            <div className="p-8 text-center text-purple-300/60 font-medium text-xs">
              Loading your purchased items...
            </div>
          ) : myOrders.length === 0 ? (
            <div className="p-12 text-center rounded-[24px] bg-[#0c051f] border border-[#210f3f] space-y-3 max-w-md mx-auto my-4">
              <Package className="w-10 h-10 text-purple-400/40 mx-auto" />
              <h3 className="text-base font-black text-white">No Purchased Updates Yet</h3>
              <p className="text-xs text-purple-300/60">
                You have not purchased any products from the ZENED U Update catalog yet.
              </p>
              <button
                onClick={() => setActiveTab('marketplace')}
                className="px-4 py-2 rounded-xl bg-[#7d4cf7] text-white font-black text-xs transition cursor-pointer"
              >
                Browse Catalog
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {myOrders.map((order) => {
                return (
                  <div
                    key={order.id}
                    className="p-5 rounded-2xl bg-[#0e0621] border border-[#251252] hover:border-[#4d24a3] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="w-14 h-14 rounded-2xl bg-[#1b0d3d] border border-[#371973] overflow-hidden shrink-0 flex items-center justify-center text-purple-300">
                        {order.productImage ? (
                          <img
                            src={order.productImage}
                            alt={order.productName}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Package className="w-6 h-6 text-[#9e67fa]" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <h4 className="font-black text-white text-base">{order.productName}</h4>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase">
                            Delivered
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-xs text-purple-300/60 font-mono">
                          <span>₦{order.price.toLocaleString()}</span>
                          <span>•</span>
                          <span>{new Date(order.purchasedAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span className="text-[10px] text-purple-400">TX: {order.transactionId?.slice(-8) || order.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </div>

                    {/* View Secret Delivery Info Button */}
                    <button
                      onClick={() => setViewingSecretOrder(order)}
                      className="px-4 py-2.5 rounded-xl bg-[#1c0e3d] hover:bg-[#2b165c] border border-[#4a2394] text-white font-black text-xs transition cursor-pointer flex items-center justify-center space-x-2 shadow-sm"
                    >
                      <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>View Secret Delivery Info</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD / EDIT PRODUCT MODAL (ADMIN ONLY)          */}
      {/* ======================================================== */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-xl bg-[#0c051f] border border-[#3b1c78] rounded-[28px] shadow-[0_0_50px_rgba(125,76,247,0.3)] overflow-hidden my-auto max-h-[92vh] flex flex-col text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-b from-[#1b0d3d] to-[#0c051f] border-b border-[#2b165c] flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-[#2a1359] border border-[#7d4cf7]/40 text-[#c8a6ff]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    {editingProduct ? 'Edit ZENED Update Product' : 'Add New ZENED Update Product'}
                  </h3>
                  <p className="text-xs text-purple-300/60">
                    Provide complete product metadata and private delivery info.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/40 text-red-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Product Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-purple-200 uppercase tracking-wider block">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. VIP Telegram Auto-Forwarder Bot 2026"
                  className="w-full bg-[#14082e] border border-[#2a1459] focus:border-[#7d4cf7] rounded-xl px-4 py-2.5 text-xs text-white placeholder-purple-300/40 focus:outline-none"
                />
              </div>

              {/* Price & Stock Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-purple-200 uppercase tracking-wider block">
                    Price (₦ NGN) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full bg-[#14082e] border border-[#2a1459] focus:border-[#7d4cf7] rounded-xl px-4 py-2.5 text-xs text-white placeholder-purple-300/40 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-purple-200 uppercase tracking-wider block">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full bg-[#14082e] border border-[#2a1459] focus:border-[#7d4cf7] rounded-xl px-4 py-2.5 text-xs text-white placeholder-purple-300/40 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Category & Status Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-purple-200 uppercase tracking-wider block">
                    Category Tag
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-[#14082e] border border-[#2a1459] focus:border-[#7d4cf7] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {CATEGORY_TAGS.filter((c) => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-purple-200 uppercase tracking-wider block">
                    Product Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full bg-[#14082e] border border-[#2a1459] focus:border-[#7d4cf7] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="active">Active (Available for purchase)</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>
              </div>

              {/* Short Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-purple-200 uppercase tracking-wider block">
                  Short Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Provide a clear, compelling description of this update, script, or digital service..."
                  className="w-full bg-[#14082e] border border-[#2a1459] focus:border-[#7d4cf7] rounded-xl px-4 py-2.5 text-xs text-white placeholder-purple-300/40 focus:outline-none"
                />
              </div>

              {/* Product Image: Upload & URL */}
              <div className="space-y-2">
                <label className="text-xs font-black text-purple-200 uppercase tracking-wider block">
                  Product Image (Large Visual Layout)
                </label>

                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <input
                    type="url"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="Paste Image URL (https://...)"
                    className="flex-1 w-full bg-[#14082e] border border-[#2a1459] focus:border-[#7d4cf7] rounded-xl px-4 py-2.5 text-xs text-white placeholder-purple-300/40 focus:outline-none"
                  />
                  
                  <label className="px-4 py-2.5 rounded-xl bg-[#281354] hover:bg-[#381a74] text-purple-200 hover:text-white font-bold text-xs cursor-pointer border border-[#4e279c] shrink-0 flex items-center space-x-2 transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {isUploadingImage && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-purple-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-purple-300/60 font-mono">
                      Uploading image... {uploadProgress}%
                    </span>
                  </div>
                )}

                {/* Image Preview */}
                {formImageUrl && (
                  <div className="relative w-full h-32 rounded-xl bg-[#14082e] border border-[#2a1459] overflow-hidden">
                    <img
                      src={formImageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => setFormImageUrl('')}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/70 text-white hover:bg-black"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* CRITICAL: Secret Delivery Information Field */}
              <div className="space-y-1.5 bg-[#1b0d38] border border-amber-500/30 p-4 rounded-2xl">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Secret Delivery Information *</span>
                  </label>
                  <span className="text-[10px] font-bold text-amber-300/70 uppercase">
                    🔒 STRICTLY PRIVATE
                  </span>
                </div>
                <p className="text-[11px] text-purple-200/70 leading-relaxed">
                  This content is strictly private and will <strong>NEVER</strong> be displayed publicly. It is automatically revealed to the buyer only after their wallet payment is confirmed.
                </p>
                <textarea
                  rows={4}
                  required
                  value={formSecretInfo}
                  onChange={(e) => setFormSecretInfo(e.target.value)}
                  placeholder="Enter login credentials, private download links, API tokens, license keys, or step-by-step access instructions..."
                  className="w-full bg-[#110526] border border-amber-500/40 focus:border-amber-400 rounded-xl px-4 py-2.5 text-xs text-white placeholder-purple-300/40 focus:outline-none font-mono"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-[#210f3f] flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || isUploadingImage}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Publish Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: PURCHASE CONFIRMATION MODAL                     */}
      {/* ======================================================== */}
      {confirmingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-md bg-[#0c051f] border border-[#3b1c78] rounded-[28px] shadow-[0_0_50px_rgba(125,76,247,0.4)] p-6 space-y-5 text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#210f3f] pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-[#2a1359] text-[#c8a6ff]">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-white">Confirm Product Purchase</h3>
              </div>
              <button
                onClick={() => setConfirmingProduct(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#14082e] border border-[#2b165c] p-4 rounded-2xl space-y-3">
              <div className="flex items-center space-x-3">
                {confirmingProduct.imageUrl ? (
                  <img
                    src={confirmingProduct.imageUrl}
                    alt={confirmingProduct.name}
                    className="w-12 h-12 rounded-xl object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-[#210f45] flex items-center justify-center text-purple-300">
                    <Package className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h4 className="font-black text-white text-sm">{confirmingProduct.name}</h4>
                  <span className="text-[10px] text-purple-300/60 uppercase font-mono">
                    {confirmingProduct.category}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#23114a] space-y-1 text-xs">
                <div className="flex justify-between text-purple-300/70">
                  <span>Product Price:</span>
                  <span className="font-black text-white font-mono">₦{confirmingProduct.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-purple-300/70">
                  <span>Your Current Balance:</span>
                  <span className="font-black text-emerald-400 font-mono">₦{walletBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-purple-300/70 pt-1 border-t border-[#23114a]">
                  <span>Balance After Purchase:</span>
                  <span className="font-black text-white font-mono">
                    ₦{(walletBalance - confirmingProduct.price).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/20 text-[11px] text-purple-200/80 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Instant auto-delivery: Secret access information is unlocked immediately.</span>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmingProduct(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                disabled={isPurchasing}
                onClick={handleExecutePurchase}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-lg active:scale-95 disabled:opacity-50 flex items-center space-x-1.5"
              >
                {isPurchasing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Pay & Unlock Access</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: PURCHASE SUCCESS & SECRET DELIVERY INFO REVEAL   */}
      {/* ======================================================== */}
      {purchasedOrderSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-lg bg-[#0c051f] border border-emerald-500/40 rounded-[28px] shadow-[0_0_60px_rgba(16,185,129,0.25)] p-6 sm:p-8 space-y-6 text-slate-200 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30 inline-block">
                Purchase Confirmed & Delivered
              </span>
              <h3 className="text-2xl font-black text-white tracking-tight">
                Access Unlocked!
              </h3>
              <p className="text-xs text-purple-200/70">
                Payment of <strong>₦{purchasedOrderSuccess.price.toLocaleString()}</strong> was completed successfully from your wallet.
              </p>
            </div>

            {/* Secret Delivery Info Display */}
            <div className="bg-[#15092e] border border-emerald-500/30 p-5 rounded-2xl space-y-3 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-300 text-xs font-black">
                  <Key className="w-4 h-4 text-emerald-400" />
                  <span>SECRET DELIVERY INFORMATION</span>
                </div>
                <button
                  onClick={() => handleCopy(purchasedOrderSuccess.secretDeliveryInfo, 'success-info')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  {copiedKey === 'success-info' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Info</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-[#090317] border border-[#2b165c] text-xs font-mono text-emerald-200 whitespace-pre-wrap break-all leading-relaxed select-all">
                {purchasedOrderSuccess.secretDeliveryInfo}
              </div>

              <p className="text-[10px] text-purple-300/50 italic">
                * You can also view this secret delivery information at any time under the "My Purchased Updates" tab.
              </p>
            </div>

            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={() => {
                  setPurchasedOrderSuccess(null);
                  setActiveTab('my-orders');
                }}
                className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-lg active:scale-95"
              >
                Go to My Purchased Updates
              </button>
              <button
                onClick={() => setPurchasedOrderSuccess(null)}
                className="w-full px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: VIEW SECRET INFO MODAL (PAST ORDER)             */}
      {/* ======================================================== */}
      {viewingSecretOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-lg bg-[#0c051f] border border-[#3b1c78] rounded-[28px] shadow-[0_0_50px_rgba(125,76,247,0.3)] p-6 space-y-5 text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#210f3f] pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-[#2a1359] text-emerald-400">
                  <Unlock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{viewingSecretOrder.productName}</h3>
                  <span className="text-[10px] text-purple-300/60 font-mono">
                    Purchased on {new Date(viewingSecretOrder.purchasedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewingSecretOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#c8a6ff] uppercase tracking-wider">
                  Secret Delivery Information
                </span>
                <button
                  onClick={() => handleCopy(viewingSecretOrder.secretDeliveryInfo, 'view-info')}
                  className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  {copiedKey === 'view-info' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#14082e] border border-[#2b165c] text-xs font-mono text-emerald-300 whitespace-pre-wrap break-all leading-relaxed select-all">
                {viewingSecretOrder.secretDeliveryInfo}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingSecretOrder(null)}
                className="px-5 py-2.5 rounded-xl bg-[#7d4cf7] hover:bg-[#8e5ff9] text-white font-black text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: INSUFFICIENT FUNDS ALERT MODAL                  */}
      {/* ======================================================== */}
      {insufficientFundsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-md bg-[#0c051f] border border-red-500/40 rounded-[28px] shadow-[0_0_50px_rgba(239,68,68,0.25)] p-6 space-y-4 text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Insufficient Wallet Balance</h3>
                <p className="text-xs text-purple-300/60">
                  You need more funds in your wallet to complete this purchase.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#14082e] border border-[#2b165c] space-y-2 text-xs">
              <div className="flex justify-between text-purple-300/70">
                <span>Product Price:</span>
                <span className="font-black text-white font-mono">₦{insufficientFundsFor.price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-purple-300/70">
                <span>Current Balance:</span>
                <span className="font-black text-red-400 font-mono">₦{walletBalance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-purple-300/70 pt-2 border-t border-[#23114a]">
                <span>Shortage:</span>
                <span className="font-black text-amber-300 font-mono">
                  ₦{(insufficientFundsFor.price - walletBalance).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setInsufficientFundsFor(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setInsufficientFundsFor(null);
                  onOpenWallet();
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7d4cf7] to-[#b37eff] hover:from-[#8e5ff9] hover:to-[#be8eff] text-white font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-lg active:scale-95"
              >
                Fund Wallet Now
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
