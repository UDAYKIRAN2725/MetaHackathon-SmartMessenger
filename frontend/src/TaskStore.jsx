import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { TZ, api, del, patch, post } from './api';
import { useChats } from './ChatStore';
import { whenLabel } from './paFormat';

export { TZ };

const Ctx = createContext(null);
export const useTasks = () => useContext(Ctx);

function desktopNotify(t) {
  if (document.visibilityState === 'visible' || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(`⏰ ${t.title}`, { body: t.due_at ? `Due ${whenLabel(t.due_at)}` : 'Reminder', tag: t.id });
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}

export function TaskProvider({ children }) {
  const { subscribe } = useChats();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const d = await api('/api/tasks');
      setTasks(d.items);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const upsert = useCallback(
    (t) =>
      setTasks((list) => {
        const i = list.findIndex((x) => x.id === t.id);
        if (i < 0) return [...list, t];
        const next = [...list];
        next[i] = t;
        return next;
      }),
    [],
  );
  const drop = useCallback((id) => setTasks((list) => list.filter((x) => x.id !== id)), []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(
    () =>
      subscribe((evt) => {
        if (evt.type === 'reminder.due') {
          upsert(evt.task);
          desktopNotify(evt.task);
        } else if (evt.type === 'task.updated') upsert(evt.task);
        else if (evt.type === 'task.deleted') drop(evt.id);
        else if (evt.type === 'ws.open') refresh(); // catch up on alerts sent while offline
      }),
    [subscribe, upsert, drop, refresh],
  );

  const act = async (path, body) => {
    const t = await post(path, body);
    upsert(t);
    return t;
  };

  const value = {
    tasks,
    loading,
    error,
    refresh,
    alerts: tasks.filter((t) => t.status === 'open' && t.reminder?.status === 'sent'),
    create: (body) => act('/api/tasks', { tz: TZ, ...body }),
    update: async (id, body) => {
      const t = await patch(`/api/tasks/${id}`, body);
      upsert(t);
      return t;
    },
    remove: async (id) => {
      await del(`/api/tasks/${id}`);
      drop(id);
    },
    done: (id) => act(`/api/tasks/${id}/done`),
    reopen: (id) => act(`/api/tasks/${id}/reopen`),
    snooze: (id, minutes) => act(`/api/tasks/${id}/snooze`, { minutes }),
    dismiss: (id) => act(`/api/tasks/${id}/dismiss`),
    parse: (text, source) => post('/api/pa/parse', { text, source, tz: TZ }),
    suggestFromChat: (convId) => post(`/api/conversations/${convId}/tasks/suggest`, { tz: TZ }),
    events: (id) => api(`/api/tasks/${id}/events`),
    // Tasks found automatically by Smart priority (saved only after the user adds them).
    chatSuggestions: (convId) => api(`/api/conversations/${convId}/suggestions`),
    allSuggestions: () => api('/api/suggestions'),
    dismissSuggestion: (convId, sid) => post(`/api/conversations/${convId}/suggestions/${sid}/dismiss`),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
