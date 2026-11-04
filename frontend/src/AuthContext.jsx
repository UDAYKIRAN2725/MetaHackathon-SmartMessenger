import { createContext, useContext, useEffect, useState } from 'react';
import * as auth from './auth';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [bootError, setBootError] = useState('');
  const [isNew, setIsNew] = useState(false); // just registered -> show onboarding first

  useEffect(() => {
    auth
      .getSession()
      .then(setUser)
      .catch((e) => setBootError(e.message))
      .finally(() => setChecking(false));
  }, []);

  const value = {
    user,
    checking,
    bootError,
    isNew,
    async register(data) {
      const u = await auth.register(data);
      setIsNew(true);
      setUser(u);
    },
    async login(data) {
      const u = await auth.login(data);
      setIsNew(false);
      setBootError('');
      setUser(u);
    },
    async logout() {
      try {
        await auth.logout();
      } finally {
        setIsNew(false);
        setUser(null);
      }
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
