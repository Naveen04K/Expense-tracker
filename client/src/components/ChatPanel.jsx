import { useState, useRef, useEffect } from 'react';
import api from '../api';

const SUGGESTIONS = [
  'I spent ₹350 on lunch at Zomato today',
  'Add ₹500 groceries from DMart yesterday',
  'How much did I spend this month?',
  'Show my top expenses this week',
  'Compare this month vs last month',
  'Set food budget to ₹5000',
  'Delete my last expense',
  'Give me spending insights',
];

export default function ChatPanel({ onExpenseChange }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi! I'm your AI expense assistant 👋\n\nI can add, view, update, or delete your expenses through natural conversation. Try:\n• "I spent ₹200 on coffee today"\n• "How much did I spend on food this month?"\n• "Show my top 5 expenses"\n• "Delete my last expense"`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('Voice input is not supported in this browser.');

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
          setInput(prev => (prev ? prev + ' ' : '') + event.results[i][0].transcript);
        }
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setShowSuggestions(false);
    setMessages(prev => [...prev, { role: 'user', content: `[Uploaded receipt: ${file.name}]` }]);
    setLoading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result.split(',')[1];
          const mimeType = file.type;

          const { data } = await api.post('/chat/ocr', { imageBase64: base64Data, mimeType });
          setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
          onExpenseChange?.();
        } catch(err) {
          setMessages(prev => [...prev, { role: 'assistant', content: err.response?.data?.error || 'Failed to process receipt.' }]);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setInput('');
    setShowSuggestions(false);
    const userMsg = { role: 'user', content: msg };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    try {
      // Build API message history (skip first assistant greeting)
      const apiMessages = updated
        .slice(1)
        .map(m => ({ role: m.role, content: m.content }));

      const { data } = await api.post('/chat', { messages: apiMessages });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      onExpenseChange?.();
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.response?.data?.error || 'Something went wrong. Please try again.'
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const formatMessage = (text) => {
    // Convert newlines to breaks and simple markdown-ish formatting
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line.startsWith('•') || line.startsWith('-')
          ? <span style={{ display: 'block', paddingLeft: 4 }}>{line}</span>
          : line}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)', overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--surface)'
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--accent)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 16
        }}>🤖</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>AI Assistant</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {loading ? 'Thinking...' : 'Online'}
          </div>
        </div>
        <button
          onClick={() => {
            setMessages([messages[0]]);
            setShowSuggestions(true);
          }}
          title="Clear conversation"
          style={{
            marginLeft: 'auto', background: 'none', padding: '4px 8px',
            color: 'var(--text-faint)', fontSize: 12,
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)'
          }}
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            className="animate-slide"
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            {msg.role === 'assistant' && (
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'var(--accent)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 13, flexShrink: 0, marginRight: 8, marginTop: 2
              }}>🤖</div>
            )}
            <div style={{
              maxWidth: '82%',
              padding: '9px 13px',
              borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '4px 12px 12px 12px',
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg)',
              color: msg.role === 'user' ? '#fff' : 'var(--text)',
              fontSize: 13, lineHeight: 1.6,
              border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none'
            }}>
              {formatMessage(msg.content)}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'var(--accent)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 13
            }}>🤖</div>
            <div style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: '4px 12px 12px 12px',
              padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center'
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--text-faint)',
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {showSuggestions && messages.length <= 1 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8, textAlign: 'center' }}>
              Try asking...
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SUGGESTIONS.slice(0, 4).map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  style={{
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', padding: '7px 10px',
                    fontSize: 12, color: 'var(--text-muted)', textAlign: 'left',
                    cursor: 'pointer', transition: 'border-color 0.15s'
                  }}
                  onMouseEnter={e => e.target.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.target.style.borderColor = 'var(--border)'}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 12px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 8, background: 'var(--surface)', alignItems: 'center'
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={isListening ? "Listening..." : "Ask or add expenses..."}
          disabled={loading || isListening}
          style={{ flex: 1, fontSize: 13, padding: '8px 12px', borderRadius: 8 }}
        />
        <button
          title="Voice Input"
          onClick={toggleListening}
          style={{
            padding: '8px', background: 'transparent',
            color: isListening ? 'var(--red)' : 'var(--text-muted)',
            borderRadius: 8, cursor: 'pointer', transition: '0.2s', fontSize: 16
          }}
        >
          {isListening ? '🔴' : '🎤'}
        </button>
        <input
          type="file"
          accept="image/*"
          hidden
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
        <button
          title="Upload Receipt"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || isListening}
          style={{
            padding: '8px', background: 'transparent',
            color: 'var(--text-muted)',
            borderRadius: 8, cursor: 'pointer', transition: '0.2s', fontSize: 16
          }}
        >
          📷
        </button>
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading || isListening}
          style={{
            padding: '8px 14px',
            background: input.trim() && !loading && !isListening ? 'var(--accent)' : 'var(--border)',
            color: input.trim() && !loading && !isListening ? '#fff' : 'var(--text-faint)',
            borderRadius: 8, fontSize: 13, fontWeight: 500,
            transition: 'all 0.15s', whiteSpace: 'nowrap'
          }}
        >
          Send
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
