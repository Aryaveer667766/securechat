import React, { useState, useRef, useEffect } from 'react';
import { Message, Attachment, User } from '../types';
import { blobToBase64 } from '../utils/audioUtils';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string, attachments: Attachment[]) => void;
  currentUser: User;
  isConnected: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, currentUser, isConnected }) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const base64 = await blobToBase64(file);
        setAttachments(prev => [...prev, {
          mimeType: file.type,
          data: base64,
          name: file.name
        }]);
      } catch (err) {
        console.error("File read error", err);
      }
    }
  };

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || !isConnected) return;
    
    onSendMessage(input, attachments);
    setInput('');
    setAttachments([]);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
        {/* Header */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur">
            <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
                <h2 className="text-white font-semibold">Encrypted Channel</h2>
            </div>
            {!isConnected && (
                <span className="text-xs text-yellow-400 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20 flex items-center gap-2">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Establishing Secure Connection...
                </span>
            )}
        </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
            <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <p className="text-lg">Secure P2P Connection Established</p>
            <p className="text-sm">Messages are end-to-end between peers.</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-4 ${msg.senderId === currentUser.id ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'}`}>
              
              {/* Attachments Display */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {msg.attachments.map((att, idx) => (
                    <a 
                        key={idx} 
                        href={`data:${att.mimeType};base64,${att.data}`} 
                        download={att.name}
                        className="relative group overflow-hidden rounded-lg border border-white/20 block hover:border-white/50 transition-colors cursor-pointer"
                    >
                        {att.mimeType.startsWith('image/') ? (
                             <img src={`data:${att.mimeType};base64,${att.data}`} alt="attachment" className="h-32 w-auto object-cover" />
                        ) : (
                            <div className="h-12 px-3 flex items-center bg-slate-900/50 gap-2 min-w-[150px]">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <span className="text-xs truncate flex-1">{att.name}</span>
                                <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </div>
                        )}
                    </a>
                  ))}
                </div>
              )}

              <div className="prose prose-invert text-sm whitespace-pre-wrap font-medium">
                {msg.text}
              </div>
              <div className="text-[10px] mt-1 opacity-50 text-right">
                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-800/50 border-t border-slate-700 backdrop-blur-sm">
        {attachments.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                {attachments.map((att, idx) => (
                    <div key={idx} className="relative bg-slate-700 rounded px-2 py-1 text-xs flex items-center gap-2">
                        <span className="max-w-[100px] truncate">{att.name}</span>
                        <button 
                            onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="hover:text-red-400"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        )}
        <div className="flex items-center gap-3 max-w-5xl mx-auto">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white transition-colors flex-shrink-0"
            title="Upload File"
            disabled={!isConnected}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileSelect} 
            multiple 
          />
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isConnected ? "Type a secure message..." : "Waiting for peer connection..."}
              disabled={!isConnected}
              className="w-full bg-slate-900 border border-slate-700 rounded-full pl-5 pr-12 py-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none disabled:opacity-50"
            />
          </div>

          <button 
            onClick={handleSend}
            disabled={(!input.trim() && attachments.length === 0) || !isConnected}
            className="p-3 rounded-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};