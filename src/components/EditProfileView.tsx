import React, { useState, useRef, useEffect } from 'react';
import { User, updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  ArrowLeft, 
  Camera, 
  User as UserIcon, 
  CheckCircle2, 
  AlertCircle,
  Loader2 
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';

interface EditProfileViewProps {
  user: User | null;
  userProfile: UserProfile | null;
  onBack: () => void;
  onProfileUpdated?: (updated: Partial<UserProfile>) => void;
  onOpenAuth?: (mode: 'login' | 'signup') => void;
}

export const EditProfileView: React.FC<EditProfileViewProps> = ({
  user,
  userProfile,
  onBack,
  onProfileUpdated,
  onOpenAuth
}) => {
  // Initialize form states matching the user's current profile or auth data
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync initial state when user/userProfile becomes available
  useEffect(() => {
    if (user || userProfile) {
      const initialName = 
        userProfile?.displayName || 
        userProfile?.fullName || 
        userProfile?.username || 
        user?.displayName || 
        '';
      const initialEmail = userProfile?.email || user?.email || '';
      const initialPhone = 
        userProfile?.phoneNumber || 
        userProfile?.whatsapp || 
        user?.phoneNumber || 
        '';
      const initialPhoto = userProfile?.photoURL || user?.photoURL || '';

      setName(initialName);
      setEmail(initialEmail);
      setPhone(initialPhone);
      setPhotoURL(initialPhoto);
    }
  }, [user, userProfile]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Image Upload Handler (downscale via canvas to ensure fast load & persistence)
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image is too large. Please select an image under 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 320;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setPhotoURL(compressedDataUrl);
          showToast('Profile photo ready to save!', 'success');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle Form Submit
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      showToast('Please sign in to update your profile.', 'error');
      if (onOpenAuth) onOpenAuth('login');
      return;
    }

    if (!name.trim()) {
      showToast('Please enter your name.', 'error');
      return;
    }

    setIsSaving(true);

    try {
      const trimmedName = name.trim();
      const trimmedPhone = phone.trim();
      const trimmedEmail = email.trim();

      // 1. Update Firebase Auth Profile (DisplayName and Photo)
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: trimmedName,
          photoURL: photoURL || null
        }).catch((authErr) => {
          console.warn('Auth profile update notice:', authErr);
        });
      }

      // 2. Prepare Firestore User Payload
      const updatedPayload: Record<string, any> = {
        displayName: trimmedName,
        fullName: trimmedName,
        phoneNumber: trimmedPhone,
        phone: trimmedPhone,
        whatsapp: trimmedPhone,
        photoURL: photoURL || '',
        updatedAt: new Date().toISOString()
      };

      if (trimmedEmail && trimmedEmail !== userProfile?.email) {
        updatedPayload.email = trimmedEmail;
      }

      // 3. Update Firestore Document
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, updatedPayload);

      // 4. Notify Parent Component State
      if (onProfileUpdated) {
        onProfileUpdated(updatedPayload as Partial<UserProfile>);
      }

      showToast('Profile updated successfully!', 'success');

      // Seamless return to Profile view after short delay
      setTimeout(() => {
        onBack();
      }, 900);
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      showToast(err?.message || 'Failed to update profile. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto min-h-[calc(100vh-80px)] px-4 sm:px-6 pt-2 pb-24 flex flex-col justify-between animate-in fade-in duration-200">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold transition-all max-w-[90vw] ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-700' 
            : 'bg-rose-950/90 text-rose-200 border-rose-700'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Form Container */}
      <form onSubmit={handleUpdateProfile} className="flex-1 flex flex-col justify-between">
        
        <div className="space-y-6">
          
          {/* Top Bar: Back Button & Centered Title */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              id="edit-profile-back-btn"
              onClick={onBack}
              className="w-11 h-11 rounded-2xl border border-[#E2E8F0] bg-white flex items-center justify-center text-[#0F172A] shadow-xs hover:bg-slate-50 transition cursor-pointer active:scale-95 shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-[#0F172A] stroke-[2.5]" />
            </button>

            <h1 className="text-lg font-bold text-[#0F172A] tracking-tight text-center flex-1 pr-1">
              Edit Profile
            </h1>

            {/* Spacer for symmetrical optical centering */}
            <div className="w-11 h-11 shrink-0" aria-hidden="true" />
          </div>

          {/* Centered Avatar Area with Concentric Ring & Camera Badge */}
          <div className="flex flex-col items-center justify-center pt-3 pb-2">
            <div className="relative">
              
              {/* Outer soft concentric halo ring matching reference image */}
              <div className="w-28 h-28 rounded-full border border-[#CBD5E1]/70 bg-[#F1F5F9]/60 flex items-center justify-center p-1.5 shadow-2xs">
                
                {/* Inner Avatar Circle */}
                <div className="w-full h-full rounded-full bg-[#E0EDFF] overflow-hidden flex items-center justify-center">
                  {photoURL ? (
                    <img
                      src={photoURL}
                      alt={name || 'Profile'}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#E0EDFF]">
                      <UserIcon className="w-14 h-14 text-[#3B82F6] stroke-[2.2]" />
                    </div>
                  )}
                </div>

              </div>

              {/* Floating Purple Camera Badge Button */}
              <button
                type="button"
                id="edit-profile-camera-btn"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-1 right-0 w-8 h-8 rounded-full bg-[#5B4DF5] hover:bg-[#4E3EE8] text-white flex items-center justify-center shadow-md transition cursor-pointer active:scale-90 border-2 border-white"
                title="Change profile picture"
                aria-label="Change profile picture"
              >
                <Camera className="w-4 h-4 text-white stroke-[2.2]" />
              </button>

              {/* Hidden file input for photo upload */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Form Fields matching the screenshot typography & sleek border */}
          <div className="space-y-4 sm:space-y-5 pt-1">
            
            {/* Name Field */}
            <div>
              <label 
                htmlFor="edit-profile-name-input" 
                className="block text-sm font-semibold text-[#1E293B] mb-2"
              >
                Name
              </label>
              <input
                id="edit-profile-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="w-full bg-white text-[#0F172A] text-sm sm:text-base font-normal px-4 py-3.5 sm:py-4 rounded-2xl border border-[#818CF8]/80 focus:border-[#5B4DF5] focus:ring-2 focus:ring-[#5B4DF5]/20 outline-none transition shadow-2xs placeholder:text-slate-400"
              />
            </div>

            {/* Email Field */}
            <div>
              <label 
                htmlFor="edit-profile-email-input" 
                className="block text-sm font-semibold text-[#1E293B] mb-2"
              >
                Email
              </label>
              <input
                id="edit-profile-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full bg-white text-[#0F172A] text-sm sm:text-base font-normal px-4 py-3.5 sm:py-4 rounded-2xl border border-[#818CF8]/80 focus:border-[#5B4DF5] focus:ring-2 focus:ring-[#5B4DF5]/20 outline-none transition shadow-2xs placeholder:text-slate-400"
              />
            </div>

            {/* Phone Field */}
            <div>
              <label 
                htmlFor="edit-profile-phone-input" 
                className="block text-sm font-semibold text-[#1E293B] mb-2"
              >
                Phone
              </label>
              <input
                id="edit-profile-phone-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full bg-white text-[#0F172A] text-sm sm:text-base font-normal px-4 py-3.5 sm:py-4 rounded-2xl border border-[#818CF8]/80 focus:border-[#5B4DF5] focus:ring-2 focus:ring-[#5B4DF5]/20 outline-none transition shadow-2xs placeholder:text-slate-400"
              />
            </div>

          </div>

        </div>

        {/* Bottom Full-Width "Update Profile" Button */}
        <div className="pt-8 sm:pt-14 pb-4">
          <button
            id="edit-profile-submit-btn"
            type="submit"
            disabled={isSaving}
            className="w-full bg-[#5B4DF5] hover:bg-[#4E3EE8] active:scale-[0.98] text-white font-bold py-4 rounded-2xl text-base shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Updating Profile...
              </span>
            ) : (
              <span>Update Profile</span>
            )}
          </button>
        </div>

      </form>

    </div>
  );
};
