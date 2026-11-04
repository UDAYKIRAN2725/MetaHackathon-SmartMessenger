import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { TZ, api, patch, post } from './api';
import { useAuth } from './AuthContext';

const Ctx = createContext(null);
export const useChats = () => useContext(Ctx);

const HEARTBEAT_MS = 30_000;
const ts = (i) => new Date(i.last_message_at).getTime();

// Mirrors the server's sort so live updates keep the same order without refetching.
export function sortItems(items, sort) {
  const list = [...items];
  if (sort === 'recent') return list.sort((a, b) => ts(b) - ts(a));
  return list.sort((a, b) => {
    // final = habit score, shifted by AI urgency only for chats picked in Settings (server computes it).
    const k = (i) => [i.unread === 0 ? 1 : 0, i.final == null ? 1 : 0, -(i.final ?? 0), -ts(i)];
    const ka = k(a), kb = k(b);
    for (let n = 0; n < ka.length; n++) if (ka[n] !== kb[n]) return ka[n] - kb[n];
    return 0;
  });
}

const resolveIn = (items, key) =>
  key
    ? items.find((i) => i.id === key) ||
      items.find((i) => i.partner.name.toLowerCase().startsWith(String(key).toLowerCase()))
    : undefined;

export function ChatProvider({ activeKey, sort, children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const activeId = resolveIn(items, activeKey)?.id ?? null;
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [threads, setThreads] = useState({}); // convId -> { items, hasMore, loading }
  const [online, setOnline] = useState(false);
  const wsRef = useRef(null);
  // Other stores (tasks/reminders) listen to the same WebSocket through this bus.
  const listeners = useRef(new Set());
  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);
  const emit = (evt) => listeners.current.forEach((fn) => fn(evt));
  const activeRef = useRef(activeId);
  const threadsRef = useRef(threads);
  const itemsRef = useRef(items);
  activeRef.current = activeId;
  threadsRef.current = threads;
  itemsRef.current = items;

  const refresh = useCallback(async () => {
    try {
      const d = await api(`/api/conversations?sort=${sort}&tz=${encodeURIComponent(TZ)}`);
      setItems(d.items);
      setMeta(d.meta);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const patchMessages = (convId, fn) =>
    setThreads((t) => (t[convId] ? { ...t, [convId]: { ...t[convId], items: t[convId].items.map(fn) } } : t));

  const markRead = useCallback(async (convId) => {
    setItems((list) => list.map((i) => (i.id === convId ? { ...i, unread: 0 } : i)));
    try {
      await post(`/api/conversations/${convId}/read`);
    } catch {
      /* next refresh corrects the count */
    }
  }, []);

  const loadMessages = useCallback(async (convId, older = false) => {
    const cur = threadsRef.current[convId];
    if (cur?.loading || (older && !cur?.hasMore)) return;
    const before = older && cur?.items.length ? `&before=${cur.items[0].id}` : '';
    setThreads((t) => ({ ...t, [convId]: { items: [], hasMore: false, ...t[convId], loading: true } }));
    try {
      const d = await api(`/api/conversations/${convId}/messages?limit=50${before}`);
      setThreads((t) => ({
        ...t,
        [convId]: { items: older ? [...d.items, ...(t[convId]?.items || [])] : d.items, hasMore: d.has_more, loading: false },
      }));
    } catch (e) {
      setThreads((t) => ({ ...t, [convId]: { ...t[convId], loading: false, error: e.message } }));
    }
  }, []);

  // ---- live events ----
  const onEvent = useCallback(
    (evt) => {
      emit(evt);
      if (evt.type === 'ranking.updated') {
        refresh(); // AI scores or settings changed
      } else if (evt.type === 'message.new') {
        const m = { ...evt.message, from_me: evt.message.sender_id === user.id };
        const convId = m.conversation_id;
        const viewing = activeRef.current === convId && document.visibilityState === 'visible';
        if (!m.from_me) wsRef.current?.send(JSON.stringify({ type: 'ack', ids: [m.id] }));
        setThreads((t) => {
          const th = t[convId];
          if (!th || th.items.some((x) => x.id === m.id)) return t;
          return { ...t, [convId]: { ...th, items: [...th.items, m] } };
        });
        const known = itemsRef.current.some((i) => i.id === convId);
        setItems((list) =>
          list.map((i) =>
            i.id === convId
              ? { ...i, last: m, last_message_at: m.created_at, unread: !m.from_me && !viewing ? i.unread + 1 : i.unread }
              : i,
          ),
        );
        if (!known) refresh();
        if (!m.from_me && viewing) markRead(convId);
      } else if (evt.type === 'message.delivered' || evt.type === 'message.read') {
        const key = evt.type === 'message.read' ? 'read_at' : 'delivered_at';
        const ids = new Set(evt.ids);
        const upd = (m) => (ids.has(m.id) ? { ...m, [key]: evt.at, delivered_at: m.delivered_at || evt.at } : m);
        patchMessages(evt.conversation_id, upd);
        setItems((list) => list.map((i) => (i.id === evt.conversation_id && i.last ? { ...i, last: upd(i.last) } : i)));
      }
    },
    [user.id, refresh, markRead],
  );
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let stop = false;
    let retry = 1000;
    let timer;
    let ping;
    const connect = () => {
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`);
      wsRef.current = ws;
      ws.onopen = () => {
        setOnline(true);
        retry = 1000;
        ping = setInterval(() => ws.readyState === 1 && ws.send('{"type":"ping"}'), 25_000);
        refresh(); // catch up on anything missed while disconnected
        emit({ type: 'ws.open' });
        const a = activeRef.current;
        if (a) loadMessages(a);
      };
      ws.onmessage = (e) => {
        try {
          onEventRef.current(JSON.parse(e.data));
        } catch {
          /* ignore malformed */
        }
      };
      ws.onclose = () => {
        clearInterval(ping);
        setOnline(false);
        if (!stop) timer = setTimeout(connect, (retry = Math.min(retry * 2, 15_000)));
      };
    };
    connect();
    return () => {
      stop = true;
      clearTimeout(timer);
      clearInterval(ping);
      wsRef.current?.close();
    };
  }, [refresh, loadMessages]);

  // ---- time-in-chat heartbeat (only while the chat is open and the tab is visible) ----
  useEffect(() => {
    if (!activeId) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') post(`/api/conversations/${activeId}/heartbeat`).catch(() => {});
    }, HEARTBEAT_MS);
    const onVis = () => document.visibilityState === 'visible' && items.find((i) => i.id === activeId)?.unread && markRead(activeId);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [activeId, items, markRead]);

  const send = async (convId, text) => {
    const m = await post(`/api/conversations/${convId}/messages`, { text });
    setThreads((t) => {
      const th = t[convId] || { items: [], hasMore: false };
      if (th.items.some((x) => x.id === m.id)) return t;
      return { ...t, [convId]: { ...th, items: [...th.items, m] } };
    });
    setItems((list) => list.map((i) => (i.id === convId ? { ...i, last: m, last_message_at: m.created_at } : i)));
    return m;
  };

  const updateContact = async (partnerId, body) => {
    const r = await patch(`/api/contacts/${partnerId}`, body);
    setItems((list) => list.map((i) => (i.partner.id === partnerId ? { ...i, category: r.category, ai_allowed: r.ai_allowed } : i)));
    return r;
  };

  const startChat = async (identifier, category) => {
    const item = await post('/api/conversations', { identifier, category });
    setItems((list) => (list.some((i) => i.id === item.id) ? list : [item, ...list]));
    return item;
  };

  const value = {
    items: sortItems(items, sort),
    meta, loading, error, online, threads,
    refresh, loadMessages, markRead, send, updateContact, startChat, subscribe,
    activeId,
    // Links from the sample PA/Memory pages use short names like "priya" or "mom".
    resolve: (key) => resolveIn(items, key),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
