import { createContext, useContext, useState } from 'react';
import * as D from './data';
import { buildTaskAndReminder } from './utils';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  // Navigation
  const [view, setView] = useState('onb'); // onb | chats | pa | rem | sch | mem | set
  const [chat, setChat] = useState(null); // open chat id within "chats"
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState(null); // voice | voice2 | panew | schnew
  const [toast, setToast] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  // Sub-navigation that persists while moving between pages
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState('smart');
  const [paTab, setPaTab] = useState('today');
  const [remTab, setRemTab] = useState('up');
  const [remSel, setRemSel] = useState('meds');
  const [schTab, setSchTab] = useState('act');
  const [memTab, setMemTab] = useState('ppl');
  const [memPerson, setMemPerson] = useState('priya');

  // Data
  const [messages, setMessages] = useState(D.MESSAGES);
  const [priyaSent, setPriyaSent] = useState(false);
  const [aiAllowed, setAiAllowed] = useState(D.AI_ALLOWED);
  const [tasks, setTasks] = useState(D.TASKS);
  const [reminders, setReminders] = useState(D.REMINDERS);
  const [taskAdded, setTaskAdded] = useState(false);
  const [savedBanners, setSavedBanners] = useState([]); // [{id, title, when}]
  const [scheduled, setScheduled] = useState(D.SCHEDULED);
  const [schPaused, setSchPaused] = useState(false);
  const [memory, setMemory] = useState(D.MEMORY);
  const [rules, setRules] = useState(D.RULES);

  const go = (v, c = null) => {
    setView(v);
    setChat(c);
    setDrawer(false);
    setModal(null);
    setToast(false);
  };
  const openChat = (id) => go('chats', id);
  const openModal = (m) => {
    go(m === 'schnew' ? 'sch' : 'pa');
    setModal(m);
  };
  const setAi = (id, on) => setAiAllowed((a) => ({ ...a, [id]: on }));

  const sendMessage = (chatId, text) => {
    const add = [{ out: true, text, time: `${D.CLOCK} ✓` }];
    if (chatId === 'priya' && !priyaSent) {
      add.push({ sys: 'promise' });
      setPriyaSent(true);
    }
    setMessages((m) => ({ ...m, [chatId]: [...m[chatId], ...add] }));
  };

  const addQ3Task = () => {
    if (taskAdded) return;
    setTaskAdded(true);
    setTasks((t) => [D.Q3_TASK, ...t]);
    setReminders((r) => [D.Q3_REMINDER, ...r]);
  };

  const saveTask = (input) => {
    const { task, reminder } = buildTaskAndReminder(input);
    setTasks((t) => [...t, task]);
    if (reminder) setReminders((r) => [...r, reminder]);
    setSavedBanners((b) => [...b, { id: task.id, tag: input.tag, title: task.title, when: task.time }]);
  };

  const toggleTask = (id) => setTasks((t) => t.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));

  const updateReminder = (id, patch) => setReminders((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const markReminderDone = (id) =>
    updateReminder(id, { status: 'done', icon: '✓', read: true, now: false, timeU: false, sub: `Marked done ${D.CLOCK} AM` });
  const deleteReminder = (id) => setReminders((r) => r.filter((x) => x.id !== id));

  const value = {
    view, chat, drawer, modal, toast, notesOpen,
    setDrawer, setModal, setToast, setNotesOpen,
    go, openChat, openModal,
    cat, setCat, sort, setSort, paTab, setPaTab, remTab, setRemTab, remSel, setRemSel,
    schTab, setSchTab, memTab, setMemTab, memPerson, setMemPerson,
    messages, sendMessage, priyaSent,
    aiAllowed, setAi,
    tasks, toggleTask, taskAdded, addQ3Task, saveTask, savedBanners,
    reminders, updateReminder, markReminderDone, deleteReminder,
    scheduled, setScheduled, schPaused, setSchPaused,
    memory, setMemory, rules, setRules,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
