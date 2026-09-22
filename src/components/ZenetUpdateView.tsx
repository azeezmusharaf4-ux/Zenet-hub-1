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
import { isAuthorizedOwner } from '../lib/authorizedOwners';
import { copyToClipboard } from '../utils/clipboard';
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
  const isOwner = isAuthorizedOwner(user, userProfile);
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
    copyToClipboard(text);
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
    <div id="zened-update-section" className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-16 text-slate-800">
      
      {/* 1. Header Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMarketplace}
            className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-bold text-xs transition bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl border border-slate-200 cursor-pointer shadow-xs active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Marketplace</span>
          </button>

          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[10px] font-black uppercase tracking-wider text-blue-700">
            <Sparkles className="w-3 h-3 text-blue-600" />
            <span>Official Digital Catalog</span>
          </div>
        </div>

        {/* User Balance & Fund Button */}
        <div className="flex items-center space-x-3 self-end sm:self-auto">
          <div className="flex items-center space-x-2 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Wallet</span>
            <span className="text-sm font-black text-slate-900 font-mono">₦{walletBalance.toLocaleString()}</span>
          </div>
          <button
            onClick={onOpenWallet}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition cursor-pointer shadow-xs active:scale-95 flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Fund</span>
          </button>
        </div>
      </div>

      {/* 2. Hero Presentation Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-wider">
                ZENED U UPDATE SYSTEM
              </span>
              <span className="px-2 py-0.5 rounded-md bg-pink-50 border border-pink-200 text-pink-700 text-[10px] font-black uppercase">
                Instant Auto-Delivery
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
              ZENED U Update Products & Digital Releases
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Explore verified software tools, exclusive scripts, private guides, and premium digital updates. Purchased items immediately deliver private credentials, links, and license data to your account.
            </p>
          </div>

          {/* Admin Add Button */}
          {isAdmin && (
            <div className="shrink-0 flex flex-col items-start sm:items-end gap-2 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
              <div className="flex items-center space-x-2 text-[11px] font-black text-blue-700">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Admin Management Mode</span>
              </div>
              <button
                id="admin-add-zened-product-btn"
                onClick={handleOpenAddModal}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-all duration-200 shadow-xs flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Product</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs: Products vs My Purchased Updates */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveTab('marketplace')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center space-x-2 ${
              activeTab === 'marketplace'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Product Catalog</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${activeTab === 'marketplace' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>{products.length}</span>
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
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>My Purchased Updates</span>
            {user && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${activeTab === 'my-orders' ? 'bg-white/20 text-white' : 'bg-pink-50 text-pink-700 border border-pink-200'}`}>
                {myOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Bar */}
        {activeTab === 'marketplace' && (
          <div className="relative flex-1 max-w-xs min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, tools, guides..."
              className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
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
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
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
                  className="h-96 rounded-2xl bg-white border border-slate-200 animate-pulse p-4 flex flex-col justify-between"
                >
                  <div className="w-full h-48 bg-slate-100 rounded-xl" />
                  <div className="space-y-2">
                    <div className="h-5 bg-slate-100 rounded-lg w-3/4" />
                    <div className="h-3 bg-slate-100 rounded-lg w-full" />
                  </div>
                  <div className="h-10 bg-slate-100 rounded-xl" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 space-y-4 max-w-lg mx-auto my-6 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto text-blue-600">
                <Package className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">No Products Available Yet</h3>
                <p className="text-xs text-slate-500">
                  {searchQuery || selectedCategory !== 'All'
                    ? 'No products match your active search or category filters.'
                    : 'The ZENED U Update catalog is being refreshed. Check back shortly!'}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={handleOpenAddModal}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-xs"
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
                    className="group relative flex flex-col justify-between rounded-2xl bg-white border border-slate-200 hover:border-blue-300 transition-all duration-300 overflow-hidden shadow-xs hover:shadow-md"
                  >
                    {/* Top Image Container with Visual Backdrop */}
                    <div className="relative w-full h-52 sm:h-56 bg-slate-100 overflow-hidden flex items-center justify-center">
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
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
                          <Sparkles className="w-10 h-10 text-blue-500 mb-2" />
                          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                            {product.category || 'ZENED UPDATE'}
                          </span>
                        </div>
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
                          {product.category || 'Update'}
                        </span>
                        {isOutOfStock ? (
                          <span className="px-2 py-1 rounded-lg bg-pink-600 backdrop-blur-md text-white text-[10px] font-black uppercase shadow-xs">
                            Out of Stock
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-lg bg-blue-600 backdrop-blur-md text-white text-[10px] font-black uppercase shadow-xs flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span>In Stock ({product.stock ?? 'Available'})</span>
                          </span>
                        )}
                      </div>

                      {/* Admin Quick Action Buttons */}
                      {isAdmin && (
                        <div className="absolute top-3 right-3 flex items-center space-x-1.5 bg-white/90 backdrop-blur-md p-1 rounded-xl border border-slate-200 shadow-sm">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(product);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 transition cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProduct(product.id, product.name);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-pink-50 text-slate-700 hover:text-pink-600 transition cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Bottom Gradient Overlay */}
                      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/20 to-transparent pointer-events-none" />
                    </div>

                    {/* Card Body */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
                          {product.name}
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                          {product.description}
                        </p>
                      </div>

                      {/* Security & Instant Delivery Guarantee Pill */}
                      <div className="flex items-center space-x-2 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-xl">
                        <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">Secret Delivery Info unlocked upon purchase</span>
                      </div>

                      {/* Price and Buy Button */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                            Price
                          </span>
                          <span className="text-lg sm:text-xl font-black text-slate-900 font-mono tracking-tight">
                            ₦{product.price.toLocaleString()}
                          </span>
                        </div>

                        <button
                          disabled={isOutOfStock}
                          onClick={() => handleInitiateBuy(product)}
                          className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center space-x-1.5 shadow-xs active:scale-95 ${
                            isOutOfStock
                              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
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
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
                <span>My Purchased ZENED U Updates</span>
              </h2>
              <p className="text-xs text-slate-500">
                All software licenses, secret login instructions, and download packages you have acquired are stored here permanently.
              </p>
            </div>
          </div>

          {loadingOrders ? (
            <div className="p-8 text-center text-slate-400 font-medium text-xs">
              Loading your purchased items...
            </div>
          ) : myOrders.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 space-y-3 max-w-md mx-auto my-4 shadow-xs">
              <Package className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-black text-slate-900">No Purchased Updates Yet</h3>
              <p className="text-xs text-slate-500">
                You have not purchased any products from the ZENED U Update catalog yet.
              </p>
              <button
                onClick={() => setActiveTab('marketplace')}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black text-xs transition cursor-pointer hover:bg-blue-700"
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
                    className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-slate-400">
                        {order.productImage ? (
                          <img
                            src={order.productImage}
                            alt={order.productName}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Package className="w-6 h-6 text-blue-600" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <h4 className="font-black text-slate-900 text-base">{order.productName}</h4>
                          <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black uppercase">
                            Delivered
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-xs text-slate-500 font-mono">
                          <span>₦{order.price.toLocaleString()}</span>
                          <span>•</span>
                          <span>{new Date(order.purchasedAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span className="text-[10px] text-slate-400">TX: {order.transactionId?.slice(-8) || order.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </div>

                    {/* View Secret Delivery Info Button */}
                    <button
                      onClick={() => setViewingSecretOrder(order)}
                      className="px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-black text-xs transition cursor-pointer flex items-center justify-center space-x-2 shadow-xs"
                    >
                      <Unlock className="w-3.5 h-3.5 text-blue-600" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {editingProduct ? 'Edit ZENED Update Product' : 'Add New ZENED Update Product'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Provide complete product metadata and private delivery info.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="p-3.5 rounded-xl bg-pink-50 border border-pink-200 text-pink-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-pink-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Product Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. VIP Telegram Auto-Forwarder Bot 2026"
                  className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
                />
              </div>

              {/* Price & Stock Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
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
                    className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Category & Status Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    Category Tag
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none cursor-pointer"
                  >
                    {CATEGORY_TAGS.filter((c) => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    Product Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none cursor-pointer"
                  >
                    <option value="active">Active (Available for purchase)</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>
              </div>

              {/* Short Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Short Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Provide a clear, compelling description of this update, script, or digital service..."
                  className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
                />
              </div>

              {/* Product Image: Upload & URL */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Product Image (Cover Photo)
                </label>

                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <input
                    type="url"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="Paste Image URL (https://...)"
                    className="flex-1 w-full bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
                  />
                  
                  <label className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer border border-slate-200 shrink-0 flex items-center space-x-2 transition">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
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
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Uploading image... {uploadProgress}%
                    </span>
                  </div>
                )}

                {/* Image Preview */}
                {formImageUrl && (
                  <div className="relative w-full h-32 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden">
                    <img
                      src={formImageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => setFormImageUrl('')}
                      className="absolute top-2 right-2 p-1 rounded-full bg-slate-900/80 text-white hover:bg-pink-600 transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* CRITICAL: Secret Delivery Information Field */}
              <div className="space-y-1.5 bg-blue-50/60 border border-blue-200 p-4 rounded-2xl">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center space-x-1.5">
                    <Lock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Secret Delivery Information *</span>
                  </label>
                  <span className="text-[10px] font-bold text-pink-600 uppercase bg-pink-50 px-2 py-0.5 rounded border border-pink-200">
                    🔒 STRICTLY PRIVATE
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  This content is strictly private and will <strong>NEVER</strong> be displayed publicly. It is automatically revealed to the buyer only after their wallet payment is confirmed.
                </p>
                <textarea
                  rows={4}
                  required
                  value={formSecretInfo}
                  onChange={(e) => setFormSecretInfo(e.target.value)}
                  placeholder="Enter login credentials, private download links, API tokens, license keys, or step-by-step access instructions..."
                  className="w-full bg-white border border-blue-200 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none font-mono"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || isUploadingImage}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 space-y-5 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-slate-900">Confirm Product Purchase</h3>
              </div>
              <button
                onClick={() => setConfirmingProduct(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
              <div className="flex items-center space-x-3">
                {confirmingProduct.imageUrl ? (
                  <img
                    src={confirmingProduct.imageUrl}
                    alt={confirmingProduct.name}
                    className="w-12 h-12 rounded-xl object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500">
                    <Package className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h4 className="font-black text-slate-900 text-sm">{confirmingProduct.name}</h4>
                  <span className="text-[10px] text-slate-500 uppercase font-mono">
                    {confirmingProduct.category}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Product Price:</span>
                  <span className="font-black text-slate-900 font-mono">₦{confirmingProduct.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Your Current Balance:</span>
                  <span className="font-black text-blue-600 font-mono">₦{walletBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
                  <span>Balance After Purchase:</span>
                  <span className="font-black text-slate-900 font-mono">
                    ₦{(walletBalance - confirmingProduct.price).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-700 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Instant auto-delivery: Secret access information is unlocked immediately.</span>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmingProduct(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isPurchasing}
                onClick={handleExecutePurchase}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 flex items-center space-x-1.5"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-lg bg-white border border-blue-200 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 text-slate-800 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <span className="px-3 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider border border-blue-200 inline-block">
                Purchase Confirmed & Delivered
              </span>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                Access Unlocked!
              </h3>
              <p className="text-xs text-slate-600">
                Payment of <strong>₦{purchasedOrderSuccess.price.toLocaleString()}</strong> was completed successfully from your wallet.
              </p>
            </div>

            {/* Secret Delivery Info Display */}
            <div className="bg-blue-50/50 border border-blue-200 p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-blue-900 text-xs font-black">
                  <Key className="w-4 h-4 text-blue-600" />
                  <span>SECRET DELIVERY INFORMATION</span>
                </div>
                <button
                  onClick={() => handleCopy(purchasedOrderSuccess.secretDeliveryInfo, 'success-info')}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  {copiedKey === 'success-info' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
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

              <div className="p-3.5 rounded-xl bg-white border border-blue-200 text-xs font-mono text-slate-900 whitespace-pre-wrap break-all leading-relaxed select-all">
                {purchasedOrderSuccess.secretDeliveryInfo}
              </div>

              <p className="text-[10px] text-slate-500 italic">
                * You can also view this secret delivery information at any time under the "My Purchased Updates" tab.
              </p>
            </div>

            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={() => {
                  setPurchasedOrderSuccess(null);
                  setActiveTab('my-orders');
                }}
                className="w-full px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-xs active:scale-95"
              >
                Go to My Purchased Updates
              </button>
              <button
                onClick={() => setPurchasedOrderSuccess(null)}
                className="w-full px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 space-y-5 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                  <Unlock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{viewingSecretOrder.productName}</h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Purchased on {new Date(viewingSecretOrder.purchasedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewingSecretOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Secret Delivery Information
                </span>
                <button
                  onClick={() => handleCopy(viewingSecretOrder.secretDeliveryInfo, 'view-info')}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  {copiedKey === 'view-info' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
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

              <div className="p-4 rounded-xl bg-white border border-blue-200 text-xs font-mono text-slate-900 whitespace-pre-wrap break-all leading-relaxed select-all">
                {viewingSecretOrder.secretDeliveryInfo}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingSecretOrder(null)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-md bg-white border border-pink-200 rounded-3xl shadow-2xl p-6 space-y-4 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-2xl bg-pink-50 border border-pink-200 text-pink-600">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Insufficient Wallet Balance</h3>
                <p className="text-xs text-slate-500">
                  You need more funds in your wallet to complete this purchase.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Product Price:</span>
                <span className="font-black text-slate-900 font-mono">₦{insufficientFundsFor.price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Current Balance:</span>
                <span className="font-black text-pink-600 font-mono">₦{walletBalance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-200">
                <span>Shortage:</span>
                <span className="font-black text-pink-600 font-mono">
                  ₦{(insufficientFundsFor.price - walletBalance).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setInsufficientFundsFor(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setInsufficientFundsFor(null);
                  onOpenWallet();
                }}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-xs active:scale-95"
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
