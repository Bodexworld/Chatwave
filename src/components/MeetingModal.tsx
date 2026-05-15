import React, { Suspense } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

// Lazy load Jitsi to prevent it from blocking/crashing the main bundle on load
const JitsiMeeting = React.lazy(() => 
  import('@jitsi/react-sdk').then(module => ({ default: module.JitsiMeeting }))
);

type Props = {
  roomName: string;
  onClose: () => void;
};

export default function MeetingModal({ roomName, onClose }: Props) {
  const { user } = useAuth();
  
  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col animate-in fade-in zoom-in-95 duration-300">
      <div className="absolute top-4 right-4 z-50">
        <button 
          onClick={onClose}
          className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-full shadow-2xl transition-colors opacity-80 hover:opacity-100 flex items-center gap-2 font-semibold"
        >
          <X className="w-5 h-5" />
          <span className="hidden sm:inline">Close</span>
        </button>
      </div>
      
      <div className="flex-1 w-full h-full relative">
        <Suspense fallback={
          <div className="w-full h-full flex flex-col items-center justify-center text-white">
             <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
             <p className="font-medium text-slate-300">Starting Meeting...</p>
          </div>
        }>
          <JitsiMeeting
            domain="meet.jit.si"
            roomName={roomName}
            configOverwrite={{
              startWithAudioMuted: true,
              startWithVideoMuted: true,
              requireDisplayName: true,
              prejoinPageEnabled: true,
            }}
            interfaceConfigOverwrite={{
              SHOW_CHROME_EXTENSION_BANNER: false,
            }}
            userInfo={{
              displayName: user?.displayName || 'Anonymous User',
              email: user?.email || '',
            }}
            onApiReady={(externalApi) => {
              externalApi.addEventListener('videoConferenceLeft', () => {
                onClose();
              });
            }}
            getIFrameRef={(iframeRef) => {
              iframeRef.style.height = '100%';
              iframeRef.style.width = '100%';
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
