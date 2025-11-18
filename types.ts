export interface User {
  id: string;
  username: string;
  role: 'admin' | 'guest';
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  attachments?: Attachment[];
  timestamp: number;
  type: 'text' | 'system';
}

export interface Attachment {
  mimeType: string;
  data: string; // Base64
  name: string;
}

export enum AppView {
  CHAT = 'CHAT',
  LIVE = 'LIVE'
}

export interface PeerConfig {
  myId: string;
  targetId: string;
}