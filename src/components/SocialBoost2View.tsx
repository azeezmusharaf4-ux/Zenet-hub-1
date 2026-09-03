import React from 'react';
import { UserProfile } from '../types';
import { Server2View } from './Server2View';

interface SocialBoost2ViewProps {
  userProfile: UserProfile | null;
  walletBalance: number;
  onRefreshProfile?: () => Promise<void> | void;
  onBackToMarketplace: () => void;
  onOpenWallet: () => void;
  onSwitchToServer1?: () => void;
}

export const SocialBoost2View: React.FC<SocialBoost2ViewProps> = ({
  userProfile,
  walletBalance,
  onRefreshProfile,
  onBackToMarketplace,
  onOpenWallet,
  onSwitchToServer1
}) => {
  return (
    <Server2View
      initialPage="boost-accounts"
      userProfile={userProfile}
      walletBalance={walletBalance}
      onRefreshProfile={async () => {
        if (onRefreshProfile) await onRefreshProfile();
      }}
      onBackToMarketplace={onBackToMarketplace}
      onOpenWallet={onOpenWallet}
      onSwitchToServer1={onSwitchToServer1}
    />
  );
};
