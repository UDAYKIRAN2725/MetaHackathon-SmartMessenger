import { useApp } from './AppContext';
import Strip from './components/Strip';
import Rail from './components/Rail';
import ReminderAlerts from './components/ReminderAlerts';
import Onboarding from './pages/Onboarding';
import Assumptions from './components/Assumptions';
import { ChatsList, ChatsHome } from './pages/Chats';
import ChatView from './pages/ChatView';
import ContactDrawer from './pages/ContactDrawer';
import { AssistantList, AssistantMain } from './pages/Assistant';
import { RemindersList, ReminderDetail } from './pages/Reminders';
import { ScheduledList, ScheduledDetail, NewScheduleModal } from './pages/Scheduled';
import { MemoryPage } from './pages/Memory';
import { SettingsList, SettingsMain } from './pages/Settings';

export default function App() {
  const { view, chat, drawer, modal, notesOpen } = useApp();

  return (
    <div className="app">
      <Strip />
      {view === 'onb' ? (
        <Onboarding />
      ) : (
        <div className="shell">
          <Rail />

          {view === 'chats' && (
            <>
              <ChatsList />
              {chat ? <ChatView key={chat} id={chat} /> : <ChatsHome />}
              {chat && drawer && <ContactDrawer chatKey={chat} />}
            </>
          )}
          {view === 'pa' && (
            <>
              <AssistantList />
              <AssistantMain />
            </>
          )}
          {view === 'rem' && (
            <>
              <RemindersList />
              <ReminderDetail />
            </>
          )}
          {view === 'sch' && (
            <>
              <ScheduledList />
              <ScheduledDetail />
            </>
          )}
          {view === 'mem' && <MemoryPage />}
          {view === 'set' && (
            <>
              <SettingsList />
              <SettingsMain />
            </>
          )}

          {modal === 'schnew' && <NewScheduleModal />}
          <ReminderAlerts />
        </div>
      )}
      {notesOpen && <Assumptions />}
    </div>
  );
}
