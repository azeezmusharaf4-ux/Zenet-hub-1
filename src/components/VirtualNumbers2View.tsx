import React from 'react';
import { UserProfile } from '../types';
import { ServiceUnavailableView } from './ServiceUnavailableView';

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
  onBackToMarketplace
}) => {
  return (
    <ServiceUnavailableView
      serviceType="service-number"
      onBackToMarketplace={onBackToMarketplace}
    />
  );
};
