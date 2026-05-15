import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, Timestamp, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Chat } from '../data/mock';
import { useAuth } from './AuthContext';

export function useChats() {
  const { user } = useAuth();
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      limit(50)
      // orderBy requires composite index if sorting with where. 
      // We will sort client-side to keep it simple initially.
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Chat[] = snapshot.docs.map(doc => {
         const data = doc.data();
         return {
           ...data,
           id: doc.id,
           type: data.type,
           participants: data.participants || [], // In a real app we'd fetch user profiles for these IDs, or mock them
           unreadCount: data.unreadCount?.[user.uid] || 0,
           unreadCountMap: data.unreadCount || {},
           typing: data.typing || {},
           name: data.name,
           avatar: data.avatar,
           status: data.status,
           requestedBy: data.requestedBy,
         } as unknown as Chat;
      });

      // Sort client side
      fetched.sort((a, b) => {
         const timeA = (a as any).updatedAt?.toMillis?.() || 0;
         const timeB = (b as any).updatedAt?.toMillis?.() || 0;
         return timeB - timeA;
      });

      setChats(fetched);
      setLoading(false);
    }, (err) => {
      console.warn("Could not load chats, possibly due to quota exceeded", err);
      setLoading(false);
      handleFirestoreError(err, OperationType.LIST, 'chats');
    });

    return unsubscribe;
  }, [user]);

  return { chats, loading };
}
