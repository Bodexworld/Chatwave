import { useState } from 'react';
import { Search, Plus, Phone, Video, UserPlus, MessageSquare, QrCode, Share2, ArrowLeft, Check, Users } from 'lucide-react';
import { User } from '../data/mock';
import { useContacts } from '../lib/useContacts';
import ContactInfoModal from './ContactInfoModal';

import { formatDistanceToNow } from 'date-fns';

type Props = {
  onSelectContact: (contact: User) => void;
  onStartCall: (type: 'voice' | 'video', contact: User) => void;
  onCreateGroup?: (name: string, members: User[]) => void;
  onBack?: () => void;
};

export default function Contacts({ onSelectContact, onStartCall, onCreateGroup, onBack }: Props) {
  const { contacts } = useContacts();
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [selectedContactInfo, setSelectedContactInfo] = useState<User | null>(null);

  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);

  const showTemporaryToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const filteredContacts = contacts.filter(contact => 
    contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleMember = (contact: User) => {
    if (selectedMembers.find(m => m.id === contact.id)) {
      setSelectedMembers(selectedMembers.filter(m => m.id !== contact.id));
    } else {
      setSelectedMembers([...selectedMembers, contact]);
    }
  };

  const handleCreateGroupClick = () => {
    if (onCreateGroup) {
      onCreateGroup(groupName || 'New Group', selectedMembers);
      setIsCreatingGroup(false);
      setGroupName('');
      setSelectedMembers([]);
    }
  };

  // Group by first letter
  const grouped = filteredContacts.reduce((acc, contact) => {
    const letter = contact.name?.[0]?.toUpperCase() || '#';
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(contact);
    return acc;
  }, {} as Record<string, User[]>);

  const letters = Object.keys(grouped).sort();

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0f172a] border-r border-slate-100 dark:border-slate-800/60 relative w-full z-10">
      {toast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-5 py-2.5 rounded-full text-sm font-semibold shadow-xl shadow-slate-500/20 animate-in fade-in slide-in-from-top-4 pointer-events-none whitespace-nowrap">
          {toast}
        </div>
      )}
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between transition-all">
        <div className="flex items-center">
          {(isCreatingGroup || onBack) && (
            <button onClick={() => {
              if (isCreatingGroup) {
                setIsCreatingGroup(false);
                setSelectedMembers([]);
                setGroupName('');
              } else if (onBack) {
                onBack();
              }
            }} className="mr-3 p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all text-slate-500 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {isCreatingGroup ? 'New Group' : 'Contacts'}
          </h1>
        </div>
        {!isCreatingGroup && (
          <button onClick={() => showTemporaryToast('Add contact feature coming soon!')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all text-slate-500 dark:text-slate-400 rounded-full bg-slate-50 dark:bg-slate-800/50 shadow-sm border border-slate-200 dark:border-slate-700/50">
            <Plus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </button>
        )}
      </div>

      {isCreatingGroup && (
        <div className="px-6 pb-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center flex-shrink-0 text-indigo-500 border border-indigo-200 dark:border-indigo-500/30">
                  <Users className="w-6 h-6" />
                </div>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Group Name" 
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="bg-transparent border-b-2 border-indigo-200 dark:border-slate-700 focus:border-indigo-500 outline-none w-full text-lg font-medium text-slate-800 dark:text-slate-100 px-1 py-2 transition-colors placeholder:text-slate-400"
                />
             </div>
             <div className="flex items-center justify-between mt-2">
               <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{selectedMembers.length} selected</span>
               <button 
                 onClick={handleCreateGroupClick}
                 disabled={selectedMembers.length === 0}
                 className="bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-xl font-semibold shadow-sm transition-all"
               >
                 Create Group
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-4 pb-4">
        <div className="flex-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl flex items-center px-4 py-2 opacity-90 target:opacity-100 transition-opacity focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white dark:focus-within:bg-slate-800 border border-transparent focus-within:border-indigo-500/30">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2" />
          <input 
            type="text" 
            placeholder="Search contacts"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-[15px] p-0.5 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 font-medium"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar">
        {!isCreatingGroup && (
          <>
            <button 
              onClick={() => setIsCreatingGroup(true)}
              className="w-full flex items-center px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-95 transition-all group"
            >
              <div className="w-12 h-12 rounded-[1.25rem] bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mr-4 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform shadow-sm">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-base font-semibold text-slate-900 dark:text-slate-100">New group</span>
            </button>

            <button 
              onClick={() => showTemporaryToast('Add by username feature coming soon!')}
              className="w-full flex items-center px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-95 transition-all group"
            >
              <div className="w-12 h-12 rounded-[1.25rem] overflow-hidden flex-shrink-0 mr-4 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:scale-105 transition-transform shadow-sm">
                <UserPlus className="w-5 h-5 text-indigo-500" />
              </div>
              <span className="text-base font-semibold text-slate-900 dark:text-slate-100">Add by username</span>
            </button>

            <button 
              onClick={() => showTemporaryToast('Scan QR code coming soon!')}
              className="w-full flex items-center px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-95 transition-all group"
            >
              <div className="w-12 h-12 rounded-[1.25rem] overflow-hidden flex-shrink-0 mr-4 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:scale-105 transition-transform shadow-sm">
                <QrCode className="w-5 h-5 text-indigo-500" />
              </div>
              <span className="text-base font-semibold text-slate-900 dark:text-slate-100">Scan QR Code</span>
            </button>

            <button 
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'Join me on Chatwave',
                    text: 'Connect with me on Chatwave, a secure messaging app!',
                    url: window.location.href,
                  }).catch(console.error);
                } else {
                  showTemporaryToast('Link copied to clipboard!');
                }
              }}
              className="w-full flex items-center px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:scale-95 group border-b border-slate-100 dark:border-slate-800/50 pb-4 mb-2"
            >
              <div className="w-12 h-12 rounded-[1.25rem] overflow-hidden flex-shrink-0 mr-4 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:scale-105 transition-transform shadow-sm">
                <Share2 className="w-5 h-5 text-indigo-500" />
              </div>
              <span className="text-base font-semibold text-slate-900 dark:text-slate-100">Invite friends</span>
            </button>
          </>
        )}

        {letters.map(letter => (
          <div key={letter} className="mb-2">
            <div className="px-6 py-1.5 text-indigo-600 dark:text-indigo-400 font-bold text-sm tracking-widest bg-slate-50 dark:bg-slate-800/20">{letter}</div>
            {grouped[letter].map(contact => {
              const isSelected = selectedMembers.find(m => m.id === contact.id);
              return (
                <button 
                  key={contact.id}
                  onClick={() => isCreatingGroup ? toggleMember(contact) : onSelectContact(contact)}
                  className={`w-full flex items-center px-6 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all hover:scale-[1.02] group cursor-pointer ${isCreatingGroup && isSelected ? 'bg-indigo-50/50 dark:bg-indigo-500/10' : ''}`}
                >
                  <div 
                    className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 mr-4 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg text-slate-500 font-bold uppercase transition-colors relative shadow-sm cursor-pointer z-10 ring-1 ring-slate-200 dark:ring-slate-700/50 hover:ring-indigo-500/50"
                    onClick={(e) => { 
                      if (!isCreatingGroup) {
                        e.stopPropagation(); 
                        setSelectedContactInfo(contact); 
                      }
                    }}
                  >
                    {contact.avatar ? (
                      <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <span>{contact.name ? contact.name.charAt(0) : '?'}</span>
                    )}
                    {!isCreatingGroup && contact.online && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full shadow-sm"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex items-center justify-between">
                    <div className="flex-1 min-w-0 flex flex-col items-start pt-1 pb-1">
                      <h3 className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">{contact.name}</h3>
                      <p className={`text-[13px] tracking-tight ${contact.online ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-500'}`}>
                        {contact.online ? 'Online' : (contact.lastSeen ? `Last seen ${formatDistanceToNow(contact.lastSeen, { addSuffix: true })}` : 'Offline')}
                      </p>
                    </div>
                    {isCreatingGroup ? (
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                        {isSelected && <Check className="w-4 h-4" />}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-0.5 pl-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div
                          onClick={(e) => { e.stopPropagation(); onSelectContact(contact); }}
                          className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                        >
                          <MessageSquare className="w-4.5 h-4.5" />
                        </div>
                        <div
                          onClick={(e) => { e.stopPropagation(); onStartCall('video', contact); }}
                          className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                        >
                          <Video className="w-4.5 h-4.5" />
                        </div>
                        <div 
                          onClick={(e) => { e.stopPropagation(); onStartCall('voice', contact); }}
                          className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                        >
                          <Phone className="w-4.5 h-4.5" />
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {selectedContactInfo && (
        <ContactInfoModal 
          contact={selectedContactInfo} 
          onClose={() => setSelectedContactInfo(null)} 
          onStartCall={onStartCall} 
        />
      )}
    </div>
  );
}
