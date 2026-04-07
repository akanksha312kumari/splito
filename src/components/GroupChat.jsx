import { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

export default function GroupChat({ groupId }) {
  const { user } = useAuth();
  const socket = useSocket();
  const toast = useToast();

  const { data: initialMessages, loading, error, refetch } = useApi(`/groups/${groupId}/messages`, []);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const typingTimerRef = useRef(null);
  const fileRef = useRef(null);
  const bottomRef = useRef(null);

  // Initialize messages from history
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
        // Scroll slightly delayed to ensure rendering
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [initialMessages]);

  // Socket listening
  useEffect(() => {
    if (!socket || !groupId) return;

    socket.emit('join_group', groupId);

    const handleNewMessage = (msg) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTypingUser(null); // Clear typing when message arrives
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    const handleTyping = ({ userName }) => {
      setTypingUser(userName);
    };

    const handleStopTyping = () => {
      setTypingUser(null);
    };

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleTyping);
    socket.on('user_stop_typing', handleStopTyping);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleTyping);
      socket.off('user_stop_typing', handleStopTyping);
      socket.emit('leave_group', groupId);
    };
  }, [socket, groupId]);

  const handleSend = async () => {
    if (!text.trim()) return;
    
    const messageText = text.trim();
    setText('');
    
    // Stop typing immediately on send
    if (socket) socket.emit('stop_typing', { groupId });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    try {
      // Just post it, the server broadcasts 'new_message' instantly
      await api.post(`/groups/${groupId}/messages`, { text: messageText });
    } catch (err) {
      toast.error('Failed to send message');
    }
  };

  const onInputChange = (val) => {
    setText(val);
    if (!socket) return;

    // Emit typing event
    socket.emit('typing', { groupId, userName: user.name });

    // Stop after 3 seconds of no activity
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit('stop_typing', { groupId });
    }, 3000);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('attachment', file);
      const res = await api.upload(`/groups/${groupId}/messages/attach`, form);
      // Immediately send message with attachment
      await api.post(`/groups/${groupId}/messages`, { text: '', attachment_url: res.attachment_url });
    } catch (err) {
      toast.error(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
      fileRef.current.value = '';
    }
  };

  if (loading && messages.length === 0) return <div className="card" style={{ padding: '2rem', textAlign: 'center' }}><span className="spin">⏳</span> Loading chat...</div>;
  if (error) return <div className="card text-error" style={{ padding: '1rem' }}>{error}</div>;

  return (
    <div className="card flex flex-col" style={{ height: '500px', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--on-surface-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>💬</div>
            <p>No messages yet. Say hi!</p>
          </div>
        ) : (
          messages.map(m => {
            const isMe = m.user_id === user.id;
            return (
              <div key={m.id} style={{ display: 'flex', gap: '0.75rem', alignSelf: isMe ? 'flex-end' : 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row', maxWidth: '85%' }}>
                {/* Avatar */}
                <div className="avatar avatar-sm" style={{ background: m.avatar ? 'none' : `hsl(${(m.name?.charCodeAt(0) || 0) * 37 % 360}, 60%, 55%)`, flexShrink: 0 }}>
                  {m.avatar ? <img src={m.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (m.name?.[0] || '?')}
                </div>

                {/* Bubble Wrapper */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-faint)', marginBottom: '2px', padding: '0 4px' }}>
                    {isMe ? 'You' : m.name}
                  </span>
                  <div style={{
                    background: isMe ? 'var(--primary)' : 'var(--surface-low)',
                    color: isMe ? 'var(--on-primary)' : 'var(--on-surface)',
                    padding: '0.625rem 1rem',
                    borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    boxShadow: isMe ? '0 2px 8px rgba(232,164,0,0.2)' : 'none',
                    fontSize: '0.9375rem',
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                  }}>
                    {m.attachment_url && (
                      <div style={{ marginBottom: m.text ? '0.5rem' : 0, borderRadius: '8px', overflow: 'hidden' }}>
                        <img src={m.attachment_url} alt="Attachment" style={{ maxWidth: '100%', maxHeight: 200, display: 'block' }} />
                      </div>
                    )}
                    {m.text && <span>{m.text}</span>}
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--on-surface-faint)', marginTop: '4px' }}>
                    {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        {uploading && (
           <div style={{ display: 'flex', gap: '0.75rem', alignSelf: 'flex-end', flexDirection: 'row-reverse', maxWidth: '85%' }}>
              <div className="avatar avatar-sm" style={{ flexShrink: 0 }}>{(user.name?.[0] || 'Y')}</div>
              <div style={{ background: 'var(--primary)', color: 'var(--on-primary)', padding: '0.625rem 1rem', borderRadius: '16px 16px 4px 16px', opacity: 0.7 }}>
                <span className="spin" style={{ display: 'inline-block' }}>⏳</span> Uploading...
              </div>
           </div>
        )}
         {typingUser && (
           <div style={{ display: 'flex', gap: '0.75rem', alignSelf: 'flex-start', maxWidth: '85%' }}>
              <div className="avatar avatar-sm" style={{ flexShrink: 0, background: 'var(--surface-low)' }}><Bot size={14} /></div>
              <div style={{ background: 'var(--surface-low)', padding: '0.5rem 1rem', borderRadius: '16px 16px 16px 4px', fontSize: '0.8125rem' }}>
                <span style={{ fontWeight: 600 }}>{typingUser}</span> is typing<span className="typing-dots"><span>.</span><span>.</span><span>.</span></span>
              </div>
           </div>
         )}
        <div ref={bottomRef} />
      </div>

      <style>{`
        .typing-dots span {
          animation: blink 1.4s infinite both;
        }
        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes blink {
          0% { opacity: 0.2; }
          20% { opacity: 1; }
          100% { opacity: 0.2; }
        }
      `}</style>

      {/* Input Area */}
      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--surface-mid)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface)' }}>
        <input 
          type="file" 
          ref={fileRef} 
          accept="image/*" 
          style={{ display: 'none' }} 
          onChange={e => handleFileUpload(e.target.files?.[0])}
        />
        <button 
          className="btn btn-ghost btn-icon" 
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Attach Photo"
          style={{ color: 'var(--on-surface-muted)' }}
        >
          <ImageIcon size={20} />
        </button>

        <input
          type="text"
          className="input"
          placeholder="Type a message..."
          value={text}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          style={{ flex: 1, height: '40px', borderRadius: '20px', paddingLeft: '1rem', border: '1px solid var(--surface-mid)', background: 'var(--surface-high)' }}
        />

        <button 
          className="btn btn-primary btn-icon"
          style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={handleSend}
          disabled={!text.trim() && !uploading}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
