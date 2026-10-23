import { createContext, useContext, useEffect, useState } from 'react';
import api from './api';

const Ctx = createContext(null); // check authentication data
export const useAuth = () => useContext(Ctx); // use context data in components

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((r) => setUser(r.data.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.data.token);
    setUser(data.data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return <Ctx.Provider value={{ user, setUser, loading, login, logout }}>{children}</Ctx.Provider>;
}