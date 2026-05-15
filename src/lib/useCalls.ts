import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { User } from '../data/mock';

export type CallSession = {
  id: string;
  callerId: string;
  receiverId: string;
  type: 'voice' | 'video';
  status: 'calling' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed';
  createdAt: any;
  callerName?: string;
  callerAvatar?: string;
};

export function useCalls() {
  const { user } = useAuth();
  const [activeCallSession, setActiveCallSession] = useState<CallSession | null>(null);
  const [callHistory, setCallHistory] = useState<CallSession[]>([]);
  const [missedCallsCount, setMissedCallsCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setActiveCallSession(null);
      setCallHistory([]);
      setMissedCallsCount(0);
      return;
    }

    const callsRef = collection(db, 'calls');
    const q1 = query(callsRef, where('receiverId', '==', user.uid), limit(20));
    const q2 = query(callsRef, where('callerId', '==', user.uid), limit(20));
    
    let currentCallId: string | null = null;
    let history: Record<string, CallSession> = {};

    const handleSnapshot = (snapshot: any) => {
      snapshot.docChanges().forEach((change: any) => {
        const data = change.doc.data() as Omit<CallSession, 'id'>;
        const call: CallSession = { id: change.doc.id, ...data };
        
        // Update history
        if (change.type === 'removed') {
          delete history[call.id];
        } else {
          history[call.id] = call;
        }

        if (['calling', 'ringing', 'connected'].includes(call.status)) {
            currentCallId = call.id;
            setActiveCallSession(call);
        } else if (['ended', 'rejected', 'missed'].includes(call.status)) {
            if (currentCallId === call.id) {
                currentCallId = null;
                setActiveCallSession(null);
            }
        }
      });
      
      const sortedHistory = Object.values(history).sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      setCallHistory(sortedHistory);
      
      const lastViewed = parseInt(localStorage.getItem('lastViewedCalls') || '0');
      setMissedCallsCount(sortedHistory.filter(call => 
        call.receiverId === user.uid && 
        call.status === 'missed' && 
        (call.createdAt?.toMillis ? call.createdAt.toMillis() : 0) > lastViewed
      ).length);
    };

    const unsubscribeReceiver = onSnapshot(q1, handleSnapshot, (error) => {
      console.warn("Could not load calls as receiver, possibly due to quota exceeded", error);
      handleFirestoreError(error, OperationType.LIST, 'calls');
    });

    const unsubscribeCaller = onSnapshot(q2, handleSnapshot, (error) => {
      console.warn("Could not load calls as caller, possibly due to quota exceeded", error);
      handleFirestoreError(error, OperationType.LIST, 'calls');
    });

    return () => {
      unsubscribeReceiver();
      unsubscribeCaller();
    };
  }, [user]);

  const initiateCall = async (type: 'voice' | 'video', contact: User) => {
    if (!user) return null;
    try {
      const callRef = doc(collection(db, 'calls'));
      await setDoc(callRef, {
        callerId: user.uid,
        receiverId: contact.id,
        type,
        status: 'calling',
        createdAt: serverTimestamp(),
        callerName: user.displayName || 'Unknown',
        callerAvatar: user.photoURL || ''
      });
      return callRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'calls');
      return null;
    }
  };

  const updateCallStatus = async (callId: string, status: CallSession['status']) => {
    try {
      await updateDoc(doc(db, 'calls', callId), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'calls');
    }
  };

  const clearMissedCallsCount = () => {
    localStorage.setItem('lastViewedCalls', Date.now().toString());
    setMissedCallsCount(0);
  };

  return {
    activeCallSession,
    callHistory,
    missedCallsCount,
    clearMissedCallsCount,
    initiateCall,
    updateCallStatus
  };
}
