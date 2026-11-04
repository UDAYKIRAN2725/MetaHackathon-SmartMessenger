import { createContext, useContext, useState } from 'react';
import * as D from './data';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

// Navigation state, plus sample data for the one feature not yet on the backend (Scheduled).
// Memory pages load their data from the API directly.
// Chats live in ChatStore; tasks and reminders live in TaskStore.
export function AppProvider({ children, initialView = 'onb' }) {
  const [view, setView] = useState(initialView); // onb | chats | pa | rem | sch | mem | set
  const [chat, setChat] = useState(null); // open chat id within "chats"
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState(null); // voice | panew | schnew
  const [notesOpen, setNotesOpen] = useState(false);

  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState('smart');
  const [paTab, setPaTab] = useState('today');
  const [remTab, setRemTab] = useState('up');
  const [remSel, setRemSel] = useState(null);
  const [schTab, setSchTab] = useState('act');
  const [memTab, setMemTab] = useState('ppl');
  const [memPerson, setMemPerson] = useState(null); // contact user id

  const [scheduled, setScheduled] = useState(D.SCHEDULED);
  const [schPaused, setSchPaused] = useState(false);

  const go = (v, c = null) => {
    setView(v);
    setChat(c);
    setDrawer(false);
    setModal(null);
  };
  const openChat = (id) => go('chats', id);
  // voice / panew open on the Assistant page; schnew on Scheduled.
  const openModal = (m) => {
    go(m === 'schnew' ? 'sch' : 'pa');
    setModal(m);
  };

  const value = {
    view, chat, drawer, modal, notesOpen,
    setDrawer, setModal, setNotesOpen,
    go, openChat, openModal,
    cat, setCat, sort, setSort, paTab, setPaTab, remTab, setRemTab, remSel, setRemSel,
    schTab, setSchTab, memTab, setMemTab, memPerson, setMemPerson,
    scheduled, setScheduled, schPaused, setSchPaused,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
