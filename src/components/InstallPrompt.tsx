import React, { useState, useEffect } from 'react';
import { X, Share, PlusSquare } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isManualInstructions, setIsManualInstructions] = useState(false);
  const APP_NAME = "Chatwave";

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true) {
      return; // Already installed
    }

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (iOS) {
      setIsIOS(true);
    }
    
    // Show prompt on load unless already installed
    setShowPrompt(true);

    // Listen for beforeinstallprompt event (Android/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // We already set showPrompt to true above, this just saves the event
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setShowPrompt(false);
      setDeferredPrompt(null);
    } else {
        // Fallback if beforeinstallprompt not fired yet: show UI instructions instead of alert
        setIsManualInstructions(true);
    }
  };

  const handleNotNowClick = () => {
    setShowPrompt(false);
    // Removed the localStorage logic so it shows 'whenever page is refreshed' as requested.
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative flex flex-col items-center text-center">
        <button onClick={handleNotNowClick} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-700/50 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
        <img src="/logo192.png" alt="App Icon" className="w-20 h-20 rounded-3xl shadow-md mb-4" />
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Install {APP_NAME}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          {isIOS 
            ? <>To install on iOS, tap the <Share className="inline w-4 h-4 mx-1 text-[#0F62FE]" /> <strong>Share</strong> button below and select <strong className="whitespace-nowrap"><PlusSquare className="inline w-4 h-4 mx-1" /> Add to Home Screen</strong>.</> 
            : isManualInstructions 
              ? <>To install, tap the <strong>Menu</strong> button (usually three dots in the top right) in your browser and select <strong>'Add to Home Screen'</strong> or <strong>'Install App'</strong>.</>
              : "Install our app on your device to get the full-screen mobile experience without typing the URL every time."}
        </p>

        {!isIOS && !isManualInstructions && (
          <div className="flex flex-col gap-3 w-full">
            <button 
              onClick={handleInstallClick}
              className="w-full py-3 px-4 bg-[#0F62FE] hover:bg-blue-700 text-white font-medium rounded-xl text-center transition-colors"
            >
              Install App
            </button>
            <button 
              onClick={handleNotNowClick}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-xl text-center transition-colors"
            >
              Maybe Later
            </button>
          </div>
        )}
        
        {isManualInstructions && (
           <div className="flex flex-col gap-3 w-full">
             <button 
               onClick={handleNotNowClick}
               className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-xl text-center transition-colors"
             >
               Got it
             </button>
           </div>
        )}
      </div>
    </div>
  );
}
