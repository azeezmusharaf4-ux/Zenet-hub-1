import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share, PlusSquare, Check } from 'lucide-react';

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
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(globalDeferredPrompt);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? !!sessionStorage.getItem('zenet_pwa_dismissed') : false;
  });
  const [installedSuccess, setInstalledSuccess] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if already running in standalone mode (installed app)
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();

    // 2. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);
    setIsIOS(isAppleDevice && isSafari);

    // 3. Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('PWA Service Worker registered with scope:', registration.scope);
          })
          .catch((err) => {
            console.warn('PWA Service Worker registration skipped/failed:', err);
          });
      });
    }

    // 4. Capture beforeinstallprompt event (Android Chrome, Edge, Desktop Chrome)
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      globalDeferredPrompt = e;
      setDeferredPrompt(e);
      listeners.forEach((l) => l());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
      setIsStandalone(true);
      setInstalledSuccess(true);
      setTimeout(() => setInstalledSuccess(false), 5000);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    const updateListener = () => {
      setDeferredPrompt(globalDeferredPrompt);
    };
    listeners.push(updateListener);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      const idx = listeners.indexOf(updateListener);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstalledSuccess(true);
      }
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('zenet_pwa_dismissed', 'true');
  };

  // Don't show banner if already installed or dismissed or not installable on current browser
  if (isStandalone || isDismissed) {
    return null;
  }

  // Only show floating banner if installable prompt is ready or it's iOS
  if (!deferredPrompt && !isIOS) {
    return null;
  }

  return (
    <>
      {/* Floating Bottom App Install Bar */}
      <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-40 animate-in slide-in-from-bottom duration-300">
        <div className="bg-gradient-to-r from-[#170933] via-[#240e4f] to-[#170933] border border-purple-500/50 rounded-2xl p-3.5 shadow-2xl shadow-purple-950/80 backdrop-blur-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 p-0.5 shrink-0 shadow-md">
              <div className="w-full h-full bg-[#0d0718] rounded-[10px] flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-purple-300 animate-pulse" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white tracking-tight truncate">
                  Install ZENET Hub App
                </span>
                <span className="bg-purple-500/30 text-purple-300 text-[9px] font-black px-1.5 py-0.2 rounded border border-purple-400/30 shrink-0">
                  FAST
                </span>
              </div>
              <p className="text-[10px] text-purple-300/70 truncate font-semibold">
                Install on your home screen for quick access & instant SMS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white text-xs font-black px-3.5 py-2 rounded-xl shadow-md shadow-purple-600/40 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-purple-400 hover:text-white rounded-lg hover:bg-purple-900/40 transition cursor-pointer"
              title="Dismiss"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari Instructions Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#05020d]/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#120826] border border-purple-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center mx-auto text-purple-300">
              <Smartphone className="w-6 h-6" />
            </div>
            
            <div>
              <h3 className="text-base font-black text-white">Install on iPhone / iPad</h3>
              <p className="text-xs text-purple-300/70 mt-1">
                Follow these simple steps in Safari to add ZENET Hub to your home screen:
              </p>
            </div>

            <div className="space-y-2.5 text-left text-xs bg-[#1a0c38] p-3.5 rounded-2xl border border-purple-900/50">
              <div className="flex items-center gap-2.5 text-purple-200">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                <span>Tap the <Share className="w-3.5 h-3.5 inline text-purple-300 mx-1" /> <strong>Share</strong> button in Safari toolbar.</span>
              </div>
              <div className="flex items-center gap-2.5 text-purple-200">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                <span>Scroll down and tap <PlusSquare className="w-3.5 h-3.5 inline text-purple-300 mx-1" /> <strong>Add to Home Screen</strong>.</span>
              </div>
              <div className="flex items-center gap-2.5 text-purple-200">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                <span>Tap <strong>Add</strong> in the top right corner.</span>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
};
