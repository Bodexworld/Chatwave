import { useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { User } from '../data/mock';
import toast from 'react-hot-toast';

export function useNotifications(contacts: User[]) {
  const { user } = useAuth();
  const prevMessagesRef = useRef<Set<string>>(new Set());
  const prevCallsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  useEffect(() => {
    const requestPerm = () => {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    };
    
    document.addEventListener('click', requestPerm, { once: true });
    
    return () => {
      document.removeEventListener('click', requestPerm);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      limit(50) // prevent huge reads for notifications
    );

    const callsQ = query(
      collection(db, 'calls'),
      where('receiverId', '==', user.uid),
      limit(20) // prevent huge reads for notifications
    );

    const unsubscribeChats = onSnapshot(q, (snapshot) => {
      const unreadSum = snapshot.docs.reduce((acc, doc) => {
        const data = doc.data();
        return acc + (data.unreadCount?.[user.uid] || 0);
      }, 0);

      if (unreadSum > 0) {
        document.title = `(${unreadSum}) BChat`;
        if ('setAppBadge' in navigator) {
          (navigator as any).setAppBadge(unreadSum).catch(() => {});
        }
      } else {
        document.title = 'BChat';
        if ('clearAppBadge' in navigator) {
          (navigator as any).clearAppBadge().catch(() => {});
        }
      }

      if (initialLoadRef.current) {
        // Just populate the initial set to avoid notifying on first load
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.lastMessage?.id) {
            prevMessagesRef.current.add(data.lastMessage.id);
          }
        });
        return;
      }

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const lastMessage = data.lastMessage;
        
        if (lastMessage && lastMessage.id && !prevMessagesRef.current.has(lastMessage.id)) {
          prevMessagesRef.current.add(lastMessage.id);
          
          if (lastMessage.senderId !== user.uid) {
            // New message from someone else
            const sender = contacts.find(c => c.id === lastMessage.senderId);
            const senderName = sender ? sender.name : 'Someone';
            const shortPreview = lastMessage.content || (lastMessage.type === 'voice' ? 'Voice message' : lastMessage.type === 'image' ? 'Image message' : lastMessage.type === 'file' ? 'File' : 'New message');
            
            // In-app toast notification
            toast.success(`From ${senderName}: ${shortPreview}`, {
              icon: '💬',
              style: {
                borderRadius: '10px',
                background: '#333',
                color: '#fff',
              },
            });

            // Play custom notification tone
            try {
              const toneName = localStorage.getItem('bchat_notification_tone') || 'Default ringtone';
              if (toneName !== 'Default ringtone') {
                const storedTones = localStorage.getItem('bchat_custom_tones');
                const customTones: {name: string, url: string}[] = storedTones ? JSON.parse(storedTones) : [];
                const allTones = [
                  { name: 'Chime', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
                  { name: 'Bell', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
                  { name: 'Pop', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
                  ...customTones
                ];
                const tone = allTones.find(t => t.name === toneName);
                if (tone) {
                  const audio = new Audio(tone.url);
                  audio.play().catch(() => {}); // catch and ignore if browser blocks autoplay without user interaction
                }
              } else {
                 // default could just be a browser ping or small beep but typically browser notifications play their own
                 // We can inject a silent or default beep here if desired
              }
            } catch (e) {
              console.error('Failed to play tone', e);
            }

            if ('Notification' in window && Notification.permission === 'granted') {
              if (document.visibilityState === 'visible') return;
              new Notification(`New Message from ${senderName}`, {
                body: shortPreview,
              });
            }
          }
        }
      });
    }, (err) => {
      console.warn("Could not load chats, possibly due to quota exceeded", err);
    });

    const unsubscribeCalls = onSnapshot(callsQ, (snapshot) => {
      if (initialLoadRef.current) {
        snapshot.docs.forEach(doc => {
          prevCallsRef.current.add(doc.id + '_' + doc.data().status);
        });
        initialLoadRef.current = false;
        return;
      }

      snapshot.docs.forEach(doc => {
         const data = doc.data();
         const statusState = doc.id + '_' + data.status;

         if (!prevCallsRef.current.has(statusState)) {
            prevCallsRef.current.add(statusState);

            if (data.status === 'missed') {
               const msg = `You missed a ${data.type} call from ${data.callerName || 'Someone'}`;
               toast(msg, { icon: '📞' });
               if ('Notification' in window && Notification.permission === 'granted') {
                 new Notification('Missed Call', {
                   body: msg,
                 });
               }
            } else if (data.status === 'ringing') {
               if ('Notification' in window && Notification.permission === 'granted') {
                 new Notification('Incoming Call', {
                   body: `${data.callerName || 'Someone'} is calling you`,
                 });
               }
            }
         }
      });
    }, (err) => {
       console.warn("Could not load calls, possibly due to quota exceeded", err);
    });

    return () => {
       unsubscribeChats();
       unsubscribeCalls();
    };
  }, [user, contacts]);
}
