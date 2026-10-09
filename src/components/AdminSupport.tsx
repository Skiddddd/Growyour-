import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SupportMessage, User } from '../types';

interface AdminSupportProps {
  messages: SupportMessage[];
  users: User[];
  onSend: (target: { userId: string; userEmail: string; userName: string }, text: string) => Promise<void>;
  onMarkRead: (ids: string[]) => void;
}

interface Thread {
  userId: string;
  userEmail: string;
  userName: string;
  messages: SupportMessage[];
  unread: number;
  lastAt: number;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const AdminSupport: React.FC<AdminSupportProps> = ({ messages, users, onSend, onMarkRead }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const threads = useMemo<Thread[]>(() => {
    const map = new Map<string, Thread>();
    messages.forEach((m) => {
      let t = map.get(m.userId);
      if (!t) {
        const profile = users.find((u) => u.id === m.userId);
        t = {
          userId: m.userId,
          userEmail: profile?.email || m.userEmail,
          userName: profile?.fullName || m.userName || m.userEmail,
          messages: [],
          unread: 0,
          lastAt: 0,
        };
        map.set(m.userId, t);
      }
      t.messages.push(m);
      if (m.sender === 'USER' && !m.readByAdmin) t.unread += 1;
      t.lastAt = Math.max(t.lastAt, new Date(m.createdAt).getTime());
    });
    return Array.from(map.values()).sort((a, b) => b.lastAt - a.lastAt);
  }, [messages, users]);

  const selected = threads.find((t) => t.userId === selectedId) || null;

  // Mark the open conversation's incoming messages as read.
  const unreadKey = useMemo(
    () =>
      selected
        ? selected.messages.filter((m) => m.sender === 'USER' && !m.readByAdmin).map((m) => m.id).join(',')
        : '',
    [selected]
  );
  useEffect(() => {
    if (unreadKey) onMarkRead(unreadKey.split(','));
  }, [unreadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [selected?.messages.length, selectedId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || !selected || sending) return;
    setSending(true);
    setError('');
    try {
      await onSend({ userId: selected.userId, userEmail: selected.userEmail, userName: selected.userName }, value);
      setText('');
    } catch (err: any) {
      setError(err?.message || 'Reply could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">Support Inbox</h1>
        <p className="text-sm text-slate-400 mt-1">Read customer messages and reply. New messages appear automatically.</p>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 grid md:grid-cols-[18rem_1fr] h-[calc(100vh-15rem)] min-h-[440px] overflow-hidden">
        {/* Conversation list (hidden on mobile while a thread is open) */}
        <div className={`${selected ? 'hidden md:block' : 'block'} border-r border-slate-800 overflow-y-auto`}>
          {threads.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-500">No customer messages yet.</div>
          )}
          {threads.map((t) => {
            const last = t.messages[t.messages.length - 1];
            const active = t.userId === selectedId;
            return (
              <button
                key={t.userId}
                type="button"
                onClick={() => setSelectedId(t.userId)}
                className={`w-full text-left px-4 py-3 border-b border-slate-800/70 transition ${
                  active ? 'bg-cyan-500/10' : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white truncate">{t.userName}</span>
                  {t.unread > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                      {t.unread}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 truncate font-mono">{t.userEmail}</div>
                <div className="text-xs text-slate-400 truncate mt-1">
                  {last.sender === 'ADMIN' ? 'You: ' : ''}
                  {last.text}
                </div>
              </button>
            );
          })}
        </div>

        {/* Thread */}
        <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-col min-h-0`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              Select a conversation to read and reply.
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="md:hidden text-slate-400 hover:text-white"
                  aria-label="Back to conversations"
                >
                  <i className="fas fa-arrow-left"></i>
                </button>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{selected.userName}</div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">{selected.userEmail}</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selected.messages.map((m) => {
                  const mine = m.sender === 'ADMIN';
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                          mine
                            ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-50 rounded-br-md'
                            : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-bl-md'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
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

              <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={1000}
                  placeholder="Type your reply..."
                  className="flex-1 min-w-0 bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-400 text-slate-950 hover:brightness-110 transition disabled:opacity-40"
                >
                  {sending ? <span className="inline-block w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin"></span> : <i className="fas fa-paper-plane"></i>}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSupport;
