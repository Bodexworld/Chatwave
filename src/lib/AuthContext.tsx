import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User as FirebaseUser, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db, messaging, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  logOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const isOnlineRef = useRef(true);
  const lastActiveRef = useRef(Date.now());
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    let tabCloseHandler: (() => void) | null = null;
    
    // User presence updater
    const updatePresence = async (isOnline: boolean) => {
       if (!auth.currentUser) return;
       const userRef = doc(db, 'users', auth.currentUser.uid);
       try {
          await setDoc(userRef, { 
             online: isOnline, 
             lastSeen: serverTimestamp() 
          }, { merge: true });
       } catch (e) {
          // Silent catch for background updates
       }
    };

    let lastEventTime = 0;
    const EVENT_THROTTLE = 1000;

    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastEventTime < EVENT_THROTTLE) return;
      lastEventTime = now;
      
      lastActiveRef.current = now;
      if (!isOnlineRef.current) {
         isOnlineRef.current = true;
         updatePresence(true);
      }
      
      // Reset inactivity timer
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
         isOnlineRef.current = false;
         updatePresence(false);
      }, INACTIVITY_TIMEOUT);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleUserActivity();
      } else {
        if (isOnlineRef.current) {
           isOnlineRef.current = false;
           updatePresence(false);
           if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        }
      }
    };

    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      setLoading(false); // Make sure the app renders immediately, don't wait for slow DB!
      
      if (currentUser) {
        try {
           const userRef = doc(db, 'users', currentUser.uid);
           const userDoc = await getDoc(userRef);
           
           if (!userDoc.exists()) {
              await setDoc(userRef, {
                 id: currentUser.uid,
                 name: currentUser.email?.split('@')[0] || 'User',
                 email: currentUser.email || '',
                 avatar: currentUser.photoURL || '',
                 online: true,
                 lastSeen: serverTimestamp(),
              });
           } else {
              isOnlineRef.current = true;
              await setDoc(userRef, {
                 online: true,
                 lastSeen: serverTimestamp()
              }, { merge: true });
           }
           
           // Activity listeners
           window.addEventListener('mousemove', handleUserActivity);
           window.addEventListener('keydown', handleUserActivity);
           window.addEventListener('touchstart', handleUserActivity);
           document.addEventListener('visibilitychange', handleVisibilityChange);
           
           // Fetch FCM Token
           if (messaging && 'Notification' in window && Notification.permission === 'granted') {
              try {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg) {
                  const token = await getToken(messaging, { serviceWorkerRegistration: reg });
                  if (token) {
                    await setDoc(userRef, { fcmToken: token }, { merge: true });
                  }
                }
              } catch (e) {
                console.error('Failed to get FCM token', e);
              }
           }
           
           // Initial timer start
           if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
           inactivityTimerRef.current = setTimeout(() => {
              isOnlineRef.current = false;
              updatePresence(false);
           }, INACTIVITY_TIMEOUT);
           
           tabCloseHandler = () => {
             // We can't guarantee this works reliably in all browsers, but it's a best-effort
             try {
               setDoc(userRef, { online: false, lastSeen: serverTimestamp() }, { merge: true });
             } catch(e) {}
           };
           window.addEventListener('beforeunload', tabCloseHandler);
        } catch (error) {
           console.error("Initialization / Presence error:", error);
        }
      } else {
        if (tabCloseHandler) {
          window.removeEventListener('beforeunload', tabCloseHandler);
          tabCloseHandler = null;
        }
        window.removeEventListener('mousemove', handleUserActivity);
        window.removeEventListener('keydown', handleUserActivity);
        window.removeEventListener('touchstart', handleUserActivity);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (tabCloseHandler) {
        window.removeEventListener('beforeunload', tabCloseHandler);
      }
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Error signing in', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
         id: userCredential.user.uid,
         name: name || userCredential.user.email?.split('@')[0] || 'User',
         email: userCredential.user.email || '',
         avatar: userCredential.user.photoURL || '',
         online: true,
         lastSeen: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error signing up', error);
      throw error;
    }
  };

  const logOut = async () => {
    if (user) {
      try {
         await setDoc(doc(db, 'users', user.uid), {
            online: false,
            lastSeen: serverTimestamp()
         }, { merge: true });
      } catch (error) {
         console.error('Failed to update offline status', error);
      }
    }
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithEmail, signUpWithEmail, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}
