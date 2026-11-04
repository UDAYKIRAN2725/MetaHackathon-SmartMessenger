import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { useChats } from '../ChatStore';
import { initials } from '../auth';
import { Btn } from '../components/common';
import { catLabel, dayLabel, msgTime, ticks, whyLine } from '../format';
import { useTasks } from '../TaskStore';
import AiAssist from './AiAssist';
import ChatTasks from './ChatTasks';
import { isExt } from './Chats';
import { cx } from '../utils';

function Header({ item, onFindTasks, finding }) {
  const { setDrawer } = useApp();
  const { meta } = useChats();
  const ext = isExt(item);
  return (
    <div className="ch">
      <span className={cx('av sm', ext && 'q')}>{ext ? '?' : initials(item.partner.name)}</span>
      <button type="button" onClick={() => setDrawer((d) => !d)}>
        <span className="n">
          {ext ? `+${item.partner.phone}` : item.partner.name} <span className="tag">{catLabel(item.category)}</span>
        </span>
        <span className="s">
          {ext ? `Not in your contacts · says they are “${item.partner.name}”` : whyLine(item, meta?.min_tracked)}
          {' · '}AI assist {item.ai_allowed ? 'allowed' : 'off'}
          {item.ai_rank && ' · ✦ AI priority on'}
          {item.partner_ai_rank && ` · ✦ ${item.partner.name.split(' ')[0]} uses AI priority in this chat`}
        </span>
      </button>
      <div className="r">
        {item.ai_allowed && !ext && (
          <button type="button" className="aib" disabled={finding} onClick={onFindTasks} title="Find follow-ups in recent messages">
            ✦ {finding ? 'Finding…' : 'Find tasks'}
          </button>
        )}
        <Btn onClick={() => setDrawer(true)}>ⓘ Contact info</Btn>
      </div>
    </div>
  );
}

function ExternalBanner({ item }) {
  const { updateContact } = useChats();
  const [err, setErr] = useState('');
  const save = (cat) => updateContact(item.partner.id, { category: cat }).catch((e) => setErr(e.message));
  return (
    <div className="banner" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <b style={{ flex: 1 }}>Unknown contact</b>
        <span className="tag">AI off by default</span>
        <span className="tag">No ranking yet</span>
      </div>
      <div className="note">Save this contact in a category, or keep it in External.{err && ` ${err}`}</div>
      <div className="acts">
        {[['fr', 'Friends'], ['pro', 'Professional'], ['fam', 'Family'], ['rel', 'Relatives']].map(([c, l]) => (
          <button type="button" key={c} className="chip" onClick={() => save(c)}>Save as {l}</button>
        ))}
        <span style={{ flex: 1 }} />
        <Btn kind="ghost" title="Coming soon">Block</Btn>
        <Btn kind="ghost" title="Coming soon">Report</Btn>
      </div>
    </div>
  );
}

export default function ChatView({ id }) {
  const { openModal } = useApp();
  const { byIdOrKey, threads, loadMessages, markRead, send, loading } = useChatView(id);
  const item = byIdOrKey;
  const thread = item ? threads[item.id] : null;
  const [draft, setDraft] = useState('');
  const [assistOpen, setAssistOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [found, setFound] = useState(null); // null | {loading} | {items} | {error}
  const { suggestFromChat, chatSuggestions } = useTasks();
  const box = useRef(null);
  const stick = useRef(true);
  const prevFirst = useRef(null);
  const prevHeight = useRef(0);

  useEffect(() => {
    if (!item) return;
    loadMessages(item.id);
    if (item.unread) markRead(item.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  // Tasks Smart priority found automatically show up when you open the chat.
  useEffect(() => {
    if (!item?.suggestions || found) return;
    chatSuggestions(item.id)
      .then((r) => r.items.length && setFound((f) => f || { items: r.items, auto: true }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, item?.suggestions]);

  // Keep the view pinned to the bottom for new messages, and keep position when older ones load.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !thread) return;
    const first = thread.items[0]?.id;
    if (prevFirst.current && first !== prevFirst.current) el.scrollTop = el.scrollHeight - prevHeight.current;
    else if (stick.current) el.scrollTop = el.scrollHeight;
    prevFirst.current = first;
    prevHeight.current = el.scrollHeight;
  }, [thread?.items]);

  if (!item) {
    return <main className="main"><div className="empty" style={{ flex: 1 }}>{loading ? 'Loading…' : 'Chat not found.'}</div></main>;
  }
  const ext = isExt(item);

  const onScroll = (e) => {
    const el = e.currentTarget;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (el.scrollTop < 40 && thread?.hasMore && !thread.loading) {
      prevHeight.current = el.scrollHeight;
      loadMessages(item.id, true);
    }
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setErr('');
    try {
      await send(item.id, text);
      setDraft('');
      setAssistOpen(false);
      stick.current = true;
    } catch (e) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  };

  const findTasks = async () => {
    setFound({ loading: true });
    try {
      const r = await suggestFromChat(item.id);
      setFound({ items: r.suggestions, scanned: r.scanned });
    } catch (e) {
      setFound({ error: e.message });
    }
  };

  let lastDay = null;
  return (
    <main className="main">
      <Header item={item} onFindTasks={findTasks} finding={!!found?.loading} />

      <div className="msgs" ref={box} onScroll={onScroll}>
        {thread?.hasMore && <span className="day">{thread.loading ? 'Loading…' : 'Scroll up for older messages'}</span>}
        {!thread && <span className="day">Loading…</span>}
        {thread && thread.items.length === 0 && !thread.loading && <span className="day">No messages yet. Say hi 👋</span>}
        {thread?.items.map((m) => {
          const d = dayLabel(m.created_at);
          const showDay = d !== lastDay;
          lastDay = d;
          return (
            <FragmentWithDay key={m.id} day={showDay ? d : null}>
              <div className={cx('b', m.from_me && 'out')}>
                <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</span>
                <small>{msgTime(m.created_at)}{m.from_me && ` ${ticks(m)}`}</small>
              </div>
            </FragmentWithDay>
          );
        })}
      </div>

      {found && <ChatTasks state={found} quietWhenEmpty={found.auto} onClose={() => setFound(null)} />}
      {assistOpen && !ext && <AiAssist item={item} onClose={() => setAssistOpen(false)} onUse={(t) => setDraft(t)} />}
      {ext && <ExternalBanner item={item} />}
      {err && <div className="alert" style={{ margin: '0 18px 10px' }}>{err}</div>}

      <div className="composer">
        <span>☺</span>
        <span>＋</span>
        <input
          className="input"
          maxLength={4000}
          placeholder={ext ? 'Type a message' : 'Type a message, or tap ✦ AI assist for help'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submit()}
        />
        {!ext && (
          <button type="button" className={cx('aib', assistOpen && 'on')} onClick={() => setAssistOpen((o) => !o)}>✦ AI assist</button>
        )}
        {!ext && <button type="button" title="Schedule" onClick={() => openModal('schnew')}>◷</button>}
        <button type="button" className="send" title="Send" onClick={submit} disabled={!draft.trim() || sending}>➤</button>
      </div>
    </main>
  );
}

function FragmentWithDay({ day, children }) {
  return (
    <>
      {day && <span className="day">{day}</span>}
      {children}
    </>
  );
}

function useChatView(key) {
  const c = useChats();
  return { ...c, byIdOrKey: c.resolve(key) };
}
