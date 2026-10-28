import { useApp } from './AppContext';
import Strip from './components/Strip';
import Rail from './components/Rail';
import Onboarding from './pages/Onboarding';
import Assumptions from './components/Assumptions';
import { ChatsList, ChatsHome } from './pages/Chats';
import ChatView from './pages/ChatView';
import ContactDrawer from './pages/ContactDrawer';
import { AssistantList, AssistantMain, VoiceModal, VoiceConfirmModal, NewTaskModal, ReminderToast } from './pages/Assistant';
import { RemindersList, ReminderDetail } from './pages/Reminders';
import { ScheduledList, ScheduledDetail, NewScheduleModal } from './pages/Scheduled';
import { MemoryList, MemoryMain } from './pages/Memory';
import { SettingsList, SettingsMain } from './pages/Settings';

export default function App() {
  const { view, chat, drawer, modal, toast, notesOpen } = useApp();

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
              {chat === 'priya' && drawer && <ContactDrawer />}
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
          {view === 'mem' && (
            <>
              <MemoryList />
              <MemoryMain />
            </>
          )}
          {view === 'set' && (
            <>
              <SettingsList />
              <SettingsMain />
            </>
          )}

          {modal === 'voice' && <VoiceModal />}
          {modal === 'voice2' && <VoiceConfirmModal />}
          {modal === 'panew' && <NewTaskModal />}
          {modal === 'schnew' && <NewScheduleModal />}
          {toast && <ReminderToast />}
        </div>
      )}
      {notesOpen && <Assumptions />}
    </div>
  );
}
