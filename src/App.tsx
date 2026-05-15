import React, { useState, useEffect } from 'react';
import { Chat, User } from './data/mock';
import ChatList from './components/ChatList';
import ChatConversation from './components/ChatConversation';
import Contacts from './components/Contacts';
import Calls from './components/Calls';
import Settings from './components/Settings';
import Status from './components/Status';
import SidebarNavigation from './components/SidebarNavigation';
import CallScreen from './components/CallScreen';
import { MessageSquare, Phone, Users, Settings as SettingsIcon, X, Download, CircleDashed, Globe } from 'lucide-react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { useCalls } from './lib/useCalls';
import { useChats } from './lib/useChats';
import { useContacts } from './lib/useContacts';
import { useNotifications } from './lib/useNotifications';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { Toaster } from 'react-hot-toast';
import InstallPrompt from './components/InstallPrompt';

import MeetingModal from './components/MeetingModal';

import ExchangeRates from './components/ExchangeRates';

export type Screen = 'chats' | 'contacts' | 'calls' | 'settings' | 'status' | 'exchange';

function MainApp() {
  const { user } = useAuth();
  const { contacts } = useContacts();
  useNotifications(contacts);
  const { activeCallSession, missedCallsCount, clearMissedCallsCount, initiateCall, updateCallStatus } = useCalls();
  const { chats } = useChats();
  const [activeScreen, setActiveScreen] = useState<Screen>('chats');
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [activeMeetingRoom, setActiveMeetingRoom] = useState<string | null>(null);
  
  const [isMobile, setIsMobile] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  const unreadChatsCount = chats.reduce((acc, chat) => acc + (chat.unreadCount > 0 ? 1 : 0), 0);

  useEffect(() => {
    if (activeScreen === 'calls') {
      clearMissedCallsCount();
    }
  }, [activeScreen]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsDesktop(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // When on mobile, if a chat is active, we should hide the list and show only the chat
  const showChatList = !isMobile || (isMobile && !activeChat);
  const showConversation = activeChat || !isMobile;

  const handleSelectContact = async (contact: User) => {
    if (!user) return;
    
    // Sort UIDs to ensure consistent chat ID for direct chats
    const participants = [user.uid, contact.id].sort();
    const chatId = `direct_${participants[0]}_${participants[1]}`;
    
    try {
       const chatRef = doc(db, 'chats', chatId);
       const chatDoc = await getDoc(chatRef);
       
       if (!chatDoc.exists()) {
          const initialUnread: Record<string, number> = {};
          initialUnread[contact.id] = 1;
          await setDoc(chatRef, {
             type: 'direct',
             participants,
             createdAt: serverTimestamp(),
             updatedAt: serverTimestamp(),
             lastMessage: {},
             unreadCount: initialUnread,
             status: 'pending',
             requestedBy: user.uid
          });
       }
       
       // Note: we're mocking the chat object here just enough for the conversation to render
       // The actual chat will be pulled by ChatList and shown next time.
       setActiveChat({
          id: chatId,
          type: 'direct',
          participants: [contact],
          unreadCount: 0,
          status: chatDoc.exists() ? chatDoc.data().status : 'pending',
          requestedBy: chatDoc.exists() ? chatDoc.data().requestedBy : user.uid
       } as Chat);
       setActiveScreen('chats');
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, 'chats');
    }
  };

  const handleCreateGroup = async (name: string, members: User[]) => {
    if (!user) return;
    
    const chatId = `group_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const participants = [user.uid, ...members.map(m => m.id)];
    
    try {
       const chatRef = doc(db, 'chats', chatId);
       const initialUnread: Record<string, number> = {};
       participants.forEach(p => initialUnread[p] = 0);

       await setDoc(chatRef, {
          type: 'group',
          name: name || 'New Group',
          participants,
          admins: [user.uid],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: {},
          unreadCount: initialUnread,
          status: 'accepted',
       });
       
       setActiveChat({
          id: chatId,
          type: 'group',
          name: name || 'New Group',
          participants: members, // we omit ourselves in the mock or include it, ChatList derives from participants
          unreadCount: 0,
       } as Chat);
       setActiveScreen('chats');
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, 'chats');
    }
  };

  return (
    <div className="fixed inset-0 w-full flex bg-slate-50 dark:bg-slate-900 overflow-hidden sm:p-4 md:p-6 lg:p-8 font-sans">
      {/* Sidebar Navigation - only visible on tablet/desktop, mobile will have it differently or integrated in list headers */}
      {!isMobile && (
        <SidebarNavigation 
          activeScreen={activeScreen} 
          onChangeScreen={(screen) => {
            setActiveScreen(screen);
            setActiveChat(null);
          }} 
        />
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative shadow-2xl sm:rounded-[2.5rem] bg-white dark:bg-[#151e2e] border sm:border-slate-200/50 dark:border-slate-800/50 max-w-[1600px] mx-auto w-full">
        {activeMeetingRoom && (
          <MeetingModal roomName={activeMeetingRoom} onClose={() => setActiveMeetingRoom(null)} />
        )}
        {activeCallSession && (
           <CallScreen 
             callSession={activeCallSession} 
             contact={contacts.find(c => c.id === (activeCallSession.callerId === user?.uid ? activeCallSession.receiverId : activeCallSession.callerId)) || { id: 'unknown', name: activeCallSession.callerName || 'Unknown', avatar: activeCallSession.callerAvatar }} 
             isIncoming={activeCallSession.receiverId === user?.uid}
             onAccept={() => updateCallStatus(activeCallSession.id, 'connected')}
             onReject={() => updateCallStatus(activeCallSession.id, 'rejected')}
             onEndCall={() => updateCallStatus(activeCallSession.id, 'ended')} 
           />
        )}
        {/* Left Panel: Lists (Chats, Contacts, Calls, Settings) */}
        {showChatList && (
          <div className={`${isMobile ? 'w-full' : 'w-full max-w-[380px] lg:max-w-[420px]'} flex-shrink-0 border-r border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#151e2e]/50 flex flex-col z-10 backdrop-blur-xl`}>
             {activeScreen === 'chats' && <ChatList activeChat={activeChat} onSelectChat={setActiveChat} onShowContacts={() => setActiveScreen('contacts')} />}
             {activeScreen === 'contacts' && <Contacts onSelectContact={handleSelectContact} onStartCall={initiateCall} onCreateGroup={handleCreateGroup} onBack={() => setActiveScreen('chats')} />}
             {activeScreen === 'calls' && <Calls onStartCall={initiateCall} onStartMeeting={() => setActiveMeetingRoom(`Chatwave_Meeting_${Math.random().toString(36).substring(2, 10)}`)} onJoinMeeting={(roomName) => setActiveMeetingRoom(roomName)} onBack={() => setActiveScreen('chats')} />}
             {activeScreen === 'exchange' && <ExchangeRates onBack={() => setActiveScreen('chats')} />}
             {activeScreen === 'status' && <Status onBack={() => setActiveScreen('chats')} />}
             {activeScreen === 'settings' && <Settings onBack={() => setActiveScreen('chats')} />}
             
             {/* Mobile bottom navigation */}
             {isMobile && (
        <div className="mt-auto border-t border-slate-100 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl flex justify-around p-3 pb-safe shadow-lg z-20">
                  <MobileNavBtn onClick={() => setActiveScreen('chats')} active={activeScreen === 'chats'} Icon={MessageSquare} label="Chats" badge={unreadChatsCount > 0 ? unreadChatsCount : 0} />
                  <MobileNavBtn onClick={() => setActiveScreen('calls')} active={activeScreen === 'calls'} Icon={Phone} label="Calls" badge={missedCallsCount} />
                  <MobileNavBtn onClick={() => setActiveScreen('status')} active={activeScreen === 'status'} Icon={CircleDashed} label="Status" />
                  <MobileNavBtn onClick={() => setActiveScreen('exchange')} active={activeScreen === 'exchange'} Icon={Globe} label="Rates" />
                  <MobileNavBtn onClick={() => setActiveScreen('contacts')} active={activeScreen === 'contacts'} Icon={Users} label="Contacts" />
                  <MobileNavBtn onClick={() => setActiveScreen('settings')} active={activeScreen === 'settings'} Icon={SettingsIcon} label="Settings" />
                </div>
             )}
          </div>
        )}

        {/* Right Panel: Conversation / Detail view */}
        {showConversation && (
          <div className="flex-1 flex flex-col bg-white dark:bg-[#0f172a] relative overflow-hidden">
            {activeChat ? (
              <ChatConversation 
                chat={activeChat} 
                onBack={() => setActiveChat(null)} 
                isMobile={isMobile} 
                onStartCall={initiateCall} 
              />
            ) : (
              <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900/50">
                <div className="w-32 h-32 bg-white dark:bg-slate-800 rounded-[2rem] shadow-xl flex items-center justify-center mb-8 rotate-3 transform transition-transform hover:rotate-6">
                   <MessageSquare className="w-16 h-16 text-indigo-500" />
                </div>
                <h2 className="text-3xl font-display font-bold text-slate-800 dark:text-slate-100 mb-3 tracking-tight">Chatwave Web</h2>
                <p className="text-center text-slate-500 dark:text-slate-400 max-w-sm mb-10 text-lg">Send and receive messages without keeping your phone online.</p>
                <div className="flex items-center text-sm text-slate-400 dark:text-slate-500 font-medium bg-slate-100 dark:bg-slate-800/50 px-4 py-2 rounded-full">
                  <Lock className="w-4 h-4 mr-2" /> End-to-end encrypted
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Lock({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function MobileNavBtn({ onClick, active, Icon, label, badge }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center min-w-[50px] w-14 sm:w-16 h-14 rounded-2xl transition-all relative ${active ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
      <Icon className="w-5 h-5 mb-0.5 relative z-10" />
      <span className="text-[10px] font-semibold relative z-10">{label}</span>
      {badge > 0 && (
        <span className="absolute top-1 right-2 bg-emerald-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm z-20">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

function AppContent() {
  const { user, loading, signInWithEmail, signUpWithEmail } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (loading) {
    return (
      <div className="fixed inset-0 w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
        <div className="flex items-center justify-center w-20 h-20 bg-white dark:bg-slate-800 shadow-xl rounded-[1.5rem] mb-6">
          <MessageSquare className="w-10 h-10 text-indigo-500 animate-pulse" />
        </div>
        <div className="text-3xl font-display font-bold tracking-tight text-slate-800 dark:text-slate-100 mb-6">Chatwave</div>
        <div className="w-32 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full animate-[pulse_1s_ease-in-out_infinite]" style={{width: '60%'}}></div>
        </div>
      </div>
    );
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isSignUp && !name) {
      setError('Please enter a display name');
      return;
    }
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    setIsLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, name);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      console.error('Auth failed:', err);
      let errorMessage = 'Authentication failed.';
      if (err.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. If you are using ad blockers or Brave Shields, please disable them. Also, verify your internet connection.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/Password authentication is not enabled. Please enable it in Firebase Console -> Authentication -> Sign-in method.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Email is already in use. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      } else {
        errorMessage = err.message || errorMessage;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="fixed inset-0 w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 font-sans p-4 relative overflow-hidden">
         {/* Decorative background blobs */}
         <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-indigo-400/20 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
         <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-rose-400/20 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3 pointer-events-none"></div>
         
         <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-2xl border border-white/20 dark:border-slate-700/50 p-8 sm:p-12 rounded-[2.5rem] shadow-2xl shadow-indigo-900/5 max-w-md w-full mx-4 text-center relative z-10">
            <div className="w-20 h-20 bg-indigo-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-500/30 transform -rotate-3">
               <MessageSquare className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-display font-bold mb-2 text-slate-800 dark:text-slate-100 tracking-tight">
              {isSignUp ? 'Join Chatwave' : 'Welcome back'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
              {isSignUp ? 'Create an account to start chatting' : 'Sign in to sync your messages'}
            </p>
            
            {error && <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 p-4 rounded-2xl mb-8 text-sm font-medium border border-rose-100 dark:border-rose-500/20">{error}</div>}

            <form onSubmit={handleAuth} className="flex flex-col gap-5 text-left">
              {isSignUp && (
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">Display Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all font-medium placeholder:font-normal placeholder:text-slate-400"
                    required
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all font-medium placeholder:font-normal placeholder:text-slate-400"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all font-medium placeholder:font-normal placeholder:text-slate-400"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 px-4 rounded-2xl transition-all disabled:opacity-70 flex items-center justify-center shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
              >
                {isLoading ? <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div> : (isSignUp ? 'Sign Up' : 'Sign In')}
              </button>
            </form>
            
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm font-semibold mt-6 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors inline-block text-center"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
      </div>
    );
  }

  return <MainApp />;
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  state = { hasError: false, error: null };
  props!: {children: React.ReactNode};

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center mb-6">
            <X className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-4">Something went wrong</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">The application encountered an error. This might be due to database limits (Quota Exceeded) or a temporary network issue.</p>
          <pre className="text-left bg-slate-800 text-slate-200 p-4 rounded-lg overflow-auto max-w-2xl max-h-64 text-xs whitespace-pre-wrap">{this.state.error?.toString()}</pre>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-xl transition-all"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Toaster position="top-right" />
        <AppContent />
        <InstallPrompt />
      </AuthProvider>
    </ErrorBoundary>
  );
}

