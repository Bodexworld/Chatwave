import React, { useState, useRef, useEffect } from 'react';
import { Plus, MoreVertical, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { User as UserData } from '../data/mock';
import { doc, onSnapshot, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useStatuses, StatusUpdate } from '../lib/useStatuses';
import { formatDistanceToNow } from 'date-fns';

type Props = {
  onBack?: () => void;
};

export default function Status({ onBack }: Props = {}) {
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const { statuses, loading } = useStatuses();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewingStatus, setViewingStatus] = useState<StatusUpdate[] | null>(null);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docObj) => {
      if (docObj.exists()) {
        setUserData(docObj.data() as UserData);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Handle auto-advancing status viewer
  useEffect(() => {
    if (viewingStatus && viewingStatus.length > 0) {
      const timer = setTimeout(() => {
        if (currentStatusIndex < viewingStatus.length - 1) {
          setCurrentStatusIndex(prev => prev + 1);
        } else {
          setViewingStatus(null);
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [viewingStatus, currentStatusIndex]);

  const handleUploadStatus = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !userData) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        const MAX_DIM = 800;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        
        let quality = 0.7;
        let base64Str = canvas.toDataURL('image/jpeg', quality);
        
        // Ensure the base64 string is safely under 1,000,000 bytes (~750KB image)
        while (base64Str.length > 900000 && quality > 0.1) {
          quality -= 0.1;
          base64Str = canvas.toDataURL('image/jpeg', quality);
        }
        
        if (base64Str.length > 1000000) {
          alert('Image is too complex to compress for a status update. Please try a simpler image.');
          return;
        }
        
        try {
          await addDoc(collection(db, 'statuses'), {
            userId: user.uid,
            userName: userData.name || 'User',
            userAvatar: userData.avatar || '',
            imageUrl: base64Str,
            timestamp: serverTimestamp(),
            viewers: []
          });
        } catch (error) {
          console.error(error);
          handleFirestoreError(error, OperationType.CREATE, 'statuses');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  // Group statuses by user
  const userStatuses = statuses.reduce((acc, status) => {
    if (!acc[status.userId]) {
      acc[status.userId] = [];
    }
    acc[status.userId].push(status);
    return acc;
  }, {} as Record<string, StatusUpdate[]>);

  // Reverse so older statuses play first for a user
  (Object.values(userStatuses) as StatusUpdate[][]).forEach(list => list.reverse());

  const myStatuses = user && userStatuses[user.uid] ? userStatuses[user.uid] : [];
  const otherUsersStatuses: StatusUpdate[][] = Object.entries(userStatuses)
     .filter(([uid]) => !user || uid !== user.uid)
     .map(([uid, list]) => list as StatusUpdate[]);

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#111B21] relative">
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center">
          {onBack && (
            <button onClick={onBack} className="mr-3 p-2 -ml-2 lg:hidden hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all text-slate-500 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Status</h1>
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <button className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors p-2 rounded-full">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {/* My Status */}
          <div 
            className="w-full flex items-center px-2 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group mb-4 rounded-xl"
            onClick={() => {
              if (myStatuses.length > 0) {
                setViewingStatus(myStatuses);
                setCurrentStatusIndex(0);
              } else {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="relative mr-4">
              <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-lg text-slate-500 dark:text-slate-400 uppercase font-bold">
                {userData?.avatar ? (
                  <img src={userData.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span>{userData?.name ? userData.name.charAt(0) : '?'}</span>
                )}
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="absolute bottom-0 right-0 bg-indigo-500 text-white rounded-full p-0.5 border-2 border-white dark:border-[#111B21] hover:bg-indigo-600 transition-colors"
                title="Add status"
              >
                <Plus className="w-3 h-3" />
              </button>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleUploadStatus} />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">My status</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                {myStatuses.length > 0 ? `${myStatuses.length} updates` : 'Tap to add status update'}
              </p>
            </div>
          </div>

          {!loading && otherUsersStatuses.length === 0 && (
             <div className="text-center py-8 text-slate-500 dark:text-slate-400">
               No recent updates
             </div>
          )}

          {/* Recent Updates */}
          {otherUsersStatuses.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 px-2 py-1 uppercase tracking-wider mb-2">Recent updates</h2>
              {otherUsersStatuses.map(userStatusList => {
                const latestStatus = userStatusList[userStatusList.length - 1];
                return (
                  <div 
                    key={latestStatus.userId} 
                    onClick={() => { setViewingStatus(userStatusList); setCurrentStatusIndex(0); }}
                    className="w-full flex items-center px-2 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group rounded-xl"
                  >
                    <div className="w-12 h-12 rounded-full mr-4 p-0.5 bg-indigo-500">
                      <div className="w-full h-full rounded-full overflow-hidden border-2 border-white dark:border-[#111B21]">
                        {latestStatus.userAvatar ? (
                           <img src={latestStatus.userAvatar} alt={latestStatus.userName} className="w-full h-full object-cover" />
                        ) : (
                           <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-500 uppercase font-bold text-lg">
                             {latestStatus.userName.charAt(0)}
                           </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{latestStatus.userName}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                         {formatDistanceToNow(new Date(latestStatus.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {viewingStatus && viewingStatus[currentStatusIndex] && (
         <div className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* Progress Bars */}
            <div className="absolute top-0 left-0 right-0 p-4 flex gap-1 z-10">
               {viewingStatus.map((_, idx) => (
                  <div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                     <div 
                        className={`h-full bg-white transition-all`} 
                        style={{ 
                          width: idx < currentStatusIndex ? '100%' : (idx === currentStatusIndex ? '100%' : '0%'),
                          transitionDuration: idx === currentStatusIndex ? '5s' : '0s',
                          transitionTimingFunction: 'linear'
                        }}
                     />
                  </div>
               ))}
            </div>

            {/* Header */}
            <div className="absolute top-6 left-0 right-0 p-4 flex items-center justify-between z-10">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/50">
                     <img src={viewingStatus[currentStatusIndex].userAvatar} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{viewingStatus[currentStatusIndex].userName}</p>
                    <p className="text-white/70 text-xs">{formatDistanceToNow(new Date(viewingStatus[currentStatusIndex].timestamp), { addSuffix: true })}</p>
                  </div>
               </div>
               <button onClick={() => setViewingStatus(null)} className="text-white p-2 hover:bg-white/10 rounded-full transition-colors">
                 <X className="w-6 h-6" />
               </button>
            </div>

            {/* Click Areas */}
            <div className="flex-1 flex relative">
               <button 
                  className="w-1/3 h-full outline-none" 
                  onClick={() => {
                    if (currentStatusIndex > 0) setCurrentStatusIndex(prev => prev - 1);
                  }}
               />
               <button 
                  className="flex-1 h-full outline-none" 
                  onClick={() => {
                    if (currentStatusIndex < viewingStatus.length - 1) {
                      setCurrentStatusIndex(prev => prev + 1);
                    } else {
                      setViewingStatus(null);
                    }
                  }}
               />
               <img 
                 src={viewingStatus[currentStatusIndex].imageUrl} 
                 alt="Status" 
                 className="absolute inset-0 w-full h-full object-contain pointer-events-none" 
               />
            </div>
         </div>
      )}

    </div>
  );
}
