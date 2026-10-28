import { createContext, useContext, useState } from 'react';
import * as auth from './auth';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => auth.getSession());
  const [isNew, setIsNew] = useState(false); // just registered -> show onboarding first

  const value = {
    user,
    isNew,
    async register(data) {
      const u = await auth.register(data);
      setIsNew(true);
      setUser(u);
    },
    async login(data) {
      const u = await auth.login(data);
      setIsNew(false);
      setUser(u);
    },
    logout() {
      auth.logout();
      setIsNew(false);
      setUser(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
