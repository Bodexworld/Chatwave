export type User = {
  id: string;
  name: string;
  avatar: string;
  status: string;
  online: boolean;
  lastSeen?: Date;
};

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MessageType = 'text' | 'image' | 'voice' | 'file';

export type Message = {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: Date;
  status: MessageStatus;
  type: MessageType;
  mediaUrl?: string;
  fileUrl?: string;
  mediaDuration?: number;
  fileName?: string;
  fileSize?: string;
};

export type ChatType = 'direct' | 'group';

export type Chat = {
  id: string;
  type: ChatType;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  unreadCountMap?: Record<string, number>;
  typing?: Record<string, boolean>;
  name?: string;
  avatar?: string;
  isPinned?: boolean;
  status?: 'pending' | 'accepted' | 'declined';
  requestedBy?: string;
  admins?: string[];
};

export type CallType = 'voice' | 'video';
export type CallStatus = 'incoming' | 'outgoing' | 'missed';

export type CallLog = {
  id: string;
  participants: User[];
  type: CallType;
  status: CallStatus;
  timestamp: Date;
  duration?: number;
};

const DUMMY_AVATARS = [
  'https://i.pravatar.cc/150?u=a042581f4e29026704d',
  'https://i.pravatar.cc/150?u=a042581f4e29026024d',
  'https://i.pravatar.cc/150?u=a04258114e29026702d',
  'https://i.pravatar.cc/150?u=a048581f4e29026701d',
  'https://i.pravatar.cc/150?u=a04258a2462d826712d',
];

export const CURRENT_USER: User = {
  id: 'u_me',
  name: 'Me',
  avatar: 'https://i.pravatar.cc/150?u=me',
  status: 'In a meeting',
  online: true,
};

export const CONTACTS: User[] = [
  { id: 'u_1', name: 'Alice Smith', avatar: DUMMY_AVATARS[0], status: 'Available', online: true },
  { id: 'u_2', name: 'Bob Jones', avatar: DUMMY_AVATARS[1], status: 'Busy', online: false, lastSeen: new Date(Date.now() - 3600000) },
  { id: 'u_3', name: 'Charlie Davis', avatar: DUMMY_AVATARS[2], status: 'At the gym', online: true },
  { id: 'u_4', name: 'Diana Prince', avatar: DUMMY_AVATARS[3], status: 'Sleeping', online: false, lastSeen: new Date(Date.now() - 86400000) },
  { id: 'u_5', name: 'Evan Williams', avatar: DUMMY_AVATARS[4], status: 'Working', online: true },
];

export const INITIAL_MESSAGES: Message[] = [
  { id: 'm_1', chatId: 'c_1', senderId: 'u_1', content: 'Hey, are we still on for tomorrow?', timestamp: new Date(Date.now() - 3600000), status: 'read', type: 'text' },
  { id: 'm_2', chatId: 'c_1', senderId: 'u_me', content: 'Yep! Same place and time.', timestamp: new Date(Date.now() - 3500000), status: 'read', type: 'text' },
  { id: 'm_3', chatId: 'c_1', senderId: 'u_1', content: 'Great, see you then.', timestamp: new Date(Date.now() - 100000), status: 'read', type: 'text' },
  
  { id: 'm_4', chatId: 'c_2', senderId: 'u_2', content: 'Check out this design!', timestamp: new Date(Date.now() - 86400000), status: 'read', type: 'image', mediaUrl: 'https://images.unsplash.com/photo-1541462608143-67571c6738dd?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80' },
  { id: 'm_5', chatId: 'c_2', senderId: 'u_2', content: '', timestamp: new Date(Date.now() - 86300000), status: 'delivered', type: 'voice', mediaDuration: 14 },
  
  { id: 'm_6', chatId: 'c_3', senderId: 'u_me', content: 'Did you review the PR?', timestamp: new Date(Date.now() - 5000), status: 'delivered', type: 'text' },
];

export const INITIAL_CHATS: Chat[] = [
  {
    id: 'c_1',
    type: 'direct',
    participants: [CONTACTS[0]],
    lastMessage: INITIAL_MESSAGES[2],
    unreadCount: 0,
    isPinned: true
  },
  {
    id: 'c_2',
    type: 'direct',
    participants: [CONTACTS[1]],
    lastMessage: INITIAL_MESSAGES[4],
    unreadCount: 2,
  },
  {
    id: 'c_3',
    type: 'direct',
    participants: [CONTACTS[2]],
    lastMessage: INITIAL_MESSAGES[5],
    unreadCount: 0,
  },
  {
    id: 'c_g1',
    type: 'group',
    name: 'Design Team',
    avatar: 'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80',
    participants: [CONTACTS[0], CONTACTS[1], CONTACTS[3]],
    lastMessage: {
      id: 'm_g1', chatId: 'c_g1', senderId: 'u_4', content: 'Meeting notes attached.', timestamp: new Date(Date.now() - 172800000), status: 'read', type: 'file', fileName: 'Notes_Q3.pdf', fileSize: '1.2 MB'
    },
    unreadCount: 0,
  }
];

export const INITIAL_CALLS: CallLog[] = [
  { id: 'call_1', participants: [CONTACTS[0]], type: 'video', status: 'incoming', timestamp: new Date(Date.now() - 3600000), duration: 245 },
  { id: 'call_2', participants: [CONTACTS[2]], type: 'voice', status: 'missed', timestamp: new Date(Date.now() - 86400000) },
  { id: 'call_3', participants: [CONTACTS[4]], type: 'voice', status: 'outgoing', timestamp: new Date(Date.now() - 172800000), duration: 12 },
];
