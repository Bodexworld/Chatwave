import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { User } from '../data/mock';
import { useAuth } from './AuthContext';

export function useContacts() {
  const { user } = useAuth();
  
  // Initialize from cache if possible
  const [contacts, setContacts] = useState<User[]>(() => {
    try {
      const cached = localStorage.getItem('bchat_cached_contacts');
      if (cached) return JSON.parse(cached);
    } catch(e) {}
    return [];
  });

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users'),
      limit(200) // Prevent fetching the entire database and killing quota
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: User[] = snapshot.docs.map(doc => {
         const data = doc.data();
         return {
           id: doc.id,
           name: data.name,
           email: data.email,
           avatar: data.avatar,
           status: 'Available', // mocked
           online: data.online,
           // @ts-ignore
           lastSeen: data.lastSeen?.toDate?.() || new Date()
         } as User;
      }).filter(u => u.id !== user.uid); // Exclude self
      
      setContacts(fetched);
      localStorage.setItem('bchat_cached_contacts', JSON.stringify(fetched));
      
    }, (err) => {
      console.warn("Could not load contacts:", err);
      // Usually caused by Quota Exceeded. We handle gracefully by using cached contacts.
      handleFirestoreError(err, OperationType.LIST, `users`);
    });

    return unsubscribe;
  }, [user]);

  return { contacts };
}
