import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Search, PhoneCall, ArrowLeft, Link as LinkIcon, Plus, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { User } from '../data/mock';
import { useCalls, CallSession } from '../lib/useCalls';
import { useAuth } from '../lib/AuthContext';
import { useContacts } from '../lib/useContacts';
import { useState } from 'react';

type Props = {
  onStartCall: (type: 'voice' | 'video', contact: User) => void;
  onStartMeeting?: () => void;
  onJoinMeeting?: (code: string) => void;
  onBack?: () => void;
};

export default function Calls({ onStartCall, onStartMeeting, onJoinMeeting, onBack }: Props) {
  const { callHistory } = useCalls();
  const { user } = useAuth();
  const { contacts } = useContacts();
  const [meetingCode, setMeetingCode] = useState('');

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      <div className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center">
          {onBack && (
            <button onClick={onBack} className="mr-3 p-2 -ml-2 lg:hidden hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all text-slate-500 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Calls</h1>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center px-4 py-2 opacity-90 target:opacity-100 transition-opacity focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white dark:focus-within:bg-slate-800 border border-transparent focus-within:border-indigo-500/30">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2" />
          <input 
            type="text" 
            placeholder="Search calls"
            className="bg-transparent border-none outline-none w-full text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 font-medium"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 mb-4 grid gap-3">
          <button onClick={onStartMeeting} className="w-full bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex flex-col items-start p-4 rounded-3xl transition-colors shadow-sm group">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-md shadow-indigo-500/30">
              <Video className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold">Start a Meeting</h3>
            <p className="text-sm font-medium mt-1 opacity-80 text-left">Generate a link and invite people like Zoom</p>
          </button>
          
          <div className="w-full bg-slate-50 dark:bg-slate-800/50 flex flex-col p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
             <div className="flex items-center text-slate-600 dark:text-slate-300 font-bold text-sm mb-3">
               <LinkIcon className="w-4 h-4 mr-2" />
               Join Meeting
             </div>
             <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl p-1.5 border border-slate-200 dark:border-slate-700 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                <input 
                  type="text" 
                  value={meetingCode}
                  onChange={(e) => setMeetingCode(e.target.value)}
                  placeholder="Meeting ID" 
                  className="bg-transparent border-none outline-none flex-1 w-full px-3 text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                />
                <button 
                  onClick={() => onJoinMeeting?.(meetingCode)}
                  disabled={!meetingCode.trim()}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors"
                >
                  Join
                </button>
             </div>
          </div>
        </div>

        <h3 className="px-6 py-1 text-sm text-indigo-600 font-bold tracking-widest mt-2 uppercase">Recent Calls</h3>

        {callHistory.map((call: CallSession) => {
          const isCaller = call.callerId === user?.uid;
          const otherUserId = isCaller ? call.receiverId : call.callerId;
          const participant = contacts.find(c => c.id === otherUserId);
          const isMissed = !isCaller && (call.status === 'missed' || call.status === 'rejected');
          
          const participantName = participant?.name || (isCaller ? 'Unknown' : call.callerName || 'Unknown');
          const participantAvatar = participant?.avatar || (isCaller ? undefined : call.callerAvatar);

          const time = call.createdAt?.toDate ? call.createdAt.toDate() : new Date();

          return (
            <div 
              key={call.id} 
              className="w-full flex items-center justify-between px-6 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all hover:scale-[1.02] cursor-pointer group"
              onClick={() => participant && onStartCall(call.type, participant)}
            >
              <div className="flex items-center flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 mr-4 shadow-sm group-hover:scale-105 transition-transform bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500">
                  {participantAvatar ? (
                    <img src={participantAvatar} alt={participantName} className="w-full h-full object-cover" />
                  ) : (
                    participantName.charAt(0)
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col border-slate-100 dark:border-slate-800/50 pb-2 pt-1">
                  <h3 className={`text-base font-semibold ${isMissed ? 'text-red-500' : 'text-slate-900 dark:text-slate-100'}`}>{participantName}</h3>
                  <div className="flex items-center text-sm font-medium tracking-tight mt-0.5 opacity-80">
                    {isMissed ? <PhoneMissed className="w-3.5 h-3.5 mr-1.5 text-red-500" /> : (!isCaller ? <PhoneIncoming className="w-3.5 h-3.5 mr-1.5 text-indigo-500" /> : <PhoneOutgoing className="w-3.5 h-3.5 mr-1.5 text-slate-500 dark:text-slate-400" />)}
                    <span className="text-slate-500">{format(time, 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 ml-4 h-full flex items-center pb-2 pt-1">
                {participant && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onStartCall(call.type, participant); }}
                    className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all opacity-0 group-hover:opacity-100"
                  >
                    {call.type === 'video' ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
