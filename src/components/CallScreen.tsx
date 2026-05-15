import { useState, useEffect, useRef } from 'react';
import { Phone, PhoneCall, PhoneOff, Video, Mic, MicOff, VideoOff, UserPlus, Lock, User as UserIcon, X, Settings, Volume2 } from 'lucide-react';
import { User as UserType } from '../data/mock';
import { CallSession } from '../lib/useCalls';
import { doc, updateDoc, onSnapshot, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useContacts } from '../lib/useContacts';

type Props = {
  callSession: CallSession;
  contact: UserType | { id: string, name: string, avatar?: string };
  isIncoming: boolean;
  onAccept: () => void;
  onReject: () => void;
  onEndCall: () => void;
};

export default function CallScreen({ callSession, contact, isIncoming, onAccept, onReject, onEndCall }: Props) {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callSession.type === 'voice');
  const [showAddParticipants, setShowAddParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [callSettings, setCallSettings] = useState({
    echoCancellation: true,
    autoGainControl: true,
    noiseSuppression: true,
    frameRate: 30,
    videoBitrate: 0,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { contacts } = useContacts();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const setRemoteRef = (element: HTMLVideoElement | HTMLAudioElement | null) => {
    if (element) {
      remoteVideoRef.current = element as HTMLVideoElement;
      if (remoteStream && element.srcObject !== remoteStream) {
        element.srcObject = remoteStream;
        element.play().catch(console.error);
      }
    }
  };

  const setLocalRef = (element: HTMLVideoElement | null) => {
    if (element) {
      localVideoRef.current = element;
      if (stream && element.srcObject !== stream) {
        element.srcObject = stream;
      }
    }
  };

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [remoteStreamReady, setRemoteStreamReady] = useState(false);
  const [isWebRTCReady, setIsWebRTCReady] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const [isSpeaker, setIsSpeaker] = useState(false);

  const toggleSpeaker = async () => {
    if (!remoteVideoRef.current) return;
    try {
      const elem = remoteVideoRef.current as any;
      if (typeof elem.setSinkId === 'function') {
        if (!isSpeaker) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const speakers = devices.filter(d => d.kind === 'audiooutput' && d.label.toLowerCase().includes('speaker'));
          if (speakers.length > 0) {
            await elem.setSinkId(speakers[0].deviceId);
            setIsSpeaker(true);
            return;
          }
        }
        await elem.setSinkId(''); // Default back to whatever
        setIsSpeaker(false);
      } else {
        // Fallback for visual toggle, although unsupported it helps user feel they did something
        setIsSpeaker(!isSpeaker);
      }
    } catch(err) {
      console.warn("Could not set speaker", err);
      setIsSpeaker(!isSpeaker);
    }
  };
  
  const isVideoCall = callSession.type === 'video' && !isVideoOff;
  const isPending = callSession.status === 'calling' || callSession.status === 'ringing';
  
  // To avoid duplicate answer creation
  const hasHandledIncomingRef = useRef(false);

  // Ringing effect
  useEffect(() => {
    if (!isPending) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const audioCtx = new AudioContextClass();
    let isPlaying = true;
    let currentOsc: OscillatorNode | null = null;
    let timeoutId: any;

    const playTone = () => {
      if (!isPlaying || audioCtx.state === 'closed') return;
      
      const playBeep = (freq: number, duration: number) => {
        try {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          osc.type = isIncoming ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
          if (isIncoming) {
            osc.frequency.setValueAtTime(freq * 1.25, audioCtx.currentTime + 0.1); 
          }
          
          gain.gain.setValueAtTime(0, audioCtx.currentTime);
          gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.05);
          gain.gain.setValueAtTime(0.15, audioCtx.currentTime + duration - 0.05);
          gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
          
          osc.start(audioCtx.currentTime);
          osc.stop(audioCtx.currentTime + duration);
          currentOsc = osc;
        } catch (e) {}
      };

      if (isIncoming) {
        if (audioCtx.state === 'suspended') {
           audioCtx.resume().catch(() => {});
        }
        playBeep(480, 0.4);
        timeoutId = setTimeout(() => {
          if (!isPlaying) return;
          playBeep(480, 0.4);
          timeoutId = setTimeout(playTone, 2000);
        }, 600);
      } else {
        playBeep(440, 1.5);
        playBeep(480, 1.5);
        timeoutId = setTimeout(playTone, 4000);
      }
    };

    playTone();

    return () => {
      isPlaying = false;
      clearTimeout(timeoutId);
      if (currentOsc) {
        try { currentOsc.stop(); } catch(e) {}
      }
      if (audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };
  }, [isPending, isIncoming]);

  const hasSetupMediaRef = useRef(false);
  const cleanupWebRTCRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // If call ended/rejected, cleanup anything that was set up
    if (callSession.status === 'ended' || callSession.status === 'rejected') {
      if (cleanupWebRTCRef.current) cleanupWebRTCRef.current();
      return;
    }

    if (hasSetupMediaRef.current) return;

    // We only initiate WebRTC setup if it's an outgoing call OR if receiver has accepted
    if (!isIncoming || callSession.status === 'connected') {
      hasSetupMediaRef.current = true;
      let currentStream: MediaStream | null = null;
      let pc: RTCPeerConnection | null = null;
      let isCancelled = false;
      const seenCandidates = new Set<string>();

      const setupMediaAndWebRTC = async () => {
        try {
          const constraints = {
            audio: true,
            video: callSession.type === 'video'
          };
          const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          
          if (isCancelled) {
              mediaStream.getTracks().forEach(track => track.stop());
              return;
          }

          currentStream = mediaStream;
          setStream(mediaStream);

          const servers = {
            iceServers: [
              { urls: [
                'stun:stun1.l.google.com:19302', 
                'stun:stun2.l.google.com:19302',
                'stun:stun3.l.google.com:19302',
                'stun:stun4.l.google.com:19302',
                'stun:stun.services.mozilla.com'
              ] }
            ]
          };
          
          pc = new RTCPeerConnection(servers);
          pcRef.current = pc;

          mediaStream.getTracks().forEach((track) => {
            pc!.addTrack(track, mediaStream);
          });

          pc.ontrack = (event) => {
            const trackStream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
            setRemoteStream((prevStream) => {
              // If we already have a stream and it's missing this track, add it
              if (prevStream && prevStream.id !== trackStream.id) {
                  const hasTrack = prevStream.getTracks().find(t => t.id === event.track.id);
                  if (!hasTrack) {
                      return new MediaStream([...prevStream.getTracks(), event.track]);
                  }
                  return prevStream;
              }
              return trackStream;
            });
            setRemoteStreamReady(true);
          };

          const callDoc = doc(db, 'calls', callSession.id);

          if (!isIncoming) {
            // Caller logic
            let callerCandidateBatch: string[] = [];
            let callerCandidateTimeout: ReturnType<typeof setTimeout>;

            pc.onicecandidate = (event) => {
              if (event.candidate) {
                callerCandidateBatch.push(JSON.stringify(event.candidate.toJSON()));
                clearTimeout(callerCandidateTimeout);
                callerCandidateTimeout = setTimeout(() => {
                  updateDoc(callDoc, {
                    callerCandidates: arrayUnion(...callerCandidateBatch)
                  }).catch(console.error);
                  callerCandidateBatch = [];
                }, 500);
              }
            };

            const offerDescription = await pc.createOffer();
            await pc.setLocalDescription(offerDescription);

            await updateDoc(callDoc, {
              offer: { type: offerDescription.type, sdp: offerDescription.sdp }
            });

            onSnapshot(callDoc, async (snapshot) => {
              const data = snapshot.data();
              
              if (data?.answer && !pc!.currentRemoteDescription) {
                try {
                  const answerDescription = new RTCSessionDescription(data.answer);
                  await pc!.setRemoteDescription(answerDescription);
                } catch (err) {
                  console.error("Error setting remote description from answer:", err);
                }
              }

              if (data?.receiverCandidates && pc!.currentRemoteDescription) {
                data.receiverCandidates.forEach((candStr: string) => {
                  if (!seenCandidates.has(candStr)) {
                    seenCandidates.add(candStr);
                    const cand = JSON.parse(candStr);
                    const rtcCand = new RTCIceCandidate(cand);
                    pc!.addIceCandidate(rtcCand).catch(console.error);
                  }
                });
              }
            });
          }
          
          setIsWebRTCReady(true);
        } catch (err: any) {
          console.error("Error setting up WebRTC:", err);
          if (err.name === 'NotAllowedError' || err.message.includes('Permission denied')) {
            setPermissionError("Camera/Microphone permission denied. Please allow access in your browser settings (click the lock icon in the address bar). If you are in a preview iframe, you may need to open the app in a new tab.");
          } else {
            setPermissionError(`Failed to access media devices: ${err.message}`);
          }
        }
      };

      setupMediaAndWebRTC();

      cleanupWebRTCRef.current = () => {
        isCancelled = true;
        if (currentStream) {
          currentStream.getTracks().forEach(track => track.stop());
        }
        if (pc) {
          pc.close();
        }
      };
    }
  }, [callSession.id, isIncoming, callSession.status, callSession.type]);

  // Clean up entirely on unmount
  useEffect(() => {
    return () => {
      if (cleanupWebRTCRef.current) {
        cleanupWebRTCRef.current();
      }
    };
  }, []);

  // Answerer (Receiver) logic, triggers when isWebRTCReady is true
  useEffect(() => {
    let unsubscribeCall: any;
    const seenCandidates = new Set<string>();
    
    const handleReceivedConnection = async () => {
      if (isIncoming && callSession.status === 'connected' && isWebRTCReady && pcRef.current && !hasHandledIncomingRef.current) {
        hasHandledIncomingRef.current = true;
        const pc = pcRef.current;
        const callDoc = doc(db, 'calls', callSession.id);

        let receiverCandidateBatch: string[] = [];
        let receiverCandidateTimeout: ReturnType<typeof setTimeout>;

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            receiverCandidateBatch.push(JSON.stringify(event.candidate.toJSON()));
            clearTimeout(receiverCandidateTimeout);
            receiverCandidateTimeout = setTimeout(() => {
              updateDoc(callDoc, {
                receiverCandidates: arrayUnion(...receiverCandidateBatch)
              }).catch(console.error);
              receiverCandidateBatch = [];
            }, 500);
          }
        };

        unsubscribeCall = onSnapshot(callDoc, async (snapshot) => {
          const data = snapshot.data();
          if (!data) return;

          if (data.offer && !pc.currentRemoteDescription) {
            try {
              const offerDescription = new RTCSessionDescription(data.offer);
              await pc.setRemoteDescription(offerDescription);

              const answerDescription = await pc.createAnswer();
              await pc.setLocalDescription(answerDescription);

              await updateDoc(callDoc, {
                answer: { type: answerDescription.type, sdp: answerDescription.sdp }
              });
            } catch (err) {
              console.error("Error setting up answer from offer:", err);
            }
          }

          if (data.callerCandidates && pc.currentRemoteDescription) {
             data.callerCandidates.forEach((candStr: string) => {
                 if (!seenCandidates.has(candStr)) {
                   seenCandidates.add(candStr);
                   const cand = JSON.parse(candStr);
                   const rtcCand = new RTCIceCandidate(cand);
                   pc.addIceCandidate(rtcCand).catch(console.error);
                 }
             });
          }
        });
      }
    };

    handleReceivedConnection();
    
    return () => {
       if (unsubscribeCall) unsubscribeCall();
    };
  }, [isIncoming, callSession.status, callSession.id, isWebRTCReady]);

  useEffect(() => {
    let interval: any;
    if (callSession.status === 'connected') {
      interval = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callSession.status]);

  useEffect(() => {
    if (stream) {
      stream.getAudioTracks().forEach(track => track.enabled = !isMuted);
    }
  }, [isMuted, stream]);

  useEffect(() => {
    if (stream && callSession.type === 'video') {
      stream.getVideoTracks().forEach(track => track.enabled = !isVideoOff);
    }
  }, [isVideoOff, stream, callSession.type]);

  useEffect(() => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        try {
          track.applyConstraints({
            echoCancellation: callSettings.echoCancellation,
            autoGainControl: callSettings.autoGainControl,
            noiseSuppression: callSettings.noiseSuppression
          });
        } catch(e) {}
      });
    }
  }, [stream, callSettings.echoCancellation, callSettings.autoGainControl, callSettings.noiseSuppression]);

  useEffect(() => {
    if (stream && callSession.type === 'video') {
      stream.getVideoTracks().forEach(track => {
        try {
          track.applyConstraints({
            frameRate: callSettings.frameRate
          });
        } catch(e) {}
      });
    }
  }, [stream, callSettings.frameRate, callSession.type]);

  useEffect(() => {
    if (pcRef.current && isWebRTCReady) {
      const senders = pcRef.current.getSenders();
      const videoSender = senders.find(s => s.track?.kind === 'video');
      if (videoSender) {
        const params = videoSender.getParameters();
        if (!params.encodings) params.encodings = [{}];
        if (callSettings.videoBitrate > 0) {
          params.encodings[0].maxBitrate = callSettings.videoBitrate * 1000;
        } else {
          delete params.encodings[0].maxBitrate;
        }
        videoSender.setParameters(params).catch(e => console.warn('Bitrate setting not supported:', e));
      }
    }
  }, [callSettings.videoBitrate, isWebRTCReady]);

  // Bind streams to video elements when they become available
  useEffect(() => {
    if (stream && localVideoRef.current && localVideoRef.current.srcObject !== stream) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(console.error);
    }
  }, [remoteStream]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${isVideoCall ? 'bg-slate-900' : 'bg-[#111B21]'} text-white animate-in fade-in duration-300`}>
      {/* Permission Error Modal */}
      {permissionError && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden text-center p-6 space-y-4">
             <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-4">
               {callSession.type === 'video' ? <VideoOff className="w-8 h-8" /> : <MicOff className="w-8 h-8" />}
             </div>
             <h3 className="text-xl font-bold text-slate-800 dark:text-white">Permission Denied</h3>
             <p className="text-slate-600 dark:text-slate-400 text-sm">
               {permissionError}
             </p>
             <div className="flex flex-col gap-3 mt-4">
               <button 
                 onClick={() => window.open(window.location.href, '_blank')}
                 className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-colors"
               >
                 Open App in New Tab
               </button>
               <button 
                 onClick={onEndCall}
                 className="w-full py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl font-medium transition-colors"
               >
                 End Call
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Remove hidden audio element entirely, we will handle audio via the main video element */}

      {/* Remote Video / Audio Area */}
      {callSession.status === 'connected' && (
         <div className={`absolute inset-0 bg-black flex items-center justify-center ${callSession.type === 'voice' ? 'opacity-0 pointer-events-none' : ''}`}>
            <video ref={setRemoteRef} autoPlay playsInline className={`w-full h-full object-cover ${remoteStreamReady && callSession.type === 'video' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`} />
            {callSession.type === 'video' && !remoteStreamReady && (
                <div className="absolute inset-0">
                  {contact.avatar ? <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover blur-sm opacity-50" /> : <div className="w-full h-full bg-slate-800" />}
                </div>
            )}
         </div>
      )}

      {/* Header */}
      <div className="relative z-10 flex justify-between items-center p-6">
        <div className="mt-2 text-center w-full flex flex-col items-center drop-shadow-md">
          <div className="flex items-center space-x-2 text-slate-300 mb-1">
            <Lock className="w-3 h-3" />
            <span className="text-[10px] sm:text-xs uppercase tracking-wider">End-to-end encrypted</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-light">{contact.name}</h2>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">
            {callSession.status === 'calling' && (isIncoming ? 'Incoming call...' : 'Calling...')}
            {callSession.status === 'ringing' && (isIncoming ? 'Incoming call...' : 'Ringing...')}
            {callSession.status === 'connected' && formatDuration(duration)}
          </p>
        </div>
      </div>

      {/* Main Area (Audio Call Avatar) */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 pointer-events-none">
         {(!isVideoCall || callSession.status !== 'connected') && (
            <div className={`w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden mb-8 shadow-2xl ${isPending ? 'animate-pulse' : ''} bg-slate-800 flex items-center justify-center text-slate-500 uppercase font-bold text-6xl pointer-events-auto`}>
               {contact.avatar ? (
                 <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
               ) : (
                 <span>{contact.name ? contact.name.charAt(0) : '?'}</span>
               )}
            </div>
         )}
      </div>

      {/* Controls */}
      <div className="relative z-10 p-6 sm:p-8 flex justify-center items-center space-x-4 sm:space-x-8 md:space-x-12 bg-gradient-to-t from-black/80 to-transparent">
        {isIncoming && isPending ? (
          <>
            <button 
              onClick={onReject}
              className="p-4 sm:p-5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.5)]"
            >
               <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
            <button 
              onClick={onAccept}
              className="p-4 sm:p-5 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors shadow-[0_0_15px_rgba(34,197,94,0.5)] animate-bounce"
            >
               <PhoneCall className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
          </>
        ) : (
          <>
            <button 
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`p-3 sm:p-4 rounded-full transition-colors ${isVideoOff ? 'bg-white text-black' : 'bg-slate-800/80 text-white hover:bg-slate-700'}`}
            >
               {isVideoOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
            
            <button 
              onClick={() => setShowAddParticipants(true)}
              className="p-3 sm:p-4 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 transition-colors"
            >
               <UserPlus className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {callSession.type === 'voice' && (
              <button 
                onClick={toggleSpeaker}
                className={`p-3 sm:p-4 rounded-full transition-colors ${isSpeaker ? 'bg-white text-black' : 'bg-slate-800/80 text-white hover:bg-slate-700'}`}
              >
                 <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}

            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 sm:p-4 rounded-full transition-colors ${isMuted ? 'bg-white text-black' : 'bg-slate-800/80 text-white hover:bg-slate-700'}`}
            >
               {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
            
            <button 
              onClick={() => setShowSettings(true)}
              className="p-3 sm:p-4 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 transition-colors hidden sm:block"
            >
               <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            
            <button 
              onClick={onEndCall}
              className="p-4 sm:p-5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.5)]"
            >
               <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
          </>
        )}
      </div>

      {/* Picture in Picture simulating local camera */}
      {callSession.type === 'video' && callSession.status === 'connected' && (
        <div className="absolute bottom-28 right-4 sm:bottom-32 sm:right-6 w-20 h-28 sm:w-24 sm:h-36 md:w-32 md:h-48 bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-700 shadow-xl z-20">
            <div className="w-full h-full bg-slate-700 flex items-center justify-center relative">
               {stream ? (
                 <>
                   <video ref={setLocalRef} autoPlay playsInline muted className={`w-full h-full object-cover transition-opacity duration-300 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`} />
                   {isVideoOff && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                         <UserIcon className="w-8 h-8 sm:w-12 sm:h-12 text-slate-500" />
                      </div>
                   )}
                 </>
               ) : (
                 <UserIcon className="w-8 h-8 sm:w-12 sm:h-12 text-slate-500" />
               )}
            </div>
        </div>
      )}

      {/* Add Participants Modal */}
      {showAddParticipants && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddParticipants(false)} />
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden relative z-10">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-white">Add People</h3>
              <button 
                onClick={() => setShowAddParticipants(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {contacts.filter(c => c.id !== contact.id).map(c => (
                <div key={c.id} className="flex items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-600 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {c.avatar ? <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" /> : <span className="text-slate-500 dark:text-slate-400 font-bold">{c.name.charAt(0)}</span>}
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="font-medium text-slate-800 dark:text-slate-200">{c.name}</div>
                  </div>
                  <button 
                    onClick={() => {
                      setToastMessage(`Invitation sent to ${c.name}`);
                      setTimeout(() => setToastMessage(null), 3000);
                      setShowAddParticipants(false);
                    }}
                    className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toast Message */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-in fade-in slide-in-from-top-4">
          {toastMessage}
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden relative z-10">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center">
                <Settings className="w-5 h-5 mr-2 opacity-70" /> Call Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-5 text-sm">
              <div className="flex items-center justify-between">
                <div className="text-slate-700 dark:text-slate-200">Echo Cancellation</div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={callSettings.echoCancellation} onChange={(e) => setCallSettings(prev => ({ ...prev, echoCancellation: e.target.checked }))} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-500"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-slate-700 dark:text-slate-200">Noise Suppression</div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={callSettings.noiseSuppression} onChange={(e) => setCallSettings(prev => ({ ...prev, noiseSuppression: e.target.checked }))} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-500"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-slate-700 dark:text-slate-200">Auto Gain Control</div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={callSettings.autoGainControl} onChange={(e) => setCallSettings(prev => ({ ...prev, autoGainControl: e.target.checked }))} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-500"></div>
                </label>
              </div>
              {callSession.type === 'video' && (
                <>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between mb-2">
                       <span className="text-slate-700 dark:text-slate-200">Frame Rate</span>
                       <span className="text-indigo-500 font-medium">{callSettings.frameRate} fps</span>
                    </div>
                    <input type="range" min="15" max="60" step="15" value={callSettings.frameRate} onChange={(e) => setCallSettings(prev => ({ ...prev, frameRate: parseInt(e.target.value) }))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-indigo-500" />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>Low</span>
                      <span>High</span>
                    </div>
                  </div>
                  <div className="pt-2">
                    <div className="flex justify-between mb-2">
                       <span className="text-slate-700 dark:text-slate-200">Bandwidth / Bitrate</span>
                       <span className="text-indigo-500 font-medium">{callSettings.videoBitrate === 0 ? 'Auto' : `${callSettings.videoBitrate} kbps`}</span>
                    </div>
                    <input type="range" min="0" max="2000" step="100" value={callSettings.videoBitrate} onChange={(e) => setCallSettings(prev => ({ ...prev, videoBitrate: parseInt(e.target.value) }))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-indigo-500" />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>Auto</span>
                      <span>2000</span>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-end">
               <button onClick={() => setShowSettings(false)} className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-medium rounded-xl transition-colors">
                 Done
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

