import { MessageSquare, Phone, Users, Settings, CircleDashed, LogOut, Globe } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Screen } from '../App';
import { useAuth } from '../lib/AuthContext';
import { useCalls } from '../lib/useCalls';
import { useChats } from '../lib/useChats';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User as UserData } from '../data/mock';

type Props = {
  activeScreen: Screen;
  onChangeScreen: (s: Screen) => void;
};

export default function SidebarNavigation({ activeScreen, onChangeScreen }: Props) {
  const { user, logOut } = useAuth();
  const { missedCallsCount } = useCalls();
  const { chats } = useChats();
  const [userData, setUserData] = useState<UserData | null>(null);

  const unreadChatsCount = chats.reduce((acc, chat) => acc + (chat.unreadCount > 0 ? 1 : 0), 0);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docObj) => {
      if (docObj.exists()) {
        setUserData(docObj.data() as UserData);
      }
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <div className="w-16 bg-slate-100 dark:bg-slate-900 flex flex-col items-center py-4 border-r border-slate-200 dark:border-slate-800">
      {/* Top icons */}
      <div className="flex-1 flex flex-col space-y-6">
        <button onClick={() => onChangeScreen('chats')} className={`p-2 rounded-xl transition-all relative ${activeScreen === 'chats' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
          <MessageSquare className="w-6 h-6" />
          {unreadChatsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-slate-100 dark:border-slate-900">
              {unreadChatsCount}
            </span>
          )}
        </button>
        <button onClick={() => onChangeScreen('calls')} className={`p-2 rounded-xl transition-all relative ${activeScreen === 'calls' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
          <Phone className="w-6 h-6" />
          {missedCallsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-slate-100 dark:border-slate-900">
              {missedCallsCount}
            </span>
          )}
        </button>
        <button onClick={() => onChangeScreen('exchange')} className={`p-2 rounded-xl transition-all relative ${activeScreen === 'exchange' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`} title="Exchange Rates">
          <Globe className="w-6 h-6" />
        </button>
        <button onClick={() => onChangeScreen('status')} className={`p-2 rounded-xl transition-all relative ${activeScreen === 'status' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
          <CircleDashed className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom icons */}
      <div className="flex flex-col space-y-6 mt-auto items-center">
        <button onClick={() => onChangeScreen('contacts')} className={`p-2 rounded-xl transition-all relative ${activeScreen === 'contacts' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
          <Users className="w-6 h-6" />
        </button>
        <button onClick={() => onChangeScreen('settings')} className={`p-2 rounded-xl transition-all relative ${activeScreen === 'settings' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
          <Settings className="w-6 h-6" />
        </button>
        <button className="w-8 h-8 rounded-full overflow-hidden mt-2 outline outline-2 outline-offset-2 outline-transparent hover:outline-indigo-500/50 transition-all bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 uppercase font-bold text-sm relative" onClick={() => onChangeScreen('settings')}>
          {userData?.avatar ? (
            <img src={userData.avatar} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span>{userData?.name ? userData.name.charAt(0) : '?'}</span>
          )}
        </button>
        <button onClick={() => logOut()} className="p-2 mt-4 rounded-xl transition-all text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" title="Log Out">
          <LogOut className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
