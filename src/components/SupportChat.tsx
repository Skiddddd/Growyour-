import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SupportMessage } from '../types';
import { compressImage } from '../lib/image';
import ChatImage from './ChatImage';

interface SupportChatProps {
  messages: SupportMessage[];
  available: boolean;
  onSend: (text: string, imageData?: string) => Promise<void>;
  onMarkRead: (ids: string[]) => void;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const SupportChat: React.FC<SupportChatProps> = ({ messages, available, onSend, onMarkRead }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Mark admin replies as read while this screen is open.
  const unreadKey = useMemo(
    () => messages.filter((m) => m.sender === 'ADMIN' && !m.readByUser).map((m) => m.id).join(','),
    [messages]
  );
  useEffect(() => {
    if (unreadKey) onMarkRead(unreadKey.split(','));
  }, [unreadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setProcessing(true);
    try {
      setImage(await compressImage(file));
    } catch (err: any) {
      setError(err?.message || 'Could not use that image.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if ((!value && !image) || sending) return;
    setSending(true);
    setError('');
    try {
      await onSend(value, image || undefined);
      setText('');
      setImage(null);
    } catch (err: any) {
      setError(err?.message || 'Message could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">Customer Support</h1>
        <p className="text-sm text-slate-400 mt-1">
          Send us a message and our support team will reply here. Replies show up automatically.
        </p>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 flex flex-col h-[calc(100vh-15rem)] min-h-[420px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!available && (
            <div className="text-center text-xs text-slate-500 py-10">
              Support chat is currently unavailable. Please try again later.
            </div>
          )}

          {available && messages.length === 0 && (
            <div className="text-center py-10">
              <div className="w-12 h-12 mx-auto rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 mb-3">
                <i className="fas fa-headset"></i>
              </div>
              <p className="text-sm font-semibold text-white">How can we help?</p>
              <p className="text-xs text-slate-500 mt-1">Ask about deposits, withdrawals or your account.</p>
            </div>
          )}

          {messages.map((m) => {
            const mine = m.sender === 'USER';
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-50 rounded-br-md'
                      : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-bl-md'
                  }`}
                >
                  {!mine && <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-0.5">Support Team</div>}
                  {m.imageData && <ChatImage src={m.imageData} />}
                  {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                  <div className="text-[10px] text-slate-500 mt-1 text-right">{formatTime(m.createdAt)}</div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="mx-4 mb-2 p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">{error}</div>
        )}

        {image && (
          <div className="mx-3 mb-2 p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
            <img src={image} alt="Selected" className="w-14 h-14 object-cover rounded-lg" />
            <span className="text-xs text-slate-400 flex-1">Photo ready to send</span>
            <button
              type="button"
              onClick={() => setImage(null)}
              aria-label="Remove photo"
              className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 hover:text-white"
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800 flex gap-2">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!available || processing || sending}
            aria-label="Attach a photo"
            className="px-3 py-2.5 rounded-xl text-slate-300 bg-slate-800 border border-slate-700 hover:text-cyan-300 transition disabled:opacity-40"
          >
            {processing ? <span className="inline-block w-4 h-4 border-2 border-slate-500/40 border-t-slate-300 rounded-full animate-spin"></span> : <i className="fas fa-image"></i>}
          </button>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            disabled={!available}
            placeholder="Type your message..."
            className="flex-1 min-w-0 bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!available || sending || processing || (!text.trim() && !image)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-cyan-400 text-slate-950 hover:brightness-110 transition disabled:opacity-40"
          >
            {sending ? <span className="inline-block w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin"></span> : <i className="fas fa-paper-plane"></i>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SupportChat;
