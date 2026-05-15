import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';

export interface StatusUpdate {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  imageUrl: string;
  timestamp: Date;
  viewers?: string[];
}

export function useStatuses() {
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<StatusUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  // Background cleanup process
  useEffect(() => {
    if (!user) return;
    const cleanupOldStatuses = async () => {
      try {
        const now = new Date();
        const cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const oldStatusesQuery = query(
          collection(db, 'statuses'),
          where('userId', '==', user.uid),
          where('timestamp', '<=', cutoffTime)
        );
        
        const snapshot = await getDocs(oldStatusesQuery);
        snapshot.forEach((docSnap) => {
          deleteDoc(doc(db, 'statuses', docSnap.id)).catch(console.error);
        });
      } catch (err) {
        console.error('Failed to cleanup old statuses:', err);
      }
    };
    
    // Run cleanup once on mount
    cleanupOldStatuses();
  }, [user]);

  useEffect(() => {
    const q = query(
      collection(db, 'statuses'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const statusesData: StatusUpdate[] = [];
      const now = new Date();
      // 24 hours ago
      const cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      snapshot.forEach((doc) => {
        const data = doc.data({ serverTimestamps: 'estimate' });
        const statusTime = data.timestamp?.toDate() || new Date();
        
        // Only keep statuses from the last 24 hours
        if (statusTime > cutoffTime) {
          statusesData.push({
            id: doc.id,
            userId: data.userId,
            userName: data.userName,
            userAvatar: data.userAvatar,
            imageUrl: data.imageUrl,
            timestamp: statusTime,
            viewers: data.viewers || [],
          });
        }
      });

      setStatuses(statusesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'statuses');
    });

    return () => unsubscribe();
  }, []);

  return { statuses, loading };
}
