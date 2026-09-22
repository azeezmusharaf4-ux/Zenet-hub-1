import React from 'react';
import { UserProfile } from '../types';
import { ServiceUnavailableView } from './ServiceUnavailableView';

interface SocialBoost2ViewProps {
  userProfile: UserProfile | null;
  walletBalance: number;
  onRefreshProfile?: () => Promise<void> | void;
  onBackToMarketplace: () => void;
  onOpenWallet: () => void;
  onSwitchToServer1?: () => void;
}

export const SocialBoost2View: React.FC<SocialBoost2ViewProps> = ({
  onBackToMarketplace
}) => {
  return (
    <ServiceUnavailableView
      serviceType="social-boost"
      onBackToMarketplace={onBackToMarketplace}
    />
  );
};
