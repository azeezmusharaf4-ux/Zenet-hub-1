import React from 'react';
import { UserProfile } from '../types';
import { Server2View } from './Server2View';

interface VirtualNumbers2ViewProps {
  userProfile?: UserProfile | null;
  walletBalance: number;
  onRefreshProfile?: () => Promise<void> | void;
  onBackToMarketplace: () => void;
  onOpenWallet: () => void;
  onOpenAuth?: (mode: 'login' | 'signup') => void;
  onSwitchToServer1?: () => void;
}

export const VirtualNumbers2View: React.FC<VirtualNumbers2ViewProps> = ({
  userProfile = null,
  walletBalance,
  onRefreshProfile,
  onBackToMarketplace,
  onOpenWallet
}) => {
  return (
    <Server2View
      initialPage="buy-numbers"
      userProfile={userProfile || null}
      walletBalance={walletBalance}
      onRefreshProfile={async () => {
        if (onRefreshProfile) await onRefreshProfile();
      }}
      onBackToMarketplace={onBackToMarketplace}
      onOpenWallet={onOpenWallet}
    />
  );
};
