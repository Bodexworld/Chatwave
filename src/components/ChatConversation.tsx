import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation, PanInfo, AnimatePresence } from 'motion/react';
import { Chat, Message, User } from '../data/mock';
import { ArrowLeft, Video, Phone, PhoneMissed, Search, MoreVertical, Paperclip, Smile, Mic, Check, CheckCheck, Square, Trash2, Reply, X, Lock, FileText, Camera, Image as ImageIcon, Headphones, Store, Zap, MapPin, User as UserIcon, BarChart2, Calendar, Languages, Loader2, Pencil, Forward, Sparkles } from 'lucide-react';
import { translateChat, summarizeChat } from '../lib/geminiService';
import { format, isSameDay, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { useMessages } from '../lib/useMessages';
import { useAuth } from '../lib/AuthContext';
import { useContacts } from '../lib/useContacts';
import { useCalls, CallSession } from '../lib/useCalls';
import { useChats } from '../lib/useChats';
import { doc, collection, setDoc, serverTimestamp, updateDoc, onSnapshot, deleteDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import ContactInfoModal from './ContactInfoModal';
import GroupInfoModal from './GroupInfoModal';

function AudioPlayer({ isMe, url = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', durationText = '0:05' }: { isMe: boolean, url?: string, durationText?: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, [url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="flex items-center space-x-3 py-1 min-w-[200px]">
      <button onClick={togglePlay} className={`p-1.5 rounded-full flex-shrink-0 transition-all hover:scale-105 active:scale-95 ${isMe ? 'bg-indigo-500 text-white hover:bg-indigo-400' : 'bg-slate-100 dark:bg-slate-700 text-indigo-500 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
        {isPlaying ? (
          <svg viewBox="0 0 24 24" width="20" height="20" className="fill-current"><rect x="7" y="6" width="3" height="12" rx="1"/><rect x="14" y="6" width="3" height="12" rx="1"/></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" className="fill-current ml-0.5"><path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"/></svg>
        )}
      </button>
      <div className="flex-1 bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden relative cursor-pointer" onClick={(e) => {
        if (!audioRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audioRef.current.currentTime = percent * audioRef.current.duration;
        setProgress(percent * 100);
      }}>
        <div 
          className={`h-full absolute left-0 top-0 transition-all duration-100 ease-linear ${isMe ? 'bg-white' : 'bg-indigo-500'}`} 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className={`text-xs font-medium w-8 text-right opacity-80 flex-shrink-0`}>{durationText}</div>
    </div>
  );
}

function SwipeableMessage({ children, onSwipe, isMe }: { children: React.ReactNode, onSwipe: () => void, isMe: boolean, key?: React.Key }) {
  const controls = useAnimation();
  const [isSwiping, setIsSwiping] = useState(false);

  const handleDragEnd = (event: any, info: PanInfo) => {
    setIsSwiping(false);
    if (info.offset.x > 50) {
      onSwipe();
    }
    controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 25 } });
  };

  const handleDragStart = () => {
    setIsSwiping(true);
  };

  return (
    <div className="relative flex items-center w-full overflow-hidden" style={{ touchAction: 'pan-y' }}>
      <div className="absolute left-0 h-full flex items-center pointer-events-none z-0">
        <div className={`w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-sm transition-opacity ml-4 ${isSwiping ? 'opacity-100' : 'opacity-0'}`}>
          <Reply className="w-4 h-4 text-indigo-500" />
        </div>
      </div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.5 }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        animate={controls}
        className={`w-full flex ${isMe ? 'justify-end' : 'justify-start'} relative z-10 bg-transparent`}
      >
        <div className={isSwiping ? 'pointer-events-none' : ''}>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

type Props = {
  chat: Chat;
  onBack: () => void;
  isMobile: boolean;
  onStartCall: (type: 'voice' | 'video', contact: User) => void;
};

export default function ChatConversation({ chat, onBack, isMobile, onStartCall }: Props) {
  const { user } = useAuth();
  const { contacts } = useContacts();
  const { messages, loading } = useMessages(chat.id);
  const { callHistory } = useCalls();
  const isGroup = chat.type === 'group';
  const [userData, setUserData] = useState<User | null>(null);

  let otherUserId: string | null = null;
  chat.participants.forEach((p: any) => {
    const pId = typeof p === 'string' ? p : p.id;
    if (pId && pId !== user?.uid) {
      otherUserId = pId;
    }
  });

  const allMessages = React.useMemo(() => {
    let combined: any[] = [...messages];
    if (!isGroup && otherUserId) {
      const callsForChat = callHistory.filter(call => 
        (call.callerId === user?.uid && call.receiverId === otherUserId) ||
        (call.callerId === otherUserId && call.receiverId === user?.uid)
      );
      
      const fakeCallMessages = callsForChat.map(call => ({
        id: call.id,
        chatId: chat.id,
        senderId: call.callerId,
        content: '',
        timestamp: call.createdAt?.toDate ? call.createdAt.toDate() : new Date(),
        status: call.status,
        type: 'call',
        callType: call.type
      }));
      combined = [...combined, ...fakeCallMessages];
    }
    
    // Sort combined by timestamp ascending (same order as original messages)
    return combined.sort((a, b) => {
      const aTime = a.timestamp?.getTime ? a.timestamp.getTime() : 0;
      const bTime = b.timestamp?.getTime ? b.timestamp.getTime() : 0;
      return aTime - bTime;
    });
  }, [messages, callHistory, isGroup, otherUserId, user, chat.id]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docObj) => {
      if (docObj.exists()) {
        setUserData(docObj.data() as User);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const otherUser = contacts.find(c => c.id === otherUserId);
  const name = isGroup ? chat.name : (otherUser?.name || 'Unknown');
  const avatar = isGroup ? chat.avatar : otherUser?.avatar;
  
  const typingUsers = Object.entries(chat.typing || {})
    .filter(([uid, isTyping]) => isTyping && uid !== user?.uid)
    .map(([uid]) => contacts.find(c => c.id === uid)?.name?.split(' ')[0] || 'Someone');
  const typingStatus = typingUsers.length > 0 
    ? `${typingUsers.join(', ')} typing...` 
    : null;
    
  const statusMenu = typingStatus || (isGroup ? chat.participants.map((p: any) => {
    const pId = typeof p === 'string' ? p : p.id;
    return pId === user?.uid ? 'You' : (contacts.find(c => c.id === pId)?.name || 'Unknown');
  }).join(', ') : (otherUser?.online ? 'Online' : (otherUser?.lastSeen ? `Last seen ${formatDistanceToNow(otherUser.lastSeen, { addSuffix: true })}` : 'Offline')));

  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [messageContextMenu, setMessageContextMenu] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string | null>(null);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'hi', name: 'Hindi' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ru', name: 'Russian' },
    { code: 'yo', name: 'Yoruba' },
    { code: 'ig', name: 'Igbo' },
    { code: 'ha', name: 'Hausa' },
    { code: 'sw', name: 'Swahili' },
    { code: 'it', name: 'Italian' },
    { code: 'ko', name: 'Korean' },
    { code: 'tr', name: 'Turkish' },
    { code: 'nl', name: 'Dutch' },
  ];
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const { chats } = useChats();
  const [toast, setToast] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeRef = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const maxSwipeOffset = 150; // pixels to swipe left to cancel

  const [aiSummary, setAiSummary] = useState<{summary: string, actionItems: string[]} | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const pointerStartXRef = useRef(0);

  // showTemporaryToast
  const showTemporaryToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSummarizeChat = async () => {
    if (messages.length === 0) return;
    setIsSummarizing(true);
    setShowSummaryModal(true);
    try {
      const textMessages = messages.filter(m => m.content);
      const res = await summarizeChat(textMessages.slice(-50)); // summarize last 50
      if (res) {
         setAiSummary(res);
      }
    } catch (e: any) {
      console.error(e);
      showTemporaryToast(`Failed to generate summary: ${e.message || String(e)}`);
      setShowSummaryModal(false);
    } finally {
      setIsSummarizing(false);
    }
  };

  useEffect(() => {
    if (!targetLanguage || messages.length === 0) return;

    const translatePending = async () => {
      const untranslated = messages.filter(m => m.content && !translatedMessages[m.id]);
      if (untranslated.length === 0) return;

      setIsTranslating(true);
      try {
        const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage);
        const langName = langInfo ? langInfo.name : targetLanguage;
        const translations = await translateChat(untranslated, langName);
        
        setTranslatedMessages(prev => {
          const next = { ...prev };
          translations.forEach((item: { id: string, content: string }) => {
            next[item.id] = item.content;
          });
          return next;
        });
      } catch (error) {
        console.error('Translation error:', error);
      } finally {
        setIsTranslating(false);
      }
    };
    translatePending();
  }, [messages, targetLanguage]);

  const handleLanguageSelect = (code: string | null) => {
    setShowLanguageSelector(false);
    if (code !== targetLanguage) {
      setTranslatedMessages({});
    }
    setTargetLanguage(code);
    if (code) {
      setShowTranslated(true);
      showTemporaryToast(`Translating...`);
    } else {
      setShowTranslated(false);
      showTemporaryToast('Translation off');
    }
  };

  const setTypingStatus = async (isTyping: boolean) => {
    if (!user || !chat.id) return;
    try {
      const chatRef = doc(db, 'chats', chat.id);
      await updateDoc(chatRef, {
        [`typing.${user.uid}`]: isTyping
      });
    } catch (error) {
      console.error('Failed to update typing status', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    
    if (e.target.value.trim().length > 0) {
      if (!typingTimeoutRef.current) {
        setTypingStatus(true);
      } else {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        setTypingStatus(false);
        typingTimeoutRef.current = null;
      }, 2000);
    } else {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      setTypingStatus(false);
    }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user || !chat.id) return;
    const chatRef = doc(db, 'chats', chat.id);
    const unsubscribe = onSnapshot(chatRef, (docObj) => {
      if (docObj.exists()) {
        const data = docObj.data();
        const myUnread = data.unreadCount?.[user.uid] || 0;
        if (myUnread > 0) {
          const newUnreadCount = { ...(data.unreadCount || {}) };
          newUnreadCount[user.uid] = 0;
          updateDoc(chatRef, { unreadCount: newUnreadCount }).catch(console.error);
        }
      }
    });
    return () => unsubscribe();
  }, [chat.id, user]);

  const handleAcceptRequest = async () => {
    try {
      await updateDoc(doc(db, 'chats', chat.id), {
        status: 'accepted'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'chats');
    }
  };

  const handleDeclineRequest = async () => {
    try {
      await deleteDoc(doc(db, 'chats', chat.id));
      onBack();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'chats');
    }
  };

  const handleForwardMessage = async (targetChatId: string | null, contactId: string | null) => {
    if (!user || !forwardingMessage) return;
    
    let targetId = targetChatId;
    
    if (!targetId && contactId) {
      // Find or create direct chat
      const participants = [user.uid, contactId].sort();
      targetId = `direct_${participants[0]}_${participants[1]}`;
      
      try {
        const chatRef = doc(db, 'chats', targetId);
        const chatDoc = await getDoc(chatRef);
        
        if (!chatDoc.exists()) {
           const initialUnread: Record<string, number> = {};
           initialUnread[contactId] = 1;
           await setDoc(chatRef, {
              type: 'direct',
              participants,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              lastMessage: {},
              unreadCount: initialUnread,
              name: '',
              avatar: '',
              status: 'active',
              typing: {}
           });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'chats');
        return;
      }
    }
    
    if (!targetId) return;

    try {
      const messageRef = doc(collection(db, `chats/${targetId}/messages`));
      const newMsg: any = {
        chatId: targetId,
        senderId: user.uid,
        content: forwardingMessage.content,
        mediaUrl: forwardingMessage.mediaUrl || '',
        type: forwardingMessage.type,
        status: 'sent',
        timestamp: serverTimestamp()
      };
      
      await setDoc(messageRef, newMsg);

      // Update parent chat last message
      const chatRef = doc(db, 'chats', targetId);
      
      const targetChat = chats.find(c => c.id === targetId);
      const newUnreadCount = { ...(targetChat?.unreadCountMap || {}) };
      
      let pList = targetChat?.participants || [];
      if (!targetChat && contactId) {
        pList = [user.uid, contactId];
      }
      
      pList.forEach((p: any) => {
        const pId = typeof p === 'string' ? p : p.id;
        if (pId && pId !== user.uid) {
           newUnreadCount[pId] = (newUnreadCount[pId] || 0) + 1;
        }
      });

      await updateDoc(chatRef, {
        updatedAt: serverTimestamp(),
        lastMessage: {
          content: forwardingMessage.type === 'text' ? forwardingMessage.content : `[${forwardingMessage.type}]`,
          timestamp: serverTimestamp(),
          senderId: user.uid,
          status: 'sent'
        },
        unreadCount: newUnreadCount
      });
      
      showTemporaryToast('Message forwarded successfully');
      setShowForwardModal(false);
      setForwardingMessage(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `chats/${targetId}/messages`);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !user) return;
    const text = inputText.trim();
    setInputText('');
    const currentReply = replyingTo;
    setReplyingTo(null);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    setTypingStatus(false);
    
    if (editingMessage) {
       try {
         const messageRef = doc(db, `chats/${chat.id}/messages`, editingMessage.id);
         await updateDoc(messageRef, {
           content: text,
           isEdited: true
         });
         setEditingMessage(null);
       } catch (err) {
         handleFirestoreError(err, OperationType.UPDATE, `chats/${chat.id}/messages`);
       }
       return;
    }
    
    try {
      const messageRef = doc(collection(db, `chats/${chat.id}/messages`));
      const newMsg: any = {
        chatId: chat.id,
        senderId: user.uid,
        content: text,
        type: 'text',
        status: 'sending',
        timestamp: serverTimestamp()
      };

      if (currentReply) {
        newMsg.replyTo = {
          id: currentReply.id,
          content: currentReply.content,
          senderId: currentReply.senderId,
          type: currentReply.type
        };
      }
      
      await setDoc(messageRef, newMsg);
      await updateDoc(messageRef, { status: 'sent' });

      // Update parent chat last message
      const chatRef = doc(db, 'chats', chat.id);
      
      const newUnreadCount = { ...(chat.unreadCountMap || {}) };
      chat.participants.forEach((p: any) => {
        const pId = typeof p === 'string' ? p : p.id;
        if (pId && pId !== user.uid) {
           newUnreadCount[pId] = (newUnreadCount[pId] || 0) + 1;
        }
      });

      await updateDoc(chatRef, {
        updatedAt: serverTimestamp(),
        lastMessage: newMsg,
        unreadCount: newUnreadCount
      });

    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `chats/${chat.id}/messages`);
    }
  };

  const handleSendVoice = async (base64Audio: string, durationSecs: number) => {
    if (!user) return;
    
    try {
      const messageRef = doc(collection(db, `chats/${chat.id}/messages`));
      
      const mins = Math.floor(durationSecs / 60);
      const secs = durationSecs % 60;
      const durationText = `${mins}:${secs.toString().padStart(2, '0')}`;

      const newMsg = {
        chatId: chat.id,
        senderId: user.uid,
        content: durationText,
        type: 'voice',
        status: 'sending',
        fileUrl: base64Audio,
        timestamp: serverTimestamp()
      };
      
      await setDoc(messageRef, newMsg);
      await updateDoc(messageRef, { status: 'sent' });

      // Update parent chat last message
      const chatRef = doc(db, 'chats', chat.id);
      
      const newUnreadCount = { ...(chat.unreadCountMap || {}) };
      chat.participants.forEach((p: any) => {
        const pId = typeof p === 'string' ? p : p.id;
        if (pId && pId !== user.uid) {
           newUnreadCount[pId] = (newUnreadCount[pId] || 0) + 1;
        }
      });

      await updateDoc(chatRef, {
        updatedAt: serverTimestamp(),
        lastMessage: newMsg,
        unreadCount: newUnreadCount
      });

    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `chats/${chat.id}/messages`);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Stop all tracks to release the mic
        stream.getTracks().forEach(track => track.stop());

        // Check if it was a real recording (not cancelled)
        if (recordingTimeRef.current > 0 && !audioUrl) {
           const reader = new FileReader();
           reader.readAsDataURL(audioBlob);
           reader.onloadend = () => {
              const base64Audio = reader.result as string;
              handleSendVoice(base64Audio, recordingTimeRef.current);
           };
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimeRef.current = 0;
      setSwipeOffset(0);
      setAudioUrl(null);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          recordingTimeRef.current = prev + 1;
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone', err);
      if (!navigator.mediaDevices) {
         showTemporaryToast('Microphone disabled. Please open the app in a new tab.');
      } else {
         showTemporaryToast('Microphone access denied. Please allow permissions.');
      }
    }
  };

  const stopRecording = (cancel = false) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      if (cancel) {
         setAudioUrl('cancelled'); // hack to prevent sending in onstop
         recordingTimeRef.current = 0; // prevent sending
      }
      mediaRecorderRef.current.stop();
    }
    
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
  };

  const handleSendSpecialMsg = async (type: 'location' | 'contact' | 'poll' | 'event') => {
    if (!user) return;
    try {
      const messageRef = doc(collection(db, `chats/${chat.id}/messages`));
      const newMsg: any = {
        chatId: chat.id,
        senderId: user.uid,
        content: '',
        status: 'sending',
        type: type,
        timestamp: serverTimestamp()
      };

      await setDoc(messageRef, newMsg);
      await updateDoc(messageRef, { status: 'sent' });
      
      const newUnreadCount = { ...(chat.unreadCountMap || {}) };
      chat.participants.forEach((p: any) => {
        const pId = typeof p === 'string' ? p : p.id;
        if (pId && pId !== user.uid) {
           newUnreadCount[pId] = (newUnreadCount[pId] || 0) + 1;
        }
      });

      await updateDoc(doc(db, 'chats', chat.id), {
        updatedAt: serverTimestamp(),
        lastMessage: newMsg,
        unreadCount: newUnreadCount
      });
      setShowAttachments(false);
      showTemporaryToast(`Sent ${type}`);
    } catch (error) {
      console.error("Failed to send special message", error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, `chats/${chat.id}/messages`, messageId));
      setMessageContextMenu(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `chats/${chat.id}/messages`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file' | 'voice') => {
    if(e.target.files?.length) {
      const file = e.target.files[0];
      const reader = new FileReader();
      const fileName = file.name;
      const fileSize = (file.size / 1024 / 1024).toFixed(1) + ' MB';
      reader.onloadend = async () => {
        const base64Url = reader.result as string;
        if (!user) return;
        try {
          const messageRef = doc(collection(db, `chats/${chat.id}/messages`));
          const newMsg: any = {
            chatId: chat.id,
            senderId: user.uid,
            content: '',
            status: 'sending',
            type: type,
            timestamp: serverTimestamp()
          };

          if (type === 'image') {
             newMsg.mediaUrl = base64Url;
          } else if (type === 'file') {
             newMsg.fileUrl = base64Url;
             newMsg.fileName = fileName;
             newMsg.fileSize = fileSize;
          } else if (type === 'voice') {
             newMsg.fileUrl = base64Url;
             newMsg.content = 'Audio';
          }

          await setDoc(messageRef, newMsg);
          await updateDoc(messageRef, { status: 'sent' });
          
          const newUnreadCount = { ...(chat.unreadCountMap || {}) };
          chat.participants.forEach((p: any) => {
            const pId = typeof p === 'string' ? p : p.id;
            if (pId && pId !== user.uid) {
               newUnreadCount[pId] = (newUnreadCount[pId] || 0) + 1;
            }
          });

          await updateDoc(doc(db, 'chats', chat.id), {
            updatedAt: serverTimestamp(),
            lastMessage: newMsg,
            unreadCount: newUnreadCount
          });
        } catch (error) {
          console.error("Failed to upload file state", error);
        }
      };
      reader.readAsDataURL(file);
      setShowAttachments(false); // Close menu
    }
  };

  // Prevent scrolling when swiping on mobile
  useEffect(() => {
    const preventScroll = (e: TouchEvent) => {
       if (isRecording) {
          e.preventDefault();
       }
    };
    document.addEventListener('touchmove', preventScroll, { passive: false });
    return () => {
       document.removeEventListener('touchmove', preventScroll);
    };
  }, [isRecording]);

  useEffect(() => {
    if (!messages.length || !user || !chat.id) return;
    
    const unreadMessages = messages.filter(
      (msg) => msg.senderId !== user.uid && msg.status !== 'read'
    );
    
    if (unreadMessages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute('data-message-id');
            if (messageId) {
              const msgRef = doc(db, `chats/${chat.id}/messages`, messageId);
              updateDoc(msgRef, { status: 'read' }).catch(err => {
                console.error("Failed to update message status to read");
              });
              observer.unobserve(entry.target);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    const messageEls = document.querySelectorAll('.message-bubble[data-message-id]');
    messageEls.forEach((el) => {
      const msgId = el.getAttribute('data-message-id');
      if (msgId && unreadMessages.find(m => m.id === msgId)) {
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [messages, user, chat.id]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0f172a] relative z-10 w-full overflow-hidden">
      {/* Subtle chat background pattern */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.4] dark:opacity-[0.1]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%239CA3AF' fill-opacity='0.2' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='1.5'/%3E%3Ccircle cx='13' cy='13' r='1.5'/%3E%3C/g%3E%3C/svg%3E")`
        }}
      />
      {/* Header */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl h-20 flex items-center px-6 flex-shrink-0 z-10 border-b border-slate-100 dark:border-slate-800/60 shadow-sm">
        <div className="flex items-center flex-1">
          {isMobile && (
            <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="mr-2 p-1.5 -ml-2 z-20 relative text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all rounded-full border border-slate-200 dark:border-slate-800">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center flex-1 cursor-pointer group" onClick={() => setShowContactInfo(true)}>
            <div className="w-12 h-12 rounded-[1.25rem] overflow-hidden mr-4 bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-500 uppercase shrink-0 ring-2 ring-transparent group-hover:ring-indigo-500/30 transition-all cursor-pointer shadow-sm">
               {avatar ? (
                  <img src={avatar} alt={name || '#'} className="w-full h-full object-cover" />
               ) : (
                  <span>{(name ? name.charAt(0) : '?')}</span>
               )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center">
                <h2 className="text-lg font-display font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mr-3">{name}</h2>
                <div className="flex items-center text-[9px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full flex-shrink-0" title="End-to-end encrypted">
                  <Lock className="w-3 h-3 mr-1" />
                  E2EE
                </div>
              </div>
              <p className="text-sm font-medium text-slate-500 truncate mt-0.5">{statusMenu}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 sm:space-x-2 text-slate-500 dark:text-slate-400 ml-2">
          <button 
             onClick={() => { if(otherUser) onStartCall('video', otherUser); }}
             className="hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 p-2.5 rounded-xl transition-all hover:text-indigo-600 dark:hover:text-indigo-400"
          >
             <Video className="w-5 h-5" />
          </button>
          <button 
             onClick={() => { if(otherUser) onStartCall('voice', otherUser); }}
             className="hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 p-2.5 rounded-xl transition-all hover:text-indigo-600 dark:hover:text-indigo-400"
          >
             <Phone className="w-5 h-5" />
          </button>
          <button 
             onClick={handleSummarizeChat}
             disabled={isSummarizing}
             className="hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 p-2.5 rounded-xl transition-all hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50"
             title="AI Summary"
          >
             {isSummarizing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          </button>
          <button onClick={() => showTemporaryToast('Search feature coming soon')} className="hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 p-2.5 rounded-xl transition-all hidden sm:block"><Search className="w-5 h-5" /></button>
          <button onClick={() => setShowOptions(!showOptions)} className="hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 p-2.5 rounded-xl transition-all"><MoreVertical className="w-5 h-5" /></button>
          
          {showOptions && (
            <div className="absolute right-6 top-16 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
               <button className="w-full text-left px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors" onClick={() => { setShowOptions(false); setShowContactInfo(true); }}>Contact info</button>
               <button className="w-full text-left px-5 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium text-red-600 dark:text-red-400 transition-colors" onClick={() => { setShowOptions(false); showTemporaryToast('Clear chat'); }}>Clear chat</button>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-[#111B21] text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-in fade-in slide-in-from-top-4">
          {toast}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 z-10">
        <div className="flex flex-col space-y-2 max-w-4xl mx-auto">
          {loading && <div className="text-center py-4 text-slate-500">Loading messages...</div>}
          <AnimatePresence initial={false}>
          {allMessages.map((msg, idx) => {
            const isMe = msg.senderId === user?.uid;
            const showName = isGroup && !isMe && (idx === 0 || allMessages[idx-1].senderId !== msg.senderId);
            
            // Get sender profile to show avatar
            const sender = isMe ? userData : contacts.find(p => p.id === msg.senderId);
            const senderAvatar = sender?.avatar;

            const msgDate = new Date(msg.timestamp);
            const prevDate = idx > 0 ? new Date(allMessages[idx-1].timestamp) : new Date();
            const isValidDate = !isNaN(msgDate.getTime()) && (idx === 0 || !isNaN(prevDate.getTime()));
            const isSameAsPrevious = idx > 0 && isValidDate && isSameDay(msgDate, prevDate);
            let dateHeader = null;

            if (!isSameAsPrevious && isValidDate) {
              const date = msgDate;
              if (isToday(date)) {
                dateHeader = 'Today';
              } else if (isYesterday(date)) {
                dateHeader = 'Yesterday';
              } else {
                dateHeader = format(date, 'MMMM d, yyyy');
              }
            }

            return (
              <motion.div 
                layout 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
                key={msg.id}
                className="flex flex-col"
              >
                {dateHeader && (
                  <div className="flex justify-center my-4">
                    <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm shadow-sm text-slate-500 dark:text-slate-400 text-[11px] font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                      {dateHeader}
                    </div>
                  </div>
                )}
                <SwipeableMessage isMe={isMe} onSwipe={() => setReplyingTo(msg)}>
                  <div 
                    data-message-id={msg.id} 
                    className={`message-bubble flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-3 mb-3 max-w-full hover:scale-[1.01] transition-transform origin-bottom relative`}
                  >
                  {messageContextMenu === msg.id && (
                    <div className={`absolute z-50 bottom-full mb-2 ${isMe ? 'right-0' : 'left-0'} bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden min-w-[140px]`}>
                      {isMe && msg.type === 'text' && (
                        <button 
                          onClick={() => {
                            setEditingMessage(msg);
                            setInputText(msg.content);
                            setMessageContextMenu(null);
                          }}
                          className="w-full flex items-center px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-700"
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit Message
                        </button>
                      )}
                      {isMe && (
                        <button 
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="w-full flex items-center px-4 py-3 text-sm text-red-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-700"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Message
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          setForwardingMessage(msg);
                          setShowForwardModal(true);
                          setMessageContextMenu(null);
                        }}
                        className="w-full flex items-center px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                      >
                        <Forward className="w-4 h-4 mr-2" />
                        Forward
                      </button>
                      <button 
                        onClick={() => setMessageContextMenu(null)}
                        className="w-full flex items-center px-4 py-3 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors border-t border-slate-100 dark:border-slate-700"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </button>
                    </div>
                  )}
                  {!isMe && (
                    <div className="w-8 h-8 overflow-hidden flex-shrink-0 mb-1 rounded-[0.8rem] border border-slate-200/50 dark:border-slate-700/50 shadow-sm bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 uppercase font-bold text-sm cursor-default">
                      {senderAvatar ? (
                        <img src={senderAvatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span>{sender ? sender.name.charAt(0) : '?'}</span>
                      )}
                    </div>
                  )}
                  <div 
                    onContextMenu={(e) => { e.preventDefault(); setMessageContextMenu(msg.id); }}
                    className={`max-w-[85%] md:max-w-[75%] rounded-[1.5rem] px-5 py-3 relative shadow-sm text-[15px] cursor-pointer ${
                      isMe 
                      ? 'bg-indigo-600 text-white rounded-br-md shadow-indigo-500/10' 
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-md border border-slate-100 dark:border-slate-700/50'
                    }`}
                  >
                    {/* Tail for bubbles (hidden since we added avatars and gap, but we can keep it as part of design, just adjusting border-radius above) */}

                    {showName && sender && (
                      <div className="text-[13px] font-medium text-[#c031ce] dark:text-[#f265f8] mb-0.5">{sender.name}</div>
                    )}

                    {/* @ts-ignore */}
                    {msg.replyTo && (
                      <div className="bg-black/10 dark:bg-white/10 p-2 rounded-lg mb-1.5 flex items-start text-[13px] border-l-2 border-indigo-400">
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold capitalize truncate ${isMe ? 'text-indigo-100' : 'text-indigo-600 dark:text-indigo-400'}`}>
                            {/* @ts-ignore */}
                            {msg.replyTo.senderId === user?.uid ? 'You' : contacts.find((c) => c.id === msg.replyTo.senderId)?.name || 'Someone'}
                          </div>
                          <div className={`truncate opacity-80 ${isMe ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                            {/* @ts-ignore */}
                            {msg.replyTo.content || (msg.replyTo.type === 'voice' ? 'Voice Message' : msg.replyTo.type === 'image' ? 'Image' : 'File')}
                          </div>
                        </div>
                      </div>
                    )}

                    {msg.type === 'image' && msg.mediaUrl && (
                      <div className="mb-1 rounded overflow-hidden">
                        <img src={msg.mediaUrl} alt="Photo" className="max-w-full h-auto cursor-pointer" />
                      </div>
                    )}

                    {msg.type === 'voice' && (
                      <AudioPlayer isMe={isMe} url={msg.fileUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'} durationText={msg.content || '0:05'} />
                    )}

                    {msg.type === 'file' && (
                      <div className="flex items-center space-x-3 bg-black/5 dark:bg-white/5 rounded-xl p-3 mb-1">
                        <div className={`p-2.5 rounded-lg ${isMe ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-indigo-500'}`}>
                          <Paperclip className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{/* @ts-ignore */} {msg.fileName}</div>
                          <div className="text-xs opacity-70 uppercase font-medium">{/* @ts-ignore */} {msg.fileSize}</div>
                        </div>
                      </div>
                    )}

                    {msg.type === 'location' && (
                      <div className={`mb-1 rounded-xl overflow-hidden ${isMe ? 'bg-white/10' : 'bg-black/5 dark:bg-white/5'} p-3 flex flex-col gap-2 min-w-[200px]`}>
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${isMe ? 'bg-emerald-400 text-white shadow-sm' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div className="font-semibold text-sm">Shared Location</div>
                        </div>
                        <div className="w-full h-32 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center relative overflow-hidden group/map cursor-pointer">
                          <div className="absolute inset-0 opacity-30 dark:opacity-20 group-hover/map:opacity-40 transition-opacity bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=40.7128,-74.0060&zoom=13&size=400x200&sensor=false')] bg-cover bg-center"></div>
                          <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center relative z-10 animate-pulse">
                             <div className="w-3 h-3 rounded-full bg-rose-500 shadow-sm"></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {msg.type === 'contact' && (
                      <div className={`mb-1 rounded-xl overflow-hidden ${isMe ? 'bg-white/10' : 'bg-black/5 dark:bg-white/5'} p-3 flex flex-col gap-3 min-w-[200px]`}>
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                              <UserIcon className="w-5 h-5 opacity-50" />
                           </div>
                           <div className="flex-1">
                             <div className="font-semibold text-sm">John Doe</div>
                             <div className="text-xs opacity-70">Contact</div>
                           </div>
                         </div>
                         <button className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors active:scale-[0.98] ${isMe ? 'bg-white/20 hover:bg-white/30 text-white shadow-sm' : 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/30 shadow-sm'}`}>Message</button>
                      </div>
                    )}

                    {msg.type === 'poll' && (
                      <div className={`mb-1 rounded-xl overflow-hidden ${isMe ? 'bg-white/10' : 'bg-black/5 dark:bg-white/5'} p-4 flex flex-col gap-3 min-w-[240px]`}>
                        <div className="flex items-center gap-2 mb-1">
                          <BarChart2 className="w-5 h-5 opacity-70" />
                          <div className="font-bold text-sm leading-tight">Team check-in meeting</div>
                        </div>
                        <div className="flex flex-col gap-2.5">
                           <label className="flex items-center gap-3 cursor-pointer group/poll">
                             <input type="radio" name={`poll-${msg.id}`} className={`w-4 h-4 ${isMe ? 'accent-white' : 'accent-indigo-500'} cursor-pointer`} />
                             <span className="text-sm font-medium opacity-90 group-hover/poll:opacity-100 transition-opacity">Monday 10 AM</span>
                           </label>
                           <label className="flex items-center gap-3 cursor-pointer group/poll">
                             <input type="radio" name={`poll-${msg.id}`} className={`w-4 h-4 ${isMe ? 'accent-white' : 'accent-indigo-500'} cursor-pointer`} />
                             <span className="text-sm font-medium opacity-90 group-hover/poll:opacity-100 transition-opacity">Tuesday 2 PM</span>
                           </label>
                           <label className="flex items-center gap-3 cursor-pointer group/poll">
                             <input type="radio" name={`poll-${msg.id}`} className={`w-4 h-4 ${isMe ? 'accent-white' : 'accent-indigo-500'} cursor-pointer`} />
                             <span className="text-sm font-medium opacity-90 group-hover/poll:opacity-100 transition-opacity">Wednesday 11 AM</span>
                           </label>
                        </div>
                        <div className="mt-2 text-xs opacity-60 font-medium">0 votes</div>
                      </div>
                    )}

                    {msg.type === 'event' && (
                      <div className={`mb-1 rounded-xl overflow-hidden ${isMe ? 'bg-white/10' : 'bg-black/5 dark:bg-white/5'} p-3 flex flex-col gap-2 min-w-[220px] cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors`}>
                        <div className="flex items-start gap-3">
                           <div className={`flex flex-col items-center justify-center rounded-xl px-3 py-2 shadow-sm ${isMe ? 'bg-white/20 text-white' : 'bg-red-50 dark:bg-red-500/20 text-red-500 dark:text-red-400'}`}>
                             <div className="text-[10px] font-bold uppercase tracking-widest leading-none mb-1">MAY</div>
                             <div className="text-2xl font-black leading-none">24</div>
                           </div>
                           <div className="flex flex-col justify-center h-full pt-1">
                             <div className="font-bold text-sm leading-tight mb-1">Product Launch</div>
                             <div className="text-xs opacity-80 flex items-center gap-1 font-medium"><MapPin className="w-3 h-3"/> Online</div>
                             <div className="text-xs opacity-80 flex items-center gap-1 mt-0.5 font-medium"><Calendar className="w-3 h-3"/> 10:00 AM</div>
                           </div>
                        </div>
                      </div>
                    )}

                    {msg.type === 'call' && (
                      <div 
                        onClick={() => otherUser && onStartCall((msg as any).callType || 'voice', otherUser)}
                        className={`mb-1 rounded-xl overflow-hidden ${isMe ? 'bg-white/10 hover:bg-white/20' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'} p-4 flex items-center gap-3 min-w-[220px] cursor-pointer transition-colors`}
                      >
                        <div className={`p-3 rounded-full ${isMe ? 'bg-white/20 text-white' : 'bg-indigo-100 dark:bg-slate-700 text-indigo-500 dark:text-indigo-400'} ${msg.status === 'missed' ? 'text-red-500 bg-red-100 dark:text-red-400 dark:bg-red-500/20' : ''}`}>
                          {/* @ts-ignore */}
                          {msg.status === 'missed' ? <PhoneMissed className="w-5 h-5 text-red-500" /> : (msg.callType === 'video' ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />)}
                        </div>
                        <div className="flex-1">
                          <div className={`font-semibold text-sm ${msg.status === 'missed' ? 'text-red-500 dark:text-red-400' : ''}`}>
                            {msg.status === 'missed' ? 'Missed Call' : msg.status === 'rejected' ? 'Call Rejected' : msg.status === 'ended' ? 'Call Ended' : 'Call'}
                          </div>
                          <div className="text-xs opacity-70 mt-0.5 capitalize">
                            {/* @ts-ignore */}
                            {msg.callType} call
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-end gap-4 mt-1">
                      {msg.content && <p className="leading-relaxed break-words whitespace-pre-wrap">{showTranslated && translatedMessages[msg.id] ? translatedMessages[msg.id] : msg.content}</p>}
                      <div className="flex-shrink-0 flex items-center float-right ml-auto opacity-70">
                        {msg.isEdited && (
                          <span className="text-[10px] mr-1.5 italic tracking-wide">
                            edited
                          </span>
                        )}
                        <span className="text-[10px] font-semibold tracking-wider">
                          {isValidDate ? format(msgDate, 'HH:mm') : ''}
                        </span>
                        {isMe && (
                          <span className="ml-1.5 flex items-center justify-center">
                            {msg.status === 'sending' && <Check className="w-3.5 h-3.5" />}
                            {msg.status === 'sent' && <Check className="w-3.5 h-3.5" />}
                            {msg.status === 'delivered' && <CheckCheck className="w-4 h-4 opacity-70" />}
                            {msg.status === 'read' && <CheckCheck className="w-4 h-4 text-emerald-300" />}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isMe && (
                    <div className="w-8 h-8 overflow-hidden flex-shrink-0 mb-1 rounded-[0.8rem] border border-indigo-500/30 shadow-sm bg-indigo-500 flex items-center justify-center text-white uppercase font-bold text-sm cursor-default">
                      {senderAvatar ? (
                        <img src={senderAvatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span>{userData ? userData.name.charAt(0) : '?'}</span>
                      )}
                    </div>
                  )}
                </div>
              </SwipeableMessage>
              </motion.div>
            )
          })}
          </AnimatePresence>
          <div ref={endRef} />
        </div>
      </div>

      {/* Input Area */}
      {chat.status === 'pending' ? (
        <div className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/60 p-6 flex flex-col items-center justify-center z-10 text-center shadow-lg">
          {chat.requestedBy === user?.uid ? (
            <div className="flex flex-col items-center text-slate-500 dark:text-slate-400">
               <span className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-1">Request Sent</span>
               <span className="text-sm font-medium">Waiting for {name} to accept your chat request.</span>
            </div>
          ) : (
            <div className="flex flex-col items-center w-full max-w-md">
               <span className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-5">{name} wants to chat with you</span>
               <div className="flex space-x-4 w-full">
                 <button onClick={handleDeclineRequest} className="flex-1 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition-all bg-white dark:bg-slate-800 shadow-sm">
                   Decline
                 </button>
                 <button onClick={handleAcceptRequest} className="flex-1 py-3.5 rounded-2xl bg-indigo-600 font-semibold text-white hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-md shadow-indigo-500/20">
                   Accept
                 </button>
               </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {showEmoji && (
            <div className="absolute bottom-24 left-0 right-0 h-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl flex flex-wrap content-start p-4 gap-4 overflow-y-auto z-20 animate-in slide-in-from-bottom-2 fade-in duration-200 border-t border-slate-100 dark:border-slate-800 shadow-[0_-20px_40px_rgba(0,0,0,0.05)]">
              {['😀', '😂', '🤣', '❤️', '😍', '🙏', '👍', '😭', '🥺', '🥰', '✨', '🔥', '😊', '🎉', '😎', '🥹', '👀', '💯', '🤔', '🙌', '💔'].map(e => (
                <button key={e} onClick={() => { setInputText(prev => prev + e); }} className="text-4xl hover:scale-110 active:scale-95 transition-transform p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800">
                  {e}
                </button>
              ))}
            </div>
          )}
          <div className="bg-transparent px-4 py-4 z-10 w-full mb-2 flex flex-col relative">
            {replyingTo && (
              <div className="bg-white/90 dark:bg-slate-800/90 mx-3 p-3 rounded-t-2xl border border-b-0 border-slate-200 dark:border-slate-700 flex items-start -mb-2 z-0 relative pb-5 backdrop-blur-md animate-in slide-in-from-bottom-2 fade-in shadow-sm">
                <div className="w-1 absolute left-3 top-3 bottom-5 bg-indigo-500 rounded-full"></div>
                <div className="flex-1 ml-4 min-w-0">
                  <div className="text-xs font-bold tracking-wide text-indigo-600 dark:text-indigo-400 capitalize mb-0.5">
                    {replyingTo.senderId === user?.uid ? 'You' : contacts.find((c) => c.id === replyingTo.senderId)?.name || 'Someone'}
                  </div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate opacity-90">
                    {replyingTo.content || (replyingTo.type === 'voice' ? 'Voice Message' : replyingTo.type === 'image' ? 'Image' : 'File')}
                  </div>
                </div>
                <button onClick={() => setReplyingTo(null)} className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors ml-3">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {editingMessage && (
              <div className="bg-white/90 dark:bg-slate-800/90 mx-3 p-3 rounded-t-2xl border border-b-0 border-slate-200 dark:border-slate-700 flex items-start -mb-2 z-0 relative pb-5 backdrop-blur-md animate-in slide-in-from-bottom-2 fade-in shadow-sm">
                <div className="w-1 absolute left-3 top-3 bottom-5 bg-emerald-500 rounded-full"></div>
                <div className="flex-1 ml-4 min-w-0">
                  <div className="text-xs font-bold tracking-wide text-emerald-600 dark:text-emerald-400 capitalize mb-0.5">
                    Editing Message
                  </div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate opacity-90 line-through">
                    {editingMessage.content}
                  </div>
                </div>
                <button onClick={() => { setEditingMessage(null); setInputText(''); }} className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors ml-3">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Attachment Menu Popover */}
            {showAttachments && (
              <div className="absolute bottom-full left-0 mb-3 bg-[#111A22] dark:bg-[#111A22] rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.4)] border border-slate-700/50 z-50 w-full sm:w-[360px] animate-in fade-in slide-in-from-bottom-2">
                <div className="grid grid-cols-4 gap-y-6 gap-x-2">
                  <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => document.getElementById('file-upload-document')?.click()}>
                    <div className="w-14 h-14 rounded-2xl bg-[#1e2a36] flex items-center justify-center group-active:scale-95 transition-transform">
                      <FileText className="w-6 h-6 text-purple-500" />
                    </div>
                    <span className="text-xs font-medium text-slate-300">Document</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => document.getElementById('file-upload-camera')?.click()}>
                    <div className="w-14 h-14 rounded-2xl bg-[#1e2a36] flex items-center justify-center group-active:scale-95 transition-transform">
                      <Camera className="w-6 h-6 text-rose-500" />
                    </div>
                    <span className="text-xs font-medium text-slate-300">Camera</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => document.getElementById('file-upload-gallery')?.click()}>
                    <div className="w-14 h-14 rounded-2xl bg-[#1e2a36] flex items-center justify-center group-active:scale-95 transition-transform">
                      <ImageIcon className="w-6 h-6 text-sky-500" />
                    </div>
                    <span className="text-xs font-medium text-slate-300">Gallery</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => document.getElementById('file-upload-audio')?.click()}>
                    <div className="w-14 h-14 rounded-2xl bg-[#1e2a36] flex items-center justify-center group-active:scale-95 transition-transform">
                      <Headphones className="w-6 h-6 text-orange-500" />
                    </div>
                    <span className="text-xs font-medium text-slate-300">Audio</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => { showTemporaryToast('Coming soon'); setShowAttachments(false); }}>
                    <div className="w-14 h-14 rounded-2xl bg-[#1e2a36] flex items-center justify-center group-active:scale-95 transition-transform">
                      <Store className="w-6 h-6 text-teal-500" />
                    </div>
                    <span className="text-xs font-medium text-slate-300">Catalogue</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => { showTemporaryToast('Coming soon'); setShowAttachments(false); }}>
                    <div className="w-14 h-14 rounded-2xl bg-[#1e2a36] flex items-center justify-center group-active:scale-95 transition-transform">
                      <Zap className="w-6 h-6 text-yellow-500" />
                    </div>
                    <span className="text-xs font-medium text-slate-300">Quick Reply</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => handleSendSpecialMsg('location')}>
                    <div className="w-14 h-14 rounded-2xl bg-[#1e2a36] flex items-center justify-center group-active:scale-95 transition-transform">
                      <MapPin className="w-6 h-6 text-emerald-500" />
                    </div>
                    <span className="text-xs font-medium text-slate-300">Location</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => handleSendSpecialMsg('contact')}>
                    <div className="w-14 h-14 rounded-2xl bg-[#1e2a36] flex items-center justify-center group-active:scale-95 transition-transform">
                      <UserIcon className="w-6 h-6 text-blue-500" />
                    </div>
                    <span className="text-xs font-medium text-slate-300">Contact</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => handleSendSpecialMsg('poll')}>
                    <div className="w-14 h-14 rounded-2xl bg-[#1e2a36] flex items-center justify-center group-active:scale-95 transition-transform">
                      <BarChart2 className="w-6 h-6 text-yellow-400" />
                    </div>
                    <span className="text-xs font-medium text-slate-300">Poll</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => handleSendSpecialMsg('event')}>
                    <div className="w-14 h-14 rounded-2xl bg-[#1e2a36] flex items-center justify-center group-active:scale-95 transition-transform">
                      <Calendar className="w-6 h-6 text-rose-400" />
                    </div>
                    <span className="text-xs font-medium text-slate-300">Event</span>
                  </div>
                </div>
              </div>
            )}

            <div className={`flex items-end gap-2 bg-white dark:bg-slate-800 ${replyingTo ? 'rounded-b-[2rem] rounded-t-none' : 'rounded-[2rem]'} px-2 py-2 shadow-sm border border-slate-200 dark:border-slate-700/80 relative z-10 transition-all`}>
              <div className="flex space-x-1 text-slate-400 pb-1 relative">
                <div className="relative">
                  <button onClick={() => setShowLanguageSelector(!showLanguageSelector)} className={`p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-indigo-500 active:scale-95 transition-all ${targetLanguage ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/20 dark:text-indigo-400' : ''}`}>
                    {isTranslating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Languages className="w-6 h-6" />}
                  </button>
                  
                  {showLanguageSelector && (
                    <div className="absolute bottom-full left-0 mb-4 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
                      <div className="max-h-60 overflow-y-auto">
                        <button className={`w-full text-left px-5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm ${!targetLanguage ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`} onClick={() => handleLanguageSelect(null)}>Off</button>
                        {SUPPORTED_LANGUAGES.map(lang => (
                          <button 
                            key={lang.code}
                            className={`w-full text-left px-5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm ${targetLanguage === lang.code ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`} 
                            onClick={() => handleLanguageSelect(lang.code)}
                          >
                            {lang.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => setShowEmoji(!showEmoji)} className={`p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-indigo-500 active:scale-95 transition-all ${showEmoji ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/20 dark:text-indigo-400' : ''}`}><Smile className="w-6 h-6" /></button>
                <button onClick={() => setShowAttachments(!showAttachments)} className={`p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-indigo-500 active:scale-95 transition-all ${showAttachments ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/20 dark:text-indigo-400' : ''}`}><Paperclip className="w-6 h-6" /></button>
                <input 
                  type="file" 
                  id="file-upload-gallery" 
                  className="hidden" 
                  accept="image/*,video/*"
                  onChange={(e) => { 
                    handleFileUpload(e, 'image');
                    e.target.value=''; 
                  }}
                />
                <input 
                  type="file" 
                  id="file-upload-camera" 
                  className="hidden" 
                  accept="image/*,video/*"
                  capture="environment"
                  onChange={(e) => { 
                    handleFileUpload(e, 'image');
                    e.target.value=''; 
                  }}
                />
                <input 
                  type="file" 
                  id="file-upload-document" 
                  className="hidden" 
                  accept="*"
                  onChange={(e) => { 
                    handleFileUpload(e, 'file');
                    e.target.value=''; 
                  }}
                />
                <input 
                  type="file" 
                  id="file-upload-audio" 
                  className="hidden" 
                  accept="audio/*"
                  onChange={(e) => { 
                    handleFileUpload(e, 'voice');
                    e.target.value=''; 
                  }}
                />
              </div>
              {isRecording ? (
                <div className="flex-1 flex items-center justify-between text-rose-500 font-semibold h-[48px] px-3 mb-1 bg-rose-50/50 dark:bg-rose-500/10 rounded-xl mr-2 relative overflow-hidden">
                   <div className="flex items-center z-10 animate-[pulse_1.5s_ease-in-out_infinite]">
                     <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)] mr-3"></div>
                     <span className="text-[15px]">
                       {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                     </span>
                   </div>
                   <div 
                     className="absolute inset-0 flex items-center justify-end pr-14 text-slate-400 text-sm opacity-80"
                     style={{ transform: `translateX(${-swipeOffset}px)` }}
                   >
                     <span>&lt; Swipe left to cancel</span>
                   </div>
                </div>
              ) : (
                <div className="flex-1 max-h-32 overflow-y-auto custom-scrollbar mb-1 pt-1.5 flex items-center h-[48px]">
                  <textarea
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        const target = e.target as HTMLTextAreaElement;
                        const start = target.selectionStart;
                        const end = target.selectionEnd;
                        const value = target.value;
                        setInputText(value.substring(0, start) + '\n' + value.substring(end));
                        // Move cursor asynchronously after state update
                        setTimeout(() => {
                           target.selectionStart = target.selectionEnd = start + 1;
                        }, 0);
                      } else if (e.key === 'Enter' && !e.shiftKey) {
                        if (isMobile) {
                          // Allow natural new line on mobile
                          return;
                        }
                        e.preventDefault();
                        // handleSend(); causes error if not using ref or correctly bound, but we use the regular handleSend
                        handleSend();
                      }
                    }}
                    placeholder="Type a message..."
                    className="w-full bg-transparent border-none outline-none resize-none pt-2.5 pb-2 px-3 text-[16px] font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400/80 dark:placeholder-slate-500"
                    rows={1}
                  />
                </div>
              )}
              <div className="pb-1 ml-2">
                {inputText.trim() ? (
                  <button onClick={handleSend} className="p-3.5 rounded-full text-white bg-indigo-600 hover:bg-indigo-500 active:scale-90 transition-all shadow-md shadow-indigo-500/30">
                     <svg viewBox="0 0 24 24" width="22" height="22" className="fill-current ml-0.5"><path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/></svg>
                  </button>
                ) : (
                  <button 
                    onPointerDown={(e) => {
                      e.preventDefault();
                      (e.target as HTMLElement).setPointerCapture(e.pointerId);
                      pointerStartXRef.current = e.clientX;
                      startRecording();
                    }}
                    onPointerMove={(e) => {
                      if (!isRecording) return;
                      const delta = pointerStartXRef.current - e.clientX;
                      if (delta > 0) {
                        setSwipeOffset(Math.min(delta, maxSwipeOffset));
                        if (delta >= maxSwipeOffset) {
                           stopRecording(true); // cancel
                           (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                        }
                      }
                    }}
                    onPointerUp={(e) => {
                      e.preventDefault();
                      if (isRecording) {
                         stopRecording(false);
                         (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                      }
                    }}
                    onPointerCancel={(e) => {
                       if (isRecording) {
                          stopRecording(true);
                          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                       }
                    }}
                    className={`p-3.5 rounded-full transition-all text-white shadow-md select-none touch-none ${
                       isRecording ? 'bg-rose-500 hover:bg-rose-600 scale-125 mx-2' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/30'
                    }`}
                  >
                    <Mic className={`w-6 h-6 ${isRecording ? 'animate-pulse' : ''}`} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {showContactInfo && !isGroup && otherUser && (
        <ContactInfoModal 
          contact={otherUser} 
          onClose={() => setShowContactInfo(false)} 
          onStartCall={onStartCall} 
        />
      )}
      
      {showContactInfo && isGroup && (
        <GroupInfoModal
          chat={chat}
          contacts={contacts}
          onClose={() => setShowContactInfo(false)}
          currentUser={user}
        />
      )}
      
      {showForwardModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col h-[60vh] max-h-[500px]">
             <div className="p-4 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center shrink-0">
               <h3 className="font-bold text-lg text-slate-800 dark:text-white">Forward Message</h3>
               <button onClick={() => { setShowForwardModal(false); setForwardingMessage(null); }} className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                 <X className="w-5 h-5" />
               </button>
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2 mt-2">Recent Chats</div>
                {chats.length === 0 && <div className="p-3 text-sm text-slate-500 text-center">No recent chats</div>}
                
                {chats.map(c => {
                  let chatName = c.name;
                  let chatAvatar = c.avatar;
                  if (c.type === 'direct') {
                    const otherId = c.participants.find(p => {
                      const id = typeof p === 'string' ? p : p.id;
                      return id !== user?.uid;
                    });
                    const other = contacts.find(contact => contact.id === otherId);
                    chatName = other?.name || 'Unknown User';
                    chatAvatar = other?.avatar || '';
                  }
                  
                  return (
                    <button 
                      key={c.id}
                      onClick={() => handleForwardMessage(c.id, null)}
                      className="w-full flex items-center p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0">
                        {chatAvatar ? (
                           <img src={chatAvatar} alt={chatName} className="w-full h-full object-cover" />
                        ) : (
                           <div className="w-full h-full flex items-center justify-center font-bold text-slate-400">
                             {chatName ? chatName.charAt(0).toUpperCase() : '?'}
                           </div>
                        )}
                      </div>
                      <span className="ml-3 font-medium text-slate-800 dark:text-slate-200">{chatName}</span>
                    </button>
                  );
                })}
                
                <div className="h-px bg-slate-100 dark:bg-slate-700/50 my-2 mx-3"></div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2 mt-2">Contacts</div>
                {contacts.length === 0 && <div className="p-3 text-sm text-slate-500 text-center">No contacts available</div>}
                
                {contacts.map(contact => (
                  <button 
                    key={contact.id}
                    onClick={() => handleForwardMessage(null, contact.id)}
                    className="w-full flex items-center p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0">
                      {contact.avatar ? (
                         <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                      ) : (
                         <div className="w-full h-full flex items-center justify-center font-bold text-slate-400">
                           {contact.name ? contact.name.charAt(0).toUpperCase() : '?'}
                         </div>
                      )}
                    </div>
                    <span className="ml-3 font-medium text-slate-800 dark:text-slate-200">{contact.name}</span>
                  </button>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* AI Summary Modal */}
      <AnimatePresence>
        {showSummaryModal && aiSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pb-20 sm:pb-6">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
               onClick={() => { setShowSummaryModal(false); setAiSummary(null); }}
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 10 }}
               className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700"
             >
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700/50 bg-indigo-50/50 dark:bg-indigo-500/10">
                   <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                     <Sparkles className="w-5 h-5 text-indigo-500" />
                     AI Chat Summary
                   </h3>
                   <button onClick={() => { setShowSummaryModal(false); setAiSummary(null); }} className="p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                     <X className="w-5 h-5" />
                   </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 pb-8 space-y-6">
                   <div>
                     <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Synopsis</h4>
                     <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                       {aiSummary.summary}
                     </p>
                   </div>
                   {aiSummary.actionItems && aiSummary.actionItems.length > 0 && (
                     <div>
                       <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Key Takeaways & Actions</h4>
                       <ul className="space-y-2">
                         {aiSummary.actionItems.map((item, idx) => (
                           <li key={idx} className="flex items-start gap-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                              <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                              <span className="text-slate-700 dark:text-slate-300 text-sm">
                                {item}
                              </span>
                           </li>
                         ))}
                       </ul>
                     </div>
                   )}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
