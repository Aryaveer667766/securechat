import React, { useEffect, useRef, useState } from 'react';

interface LiveInterfaceProps {
  peer: any;
  targetPeerId: string;
  incomingCall: any;
  onCallEnd: () => void;
}

export const LiveInterface: React.FC<LiveInterfaceProps> = ({ peer, targetPeerId, incomingCall, onCallEnd }) => {
  const [callActive, setCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStatus, setCallStatus] = useState('Ready to call');
  
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const peerVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callRef = useRef<any>(null);

  useEffect(() => {
    // If there is an incoming call when we mount this component, answer it
    if (incomingCall) {
      answerCall(incomingCall);
    }
    return () => {
       endCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle new incoming calls while component is mounted
  useEffect(() => {
      if (incomingCall && !callActive) {
          answerCall(incomingCall);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingCall]);

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error("Failed to get local stream", err);
      setCallStatus("Error: Could not access camera/mic");
      return null;
    }
  };

  const startCall = async () => {
    setCallStatus("Starting stream...");
    const stream = await startLocalStream();
    if (!stream || !peer) return;

    setCallStatus("Calling...");
    const call = peer.call(targetPeerId, stream);
    setupCallEventHandlers(call);
  };

  const answerCall = async (call: any) => {
    setCallStatus("Answering...");
    const stream = await startLocalStream();
    if (stream) {
        call.answer(stream);
        setupCallEventHandlers(call);
    }
  };

  const setupCallEventHandlers = (call: any) => {
    callRef.current = call;
    setCallActive(true);
    setCallStatus("Connected");

    call.on('stream', (remoteStream: MediaStream) => {
      if (peerVideoRef.current) {
        peerVideoRef.current.srcObject = remoteStream;
      }
    });

    call.on('close', () => {
      endCall();
    });

    call.on('error', () => {
      endCall();
    });
  };

  const endCall = () => {
    if (callRef.current) {
      callRef.current.close();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setCallActive(false);
    setIsScreenSharing(false);
    setCallStatus("Call ended");
    callRef.current = null;
    onCallEnd();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!callActive || !callRef.current) return;

    if (isScreenSharing) {
      // Revert to Camera
      // Stop screen tracks
      const screenTrack = localStreamRef.current?.getVideoTracks()[0];
      if(screenTrack) screenTrack.stop();

      const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const videoTrack = newStream.getVideoTracks()[0];
      
      // Replace track in peer connection
      const sender = callRef.current.peerConnection.getSenders().find((s: any) => s.track.kind === 'video');
      if(sender) sender.replaceTrack(videoTrack);
      
      // Update local view
      if (localStreamRef.current) {
          // keep audio track, replace video
          const oldVideo = localStreamRef.current.getVideoTracks()[0];
          localStreamRef.current.removeTrack(oldVideo);
          localStreamRef.current.addTrack(videoTrack);
          if (myVideoRef.current) myVideoRef.current.srcObject = localStreamRef.current;
      }
      
      setIsScreenSharing(false);

    } else {
      // Start Screen Share
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        screenTrack.onended = () => {
             toggleScreenShare(); // Revert if user stops via browser UI
        };

        const sender = callRef.current.peerConnection.getSenders().find((s: any) => s.track.kind === 'video');
        if(sender) sender.replaceTrack(screenTrack);

        // Update local view
        if (localStreamRef.current) {
            const oldVideo = localStreamRef.current.getVideoTracks()[0];
            // Don't stop old video yet in case we switch back, actually we should usually stop camera to save resource
            // But here we just replace logic
            oldVideo.stop();
            localStreamRef.current.removeTrack(oldVideo);
            localStreamRef.current.addTrack(screenTrack);
            if (myVideoRef.current) myVideoRef.current.srcObject = localStreamRef.current;
        }

        setIsScreenSharing(true);
      } catch (e) {
        console.error("Screen share cancelled");
      }
    }
  };

  return (
    <div className="flex flex-col h-full p-6 bg-slate-900 text-white">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Video Conference</h2>
          <p className="text-slate-400">{callStatus}</p>
        </div>
        <div className="flex items-center gap-2">
            {callActive && <span className="flex h-3 w-3 rounded-full bg-green-500 animate-pulse"></span>}
            <span className="text-sm font-mono text-slate-400">{callActive ? 'SECURE CALL ACTIVE' : 'IDLE'}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        {/* Main Peer Video */}
        <div className="flex-1 relative bg-slate-800 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col justify-center items-center group">
          <video 
            ref={peerVideoRef}
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
          {!callActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
                  <div className="text-center">
                       <div className="w-20 h-20 bg-slate-700 rounded-full mx-auto flex items-center justify-center mb-4">
                           <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                       </div>
                       <p className="text-slate-400">Waiting for call...</p>
                  </div>
              </div>
          )}

          {/* Local Video PiP */}
          <div className="absolute top-4 right-4 w-48 h-36 bg-slate-900 rounded-xl overflow-hidden border-2 border-slate-700 shadow-xl">
             <video 
                ref={myVideoRef}
                autoPlay 
                playsInline 
                muted 
                className={`w-full h-full object-cover transform scale-x-[-1] ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
             />
             {isVideoOff && (
                 <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                     <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                 </div>
             )}
          </div>

          {/* Controls */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 px-6 py-3 bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-700">
             {!callActive ? (
                <button 
                    onClick={startCall}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-full font-semibold transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    Start Call
                </button>
             ) : (
                <>
                 <button 
                    onClick={toggleMute}
                    className={`p-3 rounded-full transition-colors ${isMuted ? 'bg-red-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                 >
                    {isMuted ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    )}
                 </button>

                 <button 
                    onClick={toggleVideo}
                    className={`p-3 rounded-full transition-colors ${isVideoOff ? 'bg-red-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                 >
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                 </button>

                 <button 
                    onClick={toggleScreenShare}
                    className={`p-3 rounded-full transition-colors ${isScreenSharing ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                 >
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                 </button>

                 <button 
                    onClick={endCall}
                    className="p-3 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors"
                 >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" /></svg>
                 </button>
                </>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};