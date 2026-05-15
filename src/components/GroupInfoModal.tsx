import React, { useState } from 'react';
import { User, Chat } from '../data/mock';
import { X, Users, Image as ImageIcon, Search, Shield, UserX, Trash2, LogOut, MoreVertical, ShieldAlert } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';

interface Props {
  chat: Chat;
  contacts: User[];
  onClose: () => void;
  currentUser?: any;
}

export default function GroupInfoModal({ chat, contacts, onClose, currentUser }: Props) {
  // We don't have detailed presence for groups trivially, but we can list participants
  const members = chat.participants.map(pId => {
    const p = typeof pId === 'string' ? pId : pId.id;
    return contacts.find(c => c.id === p) || { id: p, name: 'Unknown User' } as User;
  });

  const currentUserUid = currentUser?.uid;
  const isAdmin = chat.admins?.includes(currentUserUid);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(chat.name || '');
  const [editAvatar, setEditAvatar] = useState(chat.avatar || '');

  const handleSaveDetails = async () => {
    if (!isAdmin || !chat.id) return;
    setLoadingAction('save');
    try {
      await updateDoc(doc(db, 'chats', chat.id), {
        name: editName,
        avatar: editAvatar
      });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'chats');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleLeaveGroup = async () => {
    if (!currentUserUid || !chat.id) return;
    setLoadingAction('leave');
    try {
      const newParticipants = chat.participants.filter(p => {
        const id = typeof p === 'string' ? p : p.id;
        return id !== currentUserUid;
      }).map(p => typeof p === 'string' ? p : p.id);
      
      const newAdmins = (chat.admins || []).filter(id => id !== currentUserUid);

      await updateDoc(doc(db, 'chats', chat.id), {
        participants: newParticipants,
        admins: newAdmins
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'chats');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteGroup = async () => {
    if (!isAdmin || !chat.id) return;
    if (!confirm('Are you sure you want to delete this group?')) return;
    setLoadingAction('delete');
    try {
      await deleteDoc(doc(db, 'chats', chat.id));
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'chats');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!isAdmin || !chat.id) return;
    if (memberId === currentUserUid) return;
    if (!confirm('Remove member?')) return;
    try {
      const newParticipants = chat.participants.filter(p => {
        const id = typeof p === 'string' ? p : p.id;
        return id !== memberId;
      }).map(p => typeof p === 'string' ? p : p.id);
      
      const newAdmins = (chat.admins || []).filter(id => id !== memberId);

      await updateDoc(doc(db, 'chats', chat.id), {
        participants: newParticipants,
        admins: newAdmins
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'chats');
    }
  };

  const handleMakeAdmin = async (memberId: string) => {
    if (!isAdmin || !chat.id) return;
    if (memberId === currentUserUid) return;
    try {
      const admins = chat.admins || [];
      if (!admins.includes(memberId)) {
        await updateDoc(doc(db, 'chats', chat.id), {
          admins: [...admins, memberId]
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'chats');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pb-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onClose}
      />
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl relative z-10 animate-in zoom-in-95 fade-in duration-300 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">Group Info</h2>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar flex-1 pb-6">
          {/* Profile Basic Info */}
          <div className="flex flex-col items-center pt-8 pb-6 px-6 relative">
            {isAdmin && !isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="absolute top-4 right-4 text-sm text-indigo-600 font-medium hover:text-indigo-700 dark:hover:text-indigo-400 p-2"
              >
                Edit
              </button>
            )}
            
            <div className="w-32 h-32 rounded-[2rem] overflow-hidden mb-4 shadow-xl shadow-slate-200 dark:shadow-slate-900/50 outline outline-4 outline-offset-4 outline-transparent hover:outline-indigo-500/20 transition-all cursor-pointer bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-4xl text-indigo-500 font-bold uppercase ring-2 ring-transparent group-hover:ring-indigo-500/30">
              {chat.avatar ? (
                <img src={chat.avatar} alt={chat.name || 'Group'} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
              ) : (
                <span>{chat.name ? chat.name.charAt(0) : '?'}</span>
              )}
            </div>

            {isEditing ? (
              <div className="w-full space-y-4 px-2 mt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Group Name</label>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Avatar URL</label>
                  <input 
                    type="text" 
                    value={editAvatar}
                    onChange={(e) => setEditAvatar(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://..."
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-2 text-sm font-medium text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveDetails}
                    disabled={loadingAction === 'save'}
                    className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loadingAction === 'save' ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1 text-center truncate w-full px-4">{chat.name}</h1>
                <p className="text-sm font-medium text-slate-500 mb-2">
                  Group • {members.length} members
                </p>
              </>
            )}
          </div>

          <div className="h-2 bg-slate-50 dark:bg-slate-950 w-full" />

          {/* Members List */}
          <div className="px-0 py-2">
            <div className="px-6 py-3 flex items-center justify-between text-slate-500 font-semibold mb-1">
               <span className="text-xs uppercase tracking-wider text-slate-400">Members</span>
               <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <Search className="w-4 h-4" />
               </button>
            </div>
            
            <div className="flex flex-col">
              {members.map(member => {
                 const isMemberAdmin = chat.admins?.includes(member.id);
                 const isMe = member.id === currentUserUid;

                 return (
                 <div key={member.id} className="flex items-center px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                   <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 mr-3 bg-slate-100 dark:bg-slate-800 flex items-center justify-center uppercase text-slate-500 font-bold">
                     {member.avatar ? (
                       <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                     ) : (
                       <span>{member.name?.charAt(0) || '?'}</span>
                     )}
                   </div>
                   <div className="flex-1 min-w-0 pr-2">
                     <div className="flex items-center gap-2">
                       <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                         {member.name} {isMe ? '(You)' : ''}
                       </span>
                       {isMemberAdmin && (
                         <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                           <Shield className="w-3 h-3" />
                           Admin
                         </span>
                       )}
                     </div>
                     <div className="text-xs text-slate-500 truncate">{member.status || 'Available'}</div>
                   </div>
                   
                   {isAdmin && !isMe && (
                     <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       {!isMemberAdmin && (
                         <button 
                           onClick={() => handleMakeAdmin(member.id)}
                           className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-lg transition-colors"
                           title="Make admin"
                         >
                           <ShieldAlert className="w-4 h-4" />
                         </button>
                       )}
                       <button 
                         onClick={() => handleRemoveMember(member.id)}
                         className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                         title="Remove from group"
                       >
                         <UserX className="w-4 h-4" />
                       </button>
                     </div>
                   )}
                 </div>
               )})}
            </div>
          </div>
          
          {/* Actions */}
          <div className="px-6 py-4 mt-2 space-y-2">
             <button 
               onClick={handleLeaveGroup}
               disabled={loadingAction === 'leave'}
               className="w-full flex items-center gap-3 px-4 py-3 text-red-500 dark:text-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 rounded-xl transition-colors font-medium disabled:opacity-50"
             >
               <LogOut className="w-5 h-5" />
               {loadingAction === 'leave' ? 'Leaving...' : 'Leave Group'}
             </button>

             {isAdmin && (
               <button 
                 onClick={handleDeleteGroup}
                 disabled={loadingAction === 'delete'}
                 className="w-full flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 rounded-xl transition-colors font-medium disabled:opacity-50"
               >
                 <Trash2 className="w-5 h-5" />
                 {loadingAction === 'delete' ? 'Deleting...' : 'Delete Group'}
               </button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
