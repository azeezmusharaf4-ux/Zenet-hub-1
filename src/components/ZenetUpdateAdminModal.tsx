import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  Upload, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Eye, 
  EyeOff, 
  DollarSign, 
  Package, 
  Loader2,
  ExternalLink,
  ShieldCheck,
  ClipboardPaste
} from 'lucide-react';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp,
  query,
  orderBy 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User } from 'firebase/auth';
import { db, storage, sanitizeFirestorePayload } from '../lib/firebase';
import { UserProfile, ZenedUpdateProduct } from '../types';
import { processAndCompressImage } from '../lib/imageUtils';

interface ZenetUpdateAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  userProfile: UserProfile | null;
  isOwner: boolean;
  isAdmin: boolean;
}

export const ZenetUpdateAdminModal: React.FC<ZenetUpdateAdminModalProps> = ({
  isOpen,
  onClose,
  user,
  userProfile,
  isOwner,
  isAdmin
}) => {
  const [products, setProducts] = useState<ZenedUpdateProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<ZenedUpdateProduct | null>(null);
  const [activeTab, setActiveTab] = useState<'add' | 'manage'>('add');
  const [showSecretLink, setShowSecretLink] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states
  const [productName, setProductName] = useState('');
  const [productImage, setProductImage] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<string>('');
  const [privateDeliveryLink, setPrivateDeliveryLink] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time listener for products
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
            secretDeliveryInfo: data.secretDeliveryInfo || data.privateDeliveryLink || '',
            privateDeliveryLink: data.privateDeliveryLink || data.secretDeliveryInfo || '',
            createdBy: data.createdBy || '',
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || undefined
          };
        });
        setProducts(items);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching zenedUpdateProducts:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  // Fast image processor: compresses and shows preview instantly, then syncs to cloud storage in background
  const processImageFile = async (file: File | Blob) => {
    if (!file) return;

    if (file.type && !file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', text: 'Please select a valid image file.' });
      return;
    }

    try {
      // 1. Instant client-side compression (< 40ms) and immediate display
      const compressedDataUrl = await processAndCompressImage(file, {
        maxWidth: 720,
        maxHeight: 720,
        quality: 0.82
      });

      // Show preview immediately!
      setProductImage(compressedDataUrl);
      setStatusMessage(null);
      setUploadingImage(true);

      // 2. Background async upload to Firebase Storage with safe timeout
      try {
        const response = await fetch(compressedDataUrl);
        const blob = await response.blob();
        const cleanName = (file instanceof File ? file.name : 'image').replace(/[^a-zA-Z0-9.-]/g, '_');
        const storageRef = ref(storage, `zened_update_covers/${Date.now()}_${cleanName}`);

        // Set a 3.5-second timeout for cloud storage sync
        const uploadPromise = uploadBytes(storageRef, blob).then((snap) => getDownloadURL(snap.ref));
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500));

        const cloudUrl = await Promise.race([uploadPromise, timeoutPromise]);
        if (cloudUrl && typeof cloudUrl === 'string') {
          setProductImage(cloudUrl);
        }
      } catch (storageErr) {
        console.warn('Storage sync skipped, using optimized compressed image:', storageErr);
      } finally {
        setUploadingImage(false);
      }
    } catch (err: any) {
      console.error('Error processing image:', err);
      setStatusMessage({ type: 'error', text: 'Could not process image. Please try another image.' });
      setUploadingImage(false);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    }
  };

  // Clipboard paste handler (Ctrl+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processImageFile(file);
          return;
        }
      }
    }

    // Check if pasted text is an image URL
    const pastedText = e.clipboardData?.getData('text');
    if (pastedText && (pastedText.startsWith('http://') || pastedText.startsWith('https://')) && (pastedText.match(/\.(jpeg|jpg|gif|png|webp)/i) || pastedText.includes('unsplash') || pastedText.includes('firebase') || pastedText.includes('google') || pastedText.includes('cloudinary'))) {
      setProductImage(pastedText.trim());
    }
  };

  // Helper to ensure any base64 image is uploaded to Firebase Storage or kept as compressed lightweight URL
  const resolveStorageUrl = async (imgStr: string): Promise<string> => {
    const trimmed = imgStr.trim();
    if (!trimmed.startsWith('data:image/')) {
      return trimmed;
    }
    try {
      // Attempt fast upload to storage with 2.5s timeout
      const response = await fetch(trimmed);
      const blob = await response.blob();
      const storageRef = ref(storage, `zened_update_covers/${Date.now()}_cover.webp`);
      const uploadPromise = uploadBytes(storageRef, blob).then((snap) => getDownloadURL(snap.ref));
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
      const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
      if (downloadUrl && typeof downloadUrl === 'string') {
        return downloadUrl;
      }
    } catch (err) {
      console.warn('Storage upload fallback to compressed image:', err);
    }
    return trimmed;
  };

  const resetForm = () => {
    setProductName('');
    setProductImage('');
    setDescription('');
    setPrice('');
    setPrivateDeliveryLink('');
    setEditingProduct(null);
    setShowSecretLink(false);
    setStatusMessage(null);
    setUploadingImage(false);
    setIsDragging(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartEdit = (product: ZenedUpdateProduct) => {
    setEditingProduct(product);
    setProductName(product.name);
    setProductImage(product.imageUrl || '');
    setDescription(product.description);
    setPrice(String(product.price));
    setPrivateDeliveryLink(product.privateDeliveryLink || product.secretDeliveryInfo || '');
    setActiveTab('add');
    setStatusMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isOwner && !isAdmin) {
      setStatusMessage({ type: 'error', text: 'Unauthorized. Only Owner/Admin can generate updates.' });
      return;
    }

    if (!productName.trim()) {
      setStatusMessage({ type: 'error', text: 'Product Name is required.' });
      return;
    }

    if (!productImage.trim()) {
      setStatusMessage({ type: 'error', text: 'Please upload or provide a Product Cover Image.' });
      return;
    }

    if (!description.trim()) {
      setStatusMessage({ type: 'error', text: 'Description is required.' });
      return;
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid Price (₦).' });
      return;
    }

    if (!privateDeliveryLink.trim()) {
      setStatusMessage({ type: 'error', text: 'Private Delivery Link is required.' });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      // Resolve image URL (converts any base64 to Firebase Storage URL)
      const finalImageUrl = await resolveStorageUrl(productImage);
      setProductImage(finalImageUrl);

      if (editingProduct) {
        // Update existing product
        const productRef = doc(db, 'zenedUpdateProducts', editingProduct.id);
        const payload = sanitizeFirestorePayload({
          name: productName.trim(),
          imageUrl: finalImageUrl,
          description: description.trim(),
          price: numericPrice,
          privateDeliveryLink: privateDeliveryLink.trim(),
          secretDeliveryInfo: privateDeliveryLink.trim(),
          updatedAt: serverTimestamp()
        });

        await updateDoc(productRef, payload);
        setStatusMessage({ type: 'success', text: `Product "${productName}" updated successfully!` });
        resetForm();
      } else {
        // Create new unique product
        const newDocRef = doc(collection(db, 'zenedUpdateProducts'));
        const payload = sanitizeFirestorePayload({
          id: newDocRef.id,
          name: productName.trim(),
          imageUrl: finalImageUrl,
          description: description.trim(),
          price: numericPrice,
          privateDeliveryLink: privateDeliveryLink.trim(),
          secretDeliveryInfo: privateDeliveryLink.trim(),
          status: 'active',
          createdBy: user?.email || userProfile?.email || 'admin',
          creatorUid: user?.uid || 'admin',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        await setDoc(newDocRef, payload);
        setStatusMessage({ type: 'success', text: `Product "${productName}" added to ZENET HUB Update successfully!` });
        resetForm();
      }
    } catch (err: any) {
      console.error('Error saving Zenet Update product:', err);
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to save product. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!isOwner && !isAdmin) return;

    try {
      await deleteDoc(doc(db, 'zenedUpdateProducts', id));
      setDeleteConfirmId(null);
      setStatusMessage({ type: 'success', text: `Product "${name}" deleted successfully.` });
    } catch (err: any) {
      console.error('Error deleting product:', err);
      setStatusMessage({ type: 'error', text: 'Failed to delete product.' });
    }
  };

  if (!isOpen) return null;

  if (!isOwner) {
    return (
      <div id="zenet-update-admin-modal" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
        <div className="relative w-full max-w-md bg-[#0c051f] border border-rose-500/50 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-white">Owner Authorization Required</h3>
          <p className="text-xs text-purple-300/80 leading-relaxed">
            ZENET Update management controls are strictly restricted to the primary website Owner (Azeezmusharaf4@gmail.com). Normal administrators do not have access.
          </p>
          <button
            onClick={onClose}
            className="w-full px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black transition cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="zenet-update-admin-modal" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl max-h-[92vh] bg-[#0c051f] border border-[#3b1c78] rounded-[28px] shadow-[0_0_60px_rgba(125,76,247,0.35)] flex flex-col overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Glowing Badge */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-b from-[#1d0c42] to-[#0c051f] border-b border-[#2b165c] flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-2xl bg-[#2a1359] border border-[#7d4cf7]/50 text-[#c1a0ff] shadow-lg flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-[#bd93f9]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Add Product to Generate Update
                </h3>
                <span className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                  <ShieldCheck className="w-3 h-3 text-black" />
                  OWNER ONLY
                </span>
              </div>
              <p className="text-xs text-purple-300/60 font-medium mt-0.5">
                Create & manage products that appear inside the live ZENET HUB Update marketplace.
              </p>
            </div>
          </div>

          <button
            onClick={() => { resetForm(); onClose(); }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer border border-white/10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle: Add / Edit vs Manage Existing */}
        <div className="bg-[#14082e] border-b border-[#24114f] px-5 sm:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => { setActiveTab('add'); }}
              className={`px-4 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'add'
                  ? 'bg-[#7d4cf7] text-white shadow-[0_0_12px_rgba(125,76,247,0.4)]'
                  : 'bg-[#1e0e3a] text-purple-300 hover:text-white border border-[#30166a]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{editingProduct ? 'Edit Product' : 'Add New Product'}</span>
            </button>
            <button
              onClick={() => { setActiveTab('manage'); setStatusMessage(null); }}
              className={`px-4 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'manage'
                  ? 'bg-[#7d4cf7] text-white shadow-[0_0_12px_rgba(125,76,247,0.4)]'
                  : 'bg-[#1e0e3a] text-purple-300 hover:text-white border border-[#30166a]'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>All Products ({products.length})</span>
            </button>
          </div>

          {editingProduct && (
            <button
              onClick={resetForm}
              className="text-xs text-purple-300 hover:text-white underline cursor-pointer"
            >
              Cancel Edit
            </button>
          )}
        </div>

        {/* Status Alert Banner */}
        {statusMessage && (
          <div className={`px-6 py-3 border-b text-xs font-bold flex items-center space-x-2 ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {activeTab === 'add' ? (
            <form onSubmit={handleSubmit} onPaste={handlePaste} className="space-y-5">
              {/* Field 1: Product Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-purple-300/80">
                  Product Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Verified Telegram PVA Method + Tool"
                  className="w-full bg-[#12082b] border border-[#261352] focus:border-[#7d4cf7] rounded-xl px-4 py-3 text-sm text-white placeholder-purple-300/30 outline-none transition"
                />
              </div>

              {/* Field 2: Product Image (Upload Image / Cover) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black uppercase tracking-wider text-purple-300/80">
                    Product Image (Cover Photo) <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[11px] text-purple-400/80 font-medium flex items-center gap-1">
                    <ClipboardPaste className="w-3 h-3" /> Supports Drag, Drop & Ctrl+V Paste
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                  {/* File Upload / Dropzone */}
                  <div className="space-y-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                      id="update-product-image-upload"
                    />
                    
                    <label
                      htmlFor="update-product-image-upload"
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`w-full flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-2xl cursor-pointer transition text-center group ${
                        isDragging
                          ? 'border-[#7d4cf7] bg-[#230f4e] scale-[1.01]'
                          : 'border-[#3a1d75] hover:border-[#7d4cf7] bg-[#12082b] hover:bg-[#190b3b]'
                      }`}
                    >
                      <Upload className="w-6 h-6 text-[#bd93f9] group-hover:scale-110 transition duration-200 mb-2" />
                      <span className="text-xs font-bold text-white">Click or Drag & Drop Image Here</span>
                      <span className="text-[10px] text-purple-300/60 mt-0.5">Instant auto-compression (PNG, JPG, WEBP)</span>
                    </label>

                    {/* Or URL Input */}
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-purple-300/40 uppercase font-black">or URL:</span>
                      <input
                        type="url"
                        value={productImage.startsWith('data:') ? '' : productImage}
                        onChange={(e) => setProductImage(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 bg-[#12082b] border border-[#261352] focus:border-[#7d4cf7] rounded-lg px-3 py-1.5 text-xs text-white placeholder-purple-300/30 outline-none"
                      />
                    </div>
                  </div>

                  {/* Image Preview Box (Instant and always visible) */}
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className="relative aspect-video rounded-2xl overflow-hidden bg-[#090317] border border-[#2b165c] flex items-center justify-center group"
                  >
                    {productImage ? (
                      <>
                        <img 
                          src={productImage} 
                          alt="Cover preview" 
                          className="w-full h-full object-cover transition duration-200"
                          referrerPolicy="no-referrer"
                        />
                        {uploadingImage && (
                          <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-purple-500/40 text-[10px] text-purple-300 flex items-center gap-1.5 font-bold shadow-lg">
                            <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
                            <span>Optimizing...</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => { setProductImage(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-rose-900/80 text-white transition cursor-pointer"
                          title="Remove image"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-purple-300/40 space-y-1.5 p-4 text-center">
                        <ImageIcon className="w-8 h-8 text-purple-400/50" />
                        <span className="text-xs font-semibold text-purple-200/70">Instant Image Preview</span>
                        <span className="text-[10px] text-purple-300/40">Upload or paste an image to see preview</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Field 3: Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-purple-300/80">
                  Description <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed breakdown of what is included, features, instructions, or account specifications..."
                  className="w-full bg-[#12082b] border border-[#261352] focus:border-[#7d4cf7] rounded-xl px-4 py-3 text-sm text-white placeholder-purple-300/30 outline-none transition resize-none"
                />
              </div>

              {/* Field 4: Price */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-purple-300/80">
                  Price (₦ NGN) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-purple-300 font-bold">
                    ₦
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full bg-[#12082b] border border-[#261352] focus:border-[#7d4cf7] rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-purple-300/30 outline-none transition font-mono font-bold"
                  />
                </div>
              </div>

              {/* Field 5: Private Delivery Link */}
              <div className="space-y-1.5 p-4 rounded-2xl bg-[#14082e] border border-[#30166a]">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center space-x-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Private Delivery Link <span className="text-rose-400">*</span></span>
                  </label>
                  <span className="text-[10px] text-amber-400/70 font-semibold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                    HIDDEN UNTIL PURCHASE
                  </span>
                </div>

                <p className="text-[11px] text-purple-300/60 leading-relaxed mb-2">
                  Paste the secret link (Google Drive, Mega, Telegram channel, download URL, or credentials access) delivered immediately to the buyer post-purchase.
                </p>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-purple-400">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <input
                    type={showSecretLink ? 'text' : 'password'}
                    required
                    value={privateDeliveryLink}
                    onChange={(e) => setPrivateDeliveryLink(e.target.value)}
                    placeholder="https://example.com/secret-product-access"
                    className="w-full bg-[#0c051f] border border-[#3b1c78] focus:border-amber-400 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-purple-300/30 outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretLink(!showSecretLink)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-purple-400 hover:text-white cursor-pointer"
                  >
                    {showSecretLink ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#7d4cf7] to-[#a16eff] hover:from-[#8e5ff9] hover:to-[#b37eff] text-white font-black text-sm uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(125,76,247,0.4)] hover:shadow-[0_0_30px_rgba(125,76,247,0.6)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{editingProduct ? 'UPDATING PRODUCT...' : 'ADDING PRODUCT...'}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>{editingProduct ? 'UPDATE PRODUCT' : 'ADD PRODUCT'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Manage Existing Products List */
            <div className="space-y-4">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-purple-300/50 space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin text-[#bd93f9]" />
                  <p className="text-xs font-bold">Loading generated update products...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="py-12 text-center bg-[#12082b] border border-[#24114f] rounded-2xl p-6 space-y-3">
                  <Package className="w-10 h-10 text-purple-400/40 mx-auto" />
                  <h4 className="text-sm font-bold text-white">No Update Products Added Yet</h4>
                  <p className="text-xs text-purple-300/50 max-w-sm mx-auto">
                    Use the "Add New Product" tab above to create your first product for ZENED U Update.
                  </p>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="px-4 py-2 bg-[#7d4cf7] hover:bg-[#8e5ff9] text-white rounded-xl text-xs font-black transition cursor-pointer"
                  >
                    Add First Product
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {products.map((item) => (
                    <div 
                      key={item.id}
                      className="bg-[#12082b] border border-[#210f45] hover:border-[#4d24a3] rounded-2xl overflow-hidden flex flex-col transition duration-200 group"
                    >
                      {/* Product Image Cover */}
                      <div className="relative aspect-video w-full bg-black/40 overflow-hidden">
                        {item.imageUrl ? (
                          <img 
                            src={item.imageUrl} 
                            alt={item.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-purple-400/30">
                            <ImageIcon className="w-8 h-8" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-purple-500/30 text-white font-mono font-bold text-xs">
                          ₦{item.price.toLocaleString()}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-white text-sm line-clamp-1">{item.name}</h4>
                          <p className="text-xs text-purple-200/70 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        </div>

                        {/* Secret Link Preview for Admin */}
                        <div className="p-2 rounded-xl bg-[#090317] border border-[#24114f] text-[11px] font-mono flex items-center justify-between space-x-2">
                          <div className="flex items-center space-x-1.5 text-amber-300/80 truncate">
                            <Lock className="w-3 h-3 shrink-0 text-amber-400" />
                            <span className="truncate">{item.privateDeliveryLink || item.secretDeliveryInfo}</span>
                          </div>
                          {item.privateDeliveryLink && (
                            <a
                              href={item.privateDeliveryLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#bd93f9] hover:text-white shrink-0 p-1"
                              title="Test link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-2 pt-1 border-t border-[#210f45]">
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="flex-1 py-1.5 px-3 rounded-xl bg-[#1e0e3a] hover:bg-[#2e155b] text-[#bd93f9] hover:text-white border border-[#30166a] text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          {deleteConfirmId === item.id ? (
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleDeleteProduct(item.id, item.name)}
                                className="py-1.5 px-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="py-1.5 px-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(item.id)}
                              className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition cursor-pointer"
                              title="Delete Product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#12082b] border-t border-[#24114f] flex items-center justify-between text-xs">
          <span className="text-purple-300/40 font-medium">
            Products automatically appear in the live ZENED U Update catalog.
          </span>
          <button
            onClick={() => { resetForm(); onClose(); }}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
