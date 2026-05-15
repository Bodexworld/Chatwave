import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Message } from '../data/mock';
import { useAuth } from './AuthContext';

export function useMessages(chatId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !chatId) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Message[] = snapshot.docs.map(doc => {
         const data = doc.data();
         return {
           id: doc.id,
           chatId: data.chatId,
           senderId: data.senderId,
           content: data.content,
           type: data.type,
           status: data.status,
           mediaUrl: data.mediaUrl,
           fileUrl: data.fileUrl,
           // @ts-ignore
           timestamp: data.timestamp?.toDate() || new Date(),
         } as Message;
      });
      setMessages(fetched);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `chats/${chatId}/messages`);
    });

    return unsubscribe;
  }, [user, chatId]);

  return { messages, loading };
}
