import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProvider } from './AppContext';
import { AuthProvider, useAuth } from './AuthContext';
import AuthPage from './pages/Auth';
import './styles.css';

// Signed out -> login/register. New account -> onboarding first. Returning user -> chats.
function Root() {
  const { user, isNew } = useAuth();
  if (!user) return <AuthPage />;
  return (
    <AppProvider key={user.id} initialView={isNew ? 'onb' : 'chats'}>
      <App />
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
