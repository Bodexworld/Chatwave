import { Bell, Key, Lock, HelpCircle, Sun, Moon, Image as ImageIcon, MessageSquare, Database, Laptop, Camera, ArrowLeft, Briefcase, Store, MessageCircle, Tag, Clock, LogOut } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User as UserData } from '../data/mock';

type ViewState = 'main' | 'profile' | 'account' | 'privacy' | 'chats' | 'notifications' | 'storage' | 'shortcuts' | 'help' | 'business' | 'notification_tone';

type Props = {
  onBack?: () => void;
};

export default function Settings({ onBack }: Props = {}) {
  const isDark = document.documentElement.classList.contains('dark');
  const { user, logOut } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toneFileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('main');
  const [editingField, setEditingField] = useState<'name' | 'status' | null>(null);
  const [editValue, setEditValue] = useState('');

  const [notificationTone, setNotificationTone] = useState(() => {
    return localStorage.getItem('bchat_notification_tone') || 'Default ringtone';
  });
  const [customTones, setCustomTones] = useState<{name: string, url: string}[]>(() => {
    try {
      const stored = localStorage.getItem('bchat_custom_tones');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const allTones = [
    { name: 'Default ringtone', url: 'default' },
    { name: 'Chime', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { name: 'Bell', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
    { name: 'Pop', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
    ...customTones
  ];

  const showTemporaryToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const renderToast = () => toast && (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-5 py-2.5 rounded-full text-sm font-semibold shadow-xl shadow-slate-500/20 animate-in fade-in slide-in-from-top-4 pointer-events-none whitespace-nowrap">
      {toast}
    </div>
  );

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docObj) => {
      if (docObj.exists()) {
        setUserData(docObj.data() as UserData);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });
    return () => unsubscribe();
  }, [user]);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxSize = 200;
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxSize) {
            height = Math.round(height * (maxSize / width));
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round(width * (maxSize / height));
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

          try {
            await updateDoc(doc(db, 'users', user.uid), {
              avatar: dataUrl
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, 'users');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveField = async () => {
    if (!user || !editingField) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        [editingField]: editValue
      });
      showTemporaryToast(`${editingField === 'name' ? 'Name' : 'About'} updated successfully`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setEditingField(null);
    }
  };

  const playTone = (url: string) => {
    if (url === 'default') {
      showTemporaryToast('Default system tone...');
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = url;
      audioRef.current.play().catch(() => showTemporaryToast('Failed to play tone'));
    }
  };

  const handleSelectTone = (tone: {name: string, url: string}) => {
    setNotificationTone(tone.name);
    localStorage.setItem('bchat_notification_tone', tone.name);
    playTone(tone.url);
  };

  const handleToneUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showTemporaryToast('File is too large. Max 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const newTone = { name: file.name.split('.')[0], url: result };
      setCustomTones(prev => {
        const next = [...prev, newTone];
        try {
          localStorage.setItem('bchat_custom_tones', JSON.stringify(next));
        } catch (e) {
          showTemporaryToast('Tone file might be too large to save.');
        }
        return next;
      });
      handleSelectTone(newTone);
      showTemporaryToast(`Added new tone: ${newTone.name}`);
    };
    reader.readAsDataURL(file);
  };

  const renderHeader = (title: string) => (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl h-16 flex items-center px-6 shrink-0 border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center">
        <button onClick={() => setCurrentView('main')} className="mr-4 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-full transition-colors active:scale-95 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{title}</h1>
      </div>
    </div>
  );

  if (currentView === 'profile') {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative animate-in slide-in-from-right-full duration-200">
        {renderToast()}
        {renderHeader('Profile')}
        <div className="flex-1 overflow-y-auto pb-4">
          <div className="flex justify-center py-8">
            <div className="w-[180px] h-[180px] rounded-full overflow-hidden shadow-sm relative group cursor-pointer bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 uppercase font-bold text-6xl outline outline-4 outline-offset-4 outline-transparent hover:outline-indigo-500/20 transition-all" onClick={() => fileInputRef.current?.click()}>
              {userData?.avatar ? (
                <img src={userData.avatar} alt="Me" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <span>{userData?.name ? userData.name.charAt(0) : '?'}</span>
              )}
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-8 h-8 text-white mb-2" />
                <span className="text-xs text-white font-semibold uppercase tracking-widest text-center px-4">Change Photo</span>
              </div>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleAvatarChange} />
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800/50 mx-4 rounded-2xl px-6 py-4 mb-3 shadow-sm transition-all border border-slate-100 dark:border-slate-800 group">
            <h3 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-2 uppercase tracking-widest group-hover:text-indigo-500 transition-colors">Your name</h3>
            {editingField === 'name' ? (
              <div className="flex items-center mt-1">
                 <input 
                   autoFocus
                   type="text" 
                   value={editValue} 
                   onChange={(e) => setEditValue(e.target.value)} 
                   className="flex-1 bg-transparent border-b-2 border-indigo-500 text-lg font-medium outline-none text-slate-900 dark:text-slate-100 pb-1"
                 />
                 <button onClick={handleSaveField} className="ml-2 bg-indigo-500 text-white p-1.5 rounded-lg hover:bg-indigo-600 transition-colors">Save</button>
                 <button onClick={() => setEditingField(null)} className="ml-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 p-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Cancel</button>
              </div>
            ) : (
              <div className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1 flex justify-between items-center cursor-pointer group" onClick={() => { setEditValue(userData?.name || ''); setEditingField('name'); }}>
                <span>{userData?.name || 'User'}</span>
                <span className="text-sm text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
              </div>
            )}
            <p className="text-sm text-slate-500 mt-2">This is not your username or pin. This name will be visible to your contacts.</p>
          </div>

          <div className="bg-white dark:bg-slate-800/50 mx-4 rounded-2xl px-6 py-4 shadow-sm transition-all border border-slate-100 dark:border-slate-800 group">
            <h3 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-2 uppercase tracking-widest group-hover:text-indigo-500 transition-colors">About</h3>
            {editingField === 'status' ? (
              <div className="flex items-center mt-1">
                 <input 
                   autoFocus
                   type="text" 
                   value={editValue} 
                   onChange={(e) => setEditValue(e.target.value)} 
                   className="flex-1 bg-transparent border-b-2 border-indigo-500 text-lg font-medium outline-none text-slate-900 dark:text-slate-100 pb-1"
                 />
                 <button onClick={handleSaveField} className="ml-2 bg-indigo-500 text-white p-1.5 rounded-lg hover:bg-indigo-600 transition-colors">Save</button>
                 <button onClick={() => setEditingField(null)} className="ml-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 p-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Cancel</button>
              </div>
            ) : (
              <div className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1 flex justify-between items-center cursor-pointer group" onClick={() => { setEditValue(userData?.status || ''); setEditingField('status'); }}>
                <span>{userData?.status || 'Available'}</span>
                <span className="text-sm text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'account') {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900 relative animate-in slide-in-from-right-full duration-200">
        {renderToast()}
        {renderHeader('Account')}
        <div className="flex-1 overflow-y-auto">
          <SettingItem icon={Key} label="Security notifications" hideBottomBorder onClick={() => showTemporaryToast('Security notifications')} />
          <SettingItem icon={Lock} label="Two-step verification" hideBottomBorder onClick={() => showTemporaryToast('Two-step verification')} />
          <SettingItem icon={Laptop} label="Change number" hideBottomBorder onClick={() => showTemporaryToast('Change number feature')} />
          <SettingItem icon={HelpCircle} label="Request account info" hideBottomBorder onClick={() => showTemporaryToast('Request info data')} />
          <SettingItem icon={Database} label="Delete my account" hideBottomBorder onClick={() => showTemporaryToast('Delete account confirmation')} />
        </div>
      </div>
    );
  }

  if (currentView === 'privacy') {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative animate-in slide-in-from-right-full duration-200">
        {renderToast()}
        {renderHeader('Privacy')}
        <div className="flex-1 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800/50 m-4 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <h3 className="px-6 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800">Who can see my personal info</h3>
            <SettingItem icon={() => null} label="Last seen and online" subtitle="Nobody" hideBottomBorder onClick={() => showTemporaryToast('Change Last Seen privacy')} />
            <SettingItem icon={() => null} label="Profile photo" subtitle="Everyone" hideBottomBorder onClick={() => showTemporaryToast('Change Profile Photo privacy')} />
            <SettingItem icon={() => null} label="About" subtitle="Everyone" hideBottomBorder onClick={() => showTemporaryToast('Change About privacy')} />
            <SettingItem icon={() => null} label="Status" subtitle="My contacts" hideBottomBorder onClick={() => showTemporaryToast('Change Status privacy')} />
            <SettingItem icon={() => null} label="Read receipts" subtitle="If turned off, you won't send or receive Read receipts." hideBottomBorder onClick={() => showTemporaryToast('Toggle Read Receipts')} />
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'chats') {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative animate-in slide-in-from-right-full duration-200">
        {renderToast()}
        {renderHeader('Chats')}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <h3 className="px-6 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800">Display</h3>
            <div className="py-2 px-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group" onClick={() => { toggleTheme(); showTemporaryToast(isDark ? 'Light theme applied' : 'Dark theme applied'); }}>
              <div className="flex items-center py-2">
                <div className="flex-1">
                  <span className="text-base text-slate-900 dark:text-slate-100 font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Theme</span>
                  <p className="text-sm text-slate-500">{isDark ? 'Dark' : 'Light'}</p>
                </div>
              </div>
            </div>
            <SettingItem icon={() => null} label="Wallpaper" subtitle="Change chat wallpaper" hideBottomBorder onClick={() => showTemporaryToast('Open Wallpaper selector')} />
          </div>
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <h3 className="px-6 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800">Chat settings</h3>
            <SettingItem icon={() => null} label="Enter is send" subtitle="Enter key will send your message" hideBottomBorder onClick={() => showTemporaryToast('Toggle Enter behavior')} />
            <SettingItem icon={() => null} label="Media visibility" subtitle="Show newly downloaded media in your device's gallery" hideBottomBorder onClick={() => showTemporaryToast('Toggle Media visibility')} />
            <SettingItem icon={() => null} label="Font size" subtitle="Medium" hideBottomBorder onClick={() => showTemporaryToast('Change Font size')} />
          </div>
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 py-1 overflow-hidden">
            <SettingItem icon={() => null} label="Chat backup" subtitle="Last backup: yesterday" hideBottomBorder onClick={() => showTemporaryToast('Open Chat backup')} />
            <SettingItem icon={() => null} label="Chat history" hideBottomBorder onClick={() => showTemporaryToast('Manage Chat history')} />
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'notifications') {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative animate-in slide-in-from-right-full duration-200">
        {renderToast()}
        {renderHeader('Notifications')}
        <div className="flex-1 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800/50 m-4 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <h3 className="px-6 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800">Messages</h3>
            <SettingItem icon={() => null} label="Notification tone" subtitle={notificationTone} hideBottomBorder onClick={() => setCurrentView('notification_tone')} />
            <SettingItem icon={() => null} label="Vibrate" subtitle="Default" hideBottomBorder onClick={() => showTemporaryToast('Change Vibrate settings')} />
            <SettingItem icon={() => null} label="Reaction Notifications" subtitle="Show notifications for reactions to messages you send" hideBottomBorder onClick={() => showTemporaryToast('Toggle Reaction Notifications')} />
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'notification_tone') {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative animate-in slide-in-from-right-full duration-200">
        {renderToast()}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl h-16 flex items-center px-6 shrink-0 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center">
            <button onClick={() => setCurrentView('notifications')} className="mr-4 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-full transition-colors active:scale-95 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Notification tone</h1>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden mb-4 py-2">
            {allTones.map((tone, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => handleSelectTone(tone)}
              >
                <span className="text-slate-900 dark:text-slate-100 font-medium">{tone.name}</span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${notificationTone === tone.name ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 dark:border-slate-600'}`}>
                  {notificationTone === tone.name && <div className="w-2 h-2 bg-white rounded-full"></div>}
                </div>
              </div>
            ))}
          </div>
          
          <button 
            onClick={() => toneFileInputRef.current?.click()}
            className="w-full flex items-center justify-center space-x-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold py-3 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors active:scale-95"
          >
            <span>Upload custom tone</span>
          </button>
          <input 
            type="file" 
            accept="audio/*" 
            className="hidden" 
            ref={toneFileInputRef} 
            onChange={handleToneUpload} 
          />
          <audio ref={audioRef} className="hidden" />
        </div>
      </div>
    );
  }

  if (currentView === 'storage') {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative animate-in slide-in-from-right-full duration-200">
        {renderToast()}
        {renderHeader('Storage and data')}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 py-1 overflow-hidden">
            <SettingItem icon={Database} label="Manage storage" subtitle="5.2 GB" hideBottomBorder onClick={() => showTemporaryToast('Open storage manager')} />
            <SettingItem icon={Database} label="Network usage" subtitle="2.1 GB sent, 3.4 GB received" hideBottomBorder onClick={() => showTemporaryToast('View detailed network stats')} />
            <SettingItem icon={() => null} label="Use less data for calls" hideBottomBorder onClick={() => showTemporaryToast('Toggle low data mode')} />
          </div>
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <h3 className="px-6 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800">Media auto-download</h3>
            <SettingItem icon={() => null} label="When using mobile data" subtitle="Photos" hideBottomBorder onClick={() => showTemporaryToast('Set mobile auto-download')} />
            <SettingItem icon={() => null} label="When connected on Wi-Fi" subtitle="All media" hideBottomBorder onClick={() => showTemporaryToast('Set Wi-Fi auto-download')} />
            <SettingItem icon={() => null} label="When roaming" subtitle="No media" hideBottomBorder onClick={() => showTemporaryToast('Set roaming auto-download')} />
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'shortcuts') {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900 relative animate-in slide-in-from-right-full duration-200">
        {renderToast()}
        {renderHeader('Keyboard shortcuts')}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Command available</h2>
            <ul className="space-y-2 text-sm text-slate-500 font-medium">
              <li className="flex justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 p-3 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800" onClick={() => showTemporaryToast('Shortcut details')}><span>Mark as unread</span> <span className="text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">Ctrl + Shift + U</span></li>
              <li className="flex justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 p-3 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800" onClick={() => showTemporaryToast('Shortcut details')}><span>Mute</span> <span className="text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">Ctrl + Shift + M</span></li>
              <li className="flex justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 p-3 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800" onClick={() => showTemporaryToast('Shortcut details')}><span>Archive chat</span> <span className="text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">Ctrl + Shift + E</span></li>
              <li className="flex justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 p-3 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800" onClick={() => showTemporaryToast('Shortcut details')}><span>Delete chat</span> <span className="text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">Ctrl + Shift + D</span></li>
              <li className="flex justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 p-3 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800" onClick={() => showTemporaryToast('Shortcut details')}><span>Pin chat</span> <span className="text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">Ctrl + Shift + P</span></li>
              <li className="flex justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 p-3 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800" onClick={() => showTemporaryToast('Shortcut details')}><span>Search</span> <span className="text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">Ctrl + Shift + F</span></li>
              <li className="flex justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 p-3 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800" onClick={() => showTemporaryToast('Shortcut details')}><span>New chat</span> <span className="text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">Ctrl + N</span></li>
              <li className="flex justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 p-3 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800" onClick={() => showTemporaryToast('Shortcut details')}><span>Settings</span> <span className="text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">Ctrl + ,</span></li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'business') {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative animate-in slide-in-from-right-full duration-200">
        {renderToast()}
        {renderHeader('Business tools')}
        <div className="flex-1 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800/50 m-4 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <h3 className="px-6 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800">Business Profile</h3>
            <SettingItem icon={Store} label="Business Profile" subtitle="Manage address, hours, and websites" hideBottomBorder onClick={() => showTemporaryToast('Business Profile coming soon')} />
            <SettingItem icon={Store} label="Catalog" subtitle="Show products and services" hideBottomBorder onClick={() => showTemporaryToast('Catalog coming soon')} />
          </div>
          <div className="bg-white dark:bg-slate-800/50 m-4 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
             <h3 className="px-6 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800">Reach more customers</h3>
             <SettingItem icon={MessageCircle} label="Advertise" subtitle="Create ads that lead to this app" hideBottomBorder onClick={() => showTemporaryToast('Advertise coming soon')} />
          </div>
          <div className="bg-white dark:bg-slate-800/50 m-4 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
             <h3 className="px-6 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800">Messaging tools</h3>
             <SettingItem icon={MessageCircle} label="Greeting message" subtitle="Welcome new customers automatically" hideBottomBorder onClick={() => showTemporaryToast('Set Greeting Message...')} />
             <SettingItem icon={Clock} label="Away message" subtitle="Reply automatically when you're away" hideBottomBorder onClick={() => showTemporaryToast('Set Away Message...')} />
             <SettingItem icon={MessageCircle} label="Quick replies" subtitle="Reuse frequent messages" hideBottomBorder onClick={() => showTemporaryToast('Manage Quick Replies...')} />
             <SettingItem icon={Tag} label="Labels" subtitle="Organise chats and customers" hideBottomBorder onClick={() => showTemporaryToast('Manage Labels...')} />
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'help') {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900 relative animate-in slide-in-from-right-full duration-200">
        {renderToast()}
        {renderHeader('Help')}
        <div className="flex-1 overflow-y-auto py-4">
          <SettingItem icon={HelpCircle} label="Help center" hideBottomBorder onClick={() => showTemporaryToast('Open Help Center...')} />
          <SettingItem icon={HelpCircle} label="Contact us" subtitle="Questions? Need help?" hideBottomBorder onClick={() => showTemporaryToast('Open Contact form...')} />
          <SettingItem icon={HelpCircle} label="Terms and Privacy Policy" hideBottomBorder onClick={() => showTemporaryToast('View Terms')} />
          <SettingItem icon={HelpCircle} label="App info" hideBottomBorder onClick={() => showTemporaryToast('Version: 1.0.0')} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 relative animate-in slide-in-from-left duration-200 border-r border-slate-200 dark:border-slate-800">
      <div className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center">
          {onBack && (
            <button onClick={onBack} className="mr-3 p-2 -ml-2 lg:hidden hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all text-slate-500 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Settings</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        {renderToast()}
        <div className="flex items-center px-6 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors relative group" onClick={() => setCurrentView('profile')}>
          <div className="w-[72px] h-[72px] rounded-full overflow-hidden mr-5 shadow-sm relative cursor-pointer bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 uppercase font-bold text-3xl outline outline-2 outline-offset-2 outline-transparent group-hover:outline-indigo-500/30 transition-all" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
            {userData?.avatar ? (
              <img src={userData.avatar} alt="Me" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            ) : (
              <span>{userData?.name ? userData.name.charAt(0) : '?'}</span>
            )}
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white mb-1" />
              <span className="text-[10px] text-white font-semibold uppercase tracking-widest">Change</span>
            </div>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleAvatarChange} 
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{userData?.name || 'User'}</h2>
            <p className="text-sm text-slate-500 truncate mt-0.5">{userData?.status || 'Available'}</p>
          </div>
        </div>

        <div className="h-px bg-slate-100 dark:bg-slate-800 mx-6 my-2"></div>

        <div className="py-2">
          <SettingItem icon={Briefcase} label="Business tools" subtitle="Profile, catalog, messaging tools" onClick={() => setCurrentView('business')} />
          <SettingItem icon={Key} label="Account" subtitle="Security notifications, change number" onClick={() => setCurrentView('account')} />
          <SettingItem icon={Lock} label="Privacy" subtitle="Block contacts, disappearing messages" onClick={() => setCurrentView('privacy')} />
          <SettingItem icon={ImageIcon} label="Avatar" subtitle="Create, edit, profile photo" onClick={() => fileInputRef.current?.click()} />
          <SettingItem icon={MessageSquare} label="Chats" subtitle="Theme, wallpapers, chat history" onClick={() => setCurrentView('chats')} />
          <SettingItem icon={Bell} label="Notifications" subtitle="Message, group & call tones" onClick={() => setCurrentView('notifications')} />
          <SettingItem icon={Database} label="Storage and data" subtitle="Network usage, auto-download" onClick={() => setCurrentView('storage')} />
          <SettingItem icon={Laptop} label="Keyboard shortcuts" onClick={() => setCurrentView('shortcuts')} />
          <SettingItem icon={HelpCircle} label="Help" subtitle="Help center, contact us, privacy policy" onClick={() => setCurrentView('help')} />
          <SettingItem icon={LogOut} label="Log out" onClick={logOut} />
        </div>

        <div className="h-px bg-slate-100 dark:bg-slate-800 mx-6 my-2"></div>

        <div className="py-2 px-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group" onClick={() => { toggleTheme(); showTemporaryToast(isDark ? 'Light theme applied' : 'Dark theme applied'); }}>
          <div className="flex items-center py-2">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex justify-center items-center text-slate-500 dark:text-slate-400 mr-4 group-hover:text-amber-500 dark:group-hover:text-indigo-400 transition-colors">
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <span className="text-base font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Theme</span>
              <p className="text-sm font-medium text-slate-500">{isDark ? 'Dark' : 'Light'}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function SettingItem({ icon: Icon, label, subtitle, onClick, hideBottomBorder }: any) {
  return (
    <div 
      className="flex items-center px-6 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all hover:scale-[1.02] group"
      onClick={onClick}
    >
      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex justify-center items-center text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 mr-4 transition-all">
        {Icon && <Icon className="w-5 h-5" />}
      </div>
      <div className={`flex-1 py-2 ${!hideBottomBorder ? 'border-b border-slate-100 dark:border-slate-800/50 group-last:border-none' : ''}`}>
        <div className="text-base font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{label}</div>
        {subtitle && <div className="text-sm font-medium text-slate-500 mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}
