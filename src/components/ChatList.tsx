import React from 'react';
import { Search, Plus, MoreVertical, Filter, Pin, MessageSquare, Archive } from 'lucide-react';
import { format } from 'date-fns';
import { Chat } from '../data/mock';
import { useChats } from '../lib/useChats';
import { useContacts } from '../lib/useContacts';
import { useAuth } from '../lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

type Props = {
  activeChat: Chat | null;
  onSelectChat: (chat: Chat) => void;
  onShowContacts: () => void;
};

export default function ChatList({ activeChat, onSelectChat, onShowContacts }: Props) {
  const { chats, loading } = useChats();
  const { contacts } = useContacts();
  const { user } = useAuth();
  
  // Sort chats: Pinned first, then by latest message
  const sortedChats = [...chats].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    
    // Fall back to message timestamp or updatedAt
    const getTimestamp = (chat: Chat) => {
      if ((chat as any).updatedAt?.toMillis) return (chat as any).updatedAt.toMillis();
      if ((chat as any).updatedAt?.getTime) return (chat as any).updatedAt.getTime();
      if ((chat.lastMessage?.timestamp as any)?.toDate) return (chat.lastMessage?.timestamp as any).toDate().getTime();
      if ((chat.lastMessage?.timestamp as any)?.getTime) return (chat.lastMessage?.timestamp as any).getTime();
      return (chat.unreadCount || 0); 
    };
    
    const aTime = getTimestamp(a);
    const bTime = getTimestamp(b);
    
    if (aTime === bTime) {
      return a.unreadCount > 0 ? -1 : (b.unreadCount > 0 ? 1 : 0);
    }
    
    return bTime - aTime;
  });

  const togglePin = async (e: React.MouseEvent, chat: Chat) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'chats', chat.id), {
        isPinned: !chat.isPinned
      });
    } catch {}
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0f172a] border-r border-slate-100 dark:border-slate-800/60 z-10 w-full relative">
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 tracking-tight">Chats</h1>
        <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
          <button onClick={onShowContacts} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all rounded-full bg-slate-50 dark:bg-slate-800/50 shadow-sm border border-slate-200 dark:border-slate-700/50">
            <Plus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </button>
          <button onClick={() => alert('Options menu coming soon!')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all rounded-full">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-4 flex items-center gap-2">
        <div className="flex-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl flex items-center px-4 py-2 opacity-90 target:opacity-100 transition-opacity focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white dark:focus-within:bg-slate-800 border border-transparent focus-within:border-indigo-500/30">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2" />
          <input 
            type="text" 
            placeholder="Search messages..."
            className="bg-transparent border-none outline-none w-full text-[15px] p-0.5 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 font-medium"
          />
        </div>
        <button onClick={() => alert('Filter coming soon!')} className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all rounded-xl">
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar relative">
        {loading && <div className="text-center py-4 text-slate-500">Loading chats...</div>}
        {!loading && sortedChats.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center h-full">
            <div className="mx-auto w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 text-indigo-500 shadow-sm">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">No active chats</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 max-w-[200px] leading-relaxed">
              Start a new conversation with your contacts.
            </p>
            <button 
              onClick={onShowContacts}
              className="bg-indigo-600 text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-indigo-500 active:scale-95 transition-all shadow-md shadow-indigo-500/20"
            >
              Start Chatting
            </button>
          </div>
        )}
        <AnimatePresence initial={false}>
        {sortedChats.map(chat => {
          const isGroup = chat.type === 'group';
          
          let otherUserId: string | null = null;
          chat.participants.forEach((p: any) => {
            const pId = typeof p === 'string' ? p : p.id;
            if (pId && pId !== user?.uid) {
              otherUserId = pId;
            }
          });
          
          const otherUser = contacts.find(c => c.id === otherUserId);
          const nameInfo = isGroup ? chat.name : (otherUser?.name || 'Unknown');
          const avatarInfo = isGroup ? chat.avatar : otherUser?.avatar;
          const name = nameInfo;
          const avatar = avatarInfo;
          const lastMsg = chat.lastMessage;
          const isActive = activeChat?.id === chat.id;

          const typingUsers = Object.entries(chat.typing || {})
            .filter(([uid, isTyping]) => isTyping && uid !== user?.uid)
            .map(([uid]) => contacts.find(c => c.id === uid)?.name?.split(' ')[0] || 'Someone');
          const isTyping = typingUsers.length > 0;
          const typingLabel = isGroup ? `${typingUsers.join(', ')} typing...` : 'typing...';

          return (
            <motion.div 
              layout
              key={chat.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative w-full border-b border-slate-100 dark:border-slate-800/50 last:border-none group overflow-hidden bg-slate-100 dark:bg-slate-800/80"
            >
              {/* Swipe Background Actions */}
              <div className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none">
                 <div className="flex items-center text-indigo-500 font-medium">
                   <Pin className="w-5 h-5 mr-3" />
                   Pin
                 </div>
                 <div className="flex items-center text-rose-500 font-medium">
                   Archive
                   <Archive className="w-5 h-5 ml-3" />
                 </div>
              </div>

              {/* Foreground Swipeable Content */}
              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.4}
                onDragEnd={(e, info) => {
                   if (info.offset.x > 80) {
                      togglePin(e as any, chat);
                   } else if (info.offset.x < -80) {
                      // Archive not fully implemented, just visual for now
                      alert('Archive action triggered');
                   }
                }}
                className="relative bg-white dark:bg-[#0f172a] z-10 w-full"
              >
                <div 
                  onClick={() => onSelectChat(chat)}
                  className={`w-full flex items-center px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${isActive ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''}`}
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 mr-4 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg text-slate-500 dark:text-slate-400 uppercase font-bold relative ring-1 ring-slate-200 dark:ring-slate-700/50">
                    {avatar ? (
                      <img src={avatar} alt={name || "#"} className="w-full h-full object-cover" />
                    ) : (
                      <span>{name ? name.charAt(0) : '?'}</span>
                    )}
                    {!isGroup && otherUser?.online && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full shadow-sm"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 py-1">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className={`text-[16px] font-semibold truncate ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-100'}`}>{name}</h3>
                      {lastMsg && !isTyping && (
                        <span className={`text-[11px] font-medium flex-shrink-0 ml-2 ${chat.unreadCount > 0 ? 'text-emerald-500 dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                          {format((() => {
                            const ts = lastMsg.timestamp as any;
                            if (!ts) return new Date();
                            if (ts.toDate) return ts.toDate();
                            if (ts instanceof Date) return ts;
                            if (typeof ts === 'number' || typeof ts === 'string') {
                              const d = new Date(ts);
                              return isNaN(d.getTime()) ? new Date() : d;
                            }
                            return new Date();
                          })(), 'h:mm a').toLowerCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-[13px]">
                      <div className="flex items-center flex-1 min-w-0 pr-2">
                        {isTyping ? (
                          <p className="text-indigo-500 font-medium truncate text-left">{typingLabel}</p>
                        ) : chat.status === 'pending' ? (
                          <p className={`truncate text-left italic ${isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 font-medium'}`}>
                            {chat.requestedBy === user?.uid ? 'Request Sent' : 'Chat Request'}
                          </p>
                        ) : (
                          <p className={`truncate text-left ${isActive ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-500 dark:text-slate-400 font-medium'}`}>
                            {lastMsg?.type === 'voice' ? '🎤 Voice message' : lastMsg?.type === 'image' ? '📷 Photo' : lastMsg?.type === 'file' ? `📎 ${lastMsg.fileName}` : lastMsg?.content}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center flex-shrink-0 space-x-2 ml-2">
                        {chat.isPinned && (
                          <Pin className="w-3.5 h-3.5 text-slate-400 transition-transform group-hover:-rotate-45" strokeWidth={2.5} fill="currentColor" />
                        )}
                        {chat.unreadCount > 0 && (
                          <span className="bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white text-[10px] font-bold px-1.5 min-w-[20px] h-[20px] rounded-full flex items-center justify-center shadow-sm">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )
        })}
        </AnimatePresence>
      </div>
    </div>
  );
}
