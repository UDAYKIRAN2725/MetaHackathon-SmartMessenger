import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProvider, useApp } from './AppContext';
import { AuthProvider, useAuth } from './AuthContext';
import { ChatProvider } from './ChatStore';
import { TaskProvider } from './TaskStore';
import AuthPage from './pages/Auth';
import './styles.css';

function ChatBridge({ children }) {
  const { chat, sort } = useApp();
  return <ChatProvider activeKey={chat} sort={sort}>{children}</ChatProvider>;
}

// Signed out -> login/register. New account -> onboarding first. Returning user -> chats.
function Root() {
  const { user, checking, bootError, isNew } = useAuth();
  if (checking) return <div className="app"><div className="empty" style={{ flex: 1 }}>Loading…</div></div>;
  if (!user) return <AuthPage bootError={bootError} />;
  return (
    <AppProvider key={user.id} initialView={isNew ? 'onb' : 'chats'}>
      <ChatBridge>
        <TaskProvider>
          <App />
        </TaskProvider>
      </ChatBridge>
    </AppProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>,
);
