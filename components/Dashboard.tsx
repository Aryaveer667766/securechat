import React, { useState, useEffect, useRef } from 'react';
import { User, AppView, Message } from '../types';
import { ChatInterface } from './ChatInterface';
import { LiveInterface } from './LiveInterface';
import { PLACEHOLDER_AVATAR, PEER_IDS, TARGET_IDS } from '../constants';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.CHAT);
  const [peer, setPeer] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  
  // Use refs for connection management to avoid closure staleness in callbacks
  const retryTimeoutRef = useRef<any>(null);
  const connectionRef = useRef<any>(null);
  const peerRef = useRef<any>(null);

  const myPeerId = PEER_IDS[user.id as keyof typeof PEER_IDS];
  const targetPeerId = TARGET_IDS[user.id as keyof typeof TARGET_IDS];

  useEffect(() => {
    // Cleanup any existing peer instance on mount/user change
    if (peerRef.current) {
      peerRef.current.destroy();
    }

    // Initialize PeerJS with debug: 0 to suppress "Error" logs in console when peer is missing
    // This addresses the user's concern about the visible error message
    const newPeer = new (window as any).Peer(myPeerId, {
      debug: 0 
    });
    
    peerRef.current = newPeer;

    const connectToPeer = () => {
      if (newPeer.destroyed) return;
      
      // If we already have an active, open connection, don't interrupt it
      if (connectionRef.current && connectionRef.current.open) return;

      console.log(`Attempting connection to ${targetPeerId}...`);
      
      // Close any stale/pending connection attempt before starting a new one
      if (connectionRef.current) {
          connectionRef.current.close();
      }

      const connection = newPeer.connect(targetPeerId, {
        reliable: true
      });
      
      setupConnection(connection);
    };

    const setupConnection = (connection: any) => {
      connectionRef.current = connection;

      connection.on('open', () => {
        console.log('Connection established with ' + connection.peer);
        setIsConnected(true);
        // Clear any pending retry timeouts since we are now connected
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
      });

      connection.on('data', (data: any) => {
        setMessages(prev => [...prev, data]);
      });

      connection.on('close', () => {
        console.log('Connection closed');
        setIsConnected(false);
        connectionRef.current = null;
        
        // Auto-reconnect if the connection drops and peer is still alive
        if (peerRef.current && !peerRef.current.destroyed) {
            retryTimeoutRef.current = setTimeout(connectToPeer, 3000);
        }
      });
      
      connection.on('error', (err: any) => {
          console.error('Connection error:', err);
          setIsConnected(false);
      });
    };

    newPeer.on('open', (id: string) => {
      console.log('My peer ID is: ' + id);
      setPeer(newPeer);
      // Attempt initial connection
      connectToPeer();
    });

    newPeer.on('connection', (connection: any) => {
      console.log('Incoming connection from', connection.peer);
      // If we receive a connection, accept it and use it
      setupConnection(connection);
    });

    newPeer.on('call', (call: any) => {
      console.log('Incoming call');
      setIncomingCall(call);
      setCurrentView(AppView.LIVE);
    });

    newPeer.on('error', (err: any) => {
      // Handle "peer-unavailable" specifically
      if (err.type === 'peer-unavailable') {
        // If we are already connected (e.g. via incoming connection), ignore this error
        if (connectionRef.current && connectionRef.current.open) return;

        // Otherwise, it means target is offline. Retry silently.
        console.log('Target peer unavailable. Retrying in 3 seconds...');
        setIsConnected(false);
        
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = setTimeout(() => {
          connectToPeer();
        }, 3000);
      } else if (err.type === 'network' || err.type === 'disconnected') {
          console.log('Network error or disconnected. Reconnecting...');
          setIsConnected(false);
          newPeer.reconnect();
      } else {
          // Log other errors
          console.error('Peer error:', err.type, err);
      }
    });

    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (connectionRef.current) connectionRef.current.close();
      if (peerRef.current) peerRef.current.destroy();
      peerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const sendMessage = (text: string, attachments: any[] = []) => {
    if (!connectionRef.current || !isConnected) return;
    
    const msg: Message = {
      id: Date.now().toString(),
      senderId: user.id,
      text,
      attachments,
      timestamp: Date.now(),
      type: 'text'
    };

    try {
        connectionRef.current.send(msg);
        setMessages(prev => [...prev, msg]);
    } catch (e) {
        console.error("Error sending message", e);
        setIsConnected(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-20 lg:w-64 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-all duration-300">
        <div>
          <div className="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="ml-3 font-bold text-xl text-white hidden lg:block">Secure Chat</span>
          </div>

          <nav className="p-4 space-y-2">
            <button
              onClick={() => setCurrentView(AppView.CHAT)}
              className={`w-full flex items-center p-3 rounded-xl transition-all ${currentView === AppView.CHAT ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              <span className="ml-3 font-medium hidden lg:block">Messages</span>
            </button>

            <button
              onClick={() => setCurrentView(AppView.LIVE)}
              className={`w-full flex items-center p-3 rounded-xl transition-all ${currentView === AppView.LIVE ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <div className="relative">
                <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                {incomingCall && currentView !== AppView.LIVE && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                )}
              </div>
              <span className="ml-3 font-medium hidden lg:block">Calls</span>
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="mb-4">
             <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="hidden lg:block">Status</span>
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-yellow-500 animate-pulse'}`}></span>
             </div>
             {isConnected ? (
                 <p className="text-xs text-green-400 hidden lg:block">Encrypted Tunnel Active</p>
             ) : (
                 <p className="text-xs text-yellow-500 hidden lg:block">Establishing Connection...</p>
             )}
          </div>
          <div className="flex items-center lg:space-x-3 mb-4 justify-center lg:justify-start">
            <img src={PLACEHOLDER_AVATAR} alt="User" className="w-10 h-10 rounded-full border-2 border-slate-700" />
            <div className="hidden lg:block overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">{user.username}</p>
              <p className="text-xs text-slate-500 uppercase">{user.role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center lg:justify-start p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span className="ml-2 hidden lg:block text-sm">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
        {currentView === AppView.CHAT && (
            <ChatInterface 
                messages={messages} 
                onSendMessage={sendMessage} 
                currentUser={user} 
                isConnected={isConnected}
            />
        )}
        {currentView === AppView.LIVE && (
            <LiveInterface 
                peer={peer}
                targetPeerId={targetPeerId}
                incomingCall={incomingCall}
                onCallEnd={() => setIncomingCall(null)}
            />
        )}
      </div>
    </div>
  );
};