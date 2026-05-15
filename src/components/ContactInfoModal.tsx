import React from 'react';
import { User } from '../data/mock';
import { X, Phone, Video, ChevronRight, Bell, Ban, ThumbsDown, Image as ImageIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  contact: User;
  onClose: () => void;
  onStartCall: (type: 'voice' | 'video', contact: User) => void;
}

export default function ContactInfoModal({ contact, onClose, onStartCall }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pb-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onClose}
      />
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl relative z-10 animate-in zoom-in-95 fade-in duration-300 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">Contact Info</h2>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar flex-1 pb-6">
          {/* Profile Basic Info */}
          <div className="flex flex-col items-center pt-8 pb-6 px-6">
            <div className="w-32 h-32 rounded-full overflow-hidden mb-4 shadow-xl shadow-slate-200 dark:shadow-slate-900/50 outline outline-4 outline-offset-4 outline-transparent hover:outline-indigo-500/20 transition-all cursor-pointer">
              {contact.avatar ? (
                <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-4xl text-indigo-500 font-bold uppercase">
                  {contact.name?.charAt(0) || '?'}
                </div>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">{contact.name}</h1>
            <p className="text-sm font-medium text-slate-500 mb-6">
              {contact.online ? <span className="text-indigo-600 dark:text-indigo-400">Online</span> : contact.lastSeen ? `Last seen ${formatDistanceToNow(contact.lastSeen, { addSuffix: true })}` : 'Offline'}
            </p>

            <div className="flex items-center gap-4 w-full justify-center">
              <button 
                onClick={() => { onClose(); onStartCall('voice', contact); }}
                className="flex flex-col items-center gap-2 p-3 w-20 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-95 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm">
                  <Phone className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Audio</span>
              </button>
              <button 
                onClick={() => { onClose(); onStartCall('video', contact); }}
                className="flex flex-col items-center gap-2 p-3 w-20 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-95 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm">
                  <Video className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Video</span>
              </button>
            </div>
          </div>

          <div className="h-2 bg-slate-50 dark:bg-slate-950 w-full" />

          {/* About */}
          <div className="px-6 py-5">
            <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3">About</h3>
            <p className="text-base text-slate-900 dark:text-slate-100 font-medium">{contact.status || 'Available'}</p>
            <p className="text-xs text-slate-400 mt-1">October 14, 2023</p>
          </div>

          <div className="h-2 bg-slate-50 dark:bg-slate-950 w-full" />

          {/* Media Links Docs */}
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4 cursor-pointer group">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Media, links, and docs</h3>
              <div className="flex items-center gap-1 text-slate-400 group-hover:text-indigo-600 transition-colors">
                <span className="text-xs font-medium">12</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar snap-x">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-20 h-20 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden snap-center flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                </div>
              ))}
            </div>
          </div>

          <div className="h-2 bg-slate-50 dark:bg-slate-950 w-full" />

          {/* Actions */}
          <div className="px-4 py-3 space-y-1">
            <button onClick={() => alert('Mute notifications feature coming soon!')} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-[0.98] transition-all text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-slate-400" />
                <span className="font-semibold text-sm">Mute notifications</span>
              </div>
              <div className="w-10 h-6 bg-slate-200 dark:bg-slate-700 rounded-full cursor-pointer relative transition-colors">
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform" />
              </div>
            </button>
          </div>

          <div className="h-2 bg-slate-50 dark:bg-slate-950 w-full" />

          <div className="px-4 py-3 space-y-1">
            <button onClick={() => alert('Block contact feature coming soon!')} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 active:scale-[0.98] transition-all">
              <Ban className="w-5 h-5" />
              <span className="font-semibold text-sm">Block {contact.name.split(' ')[0]}</span>
            </button>
            <button onClick={() => alert('Report contact feature coming soon!')} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 active:scale-[0.98] transition-all">
              <ThumbsDown className="w-5 h-5" />
              <span className="font-semibold text-sm">Report {contact.name.split(' ')[0]}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
