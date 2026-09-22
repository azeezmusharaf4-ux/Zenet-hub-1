import React from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners: Array<() => void> = [];

export function promptPWAInstall(): Promise<boolean> {
  if (globalDeferredPrompt) {
    globalDeferredPrompt.prompt();
    return globalDeferredPrompt.userChoice.then((choiceResult) => {
      const accepted = choiceResult.outcome === 'accepted';
      globalDeferredPrompt = null;
      listeners.forEach((l) => l());
      return accepted;
    });
  }
  return Promise.resolve(false);
}

export function isPWAInstallable(): boolean {
  return !!globalDeferredPrompt;
}

export const PWAInstallBanner: React.FC = () => {
  return null;
};

