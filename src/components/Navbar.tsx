import React from 'react';
import { User } from 'firebase/auth';
import { UserProfile } from '../types';
import { isAuthorizedOwner } from '../lib/authorizedOwners';
import { DashboardTab } from './UserDashboardModal';
import { ZenetHeader } from './ZenetHeader';

interface NavbarProps {
  user: User | null;
  userProfile: UserProfile | null;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onOpenCreateListing: () => void;
  onOpenDashboard: (tab?: DashboardTab) => void;
  onOpenSellerDashboard?: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  savedCount: number;
  unreadInquiriesCount: number;
  onToggleDrawer: () => void;
  walletBalance?: number;
  onOpenWallet?: () => void;
  onOpenZenetUpdate?: () => void;
  onOpenSocialBoost?: () => void;
  activeView?: string;
  onGoHome?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  userProfile,
  onOpenAuth,
  onOpenCreateListing,
  savedCount,
  unreadInquiriesCount,
  onToggleDrawer,
  onOpenZenetUpdate,
  onOpenSocialBoost,
  activeView,
  onGoHome
}) => {
  const isOwner = isAuthorizedOwner(user, userProfile);
  const isAdmin = isOwner || userProfile?.role === 'admin';

  return (
    <>
      <ZenetHeader
        onGoHome={onGoHome}
        isAdmin={isAdmin}
        onOpenCreateListing={onOpenCreateListing}
        user={user}
        onOpenAuth={onOpenAuth}
      />
      {/* Exact spacing spacer so page content starts cleanly and scrolls normally under the fixed header */}
      <div className="w-full shrink-0 safe-top-header pointer-events-none" aria-hidden="true">
        <div className="h-14 sm:h-16" />
      </div>
    </>
  );
};

