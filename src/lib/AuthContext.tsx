/**
 * AuthContext.tsx — Contexte d'authentification FANISA
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UtilisateurConnecte, Permissions,
  login as doLogin, logout as doLogout,
  restaurerSession, getPermissions
} from './auth';

interface AuthContextValue {
  user: UtilisateurConnecte | null;
  permissions: Permissions | null;
  loading: boolean;
  login: (nom: string, mdp: string) => Promise<string | null>;  // retourne erreur ou null
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, permissions: null, loading: true,
  login: async () => null, logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UtilisateurConnecte | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = restaurerSession();
    if (session) setUser(session);
    setLoading(false);
  }, []);

  const handleLogin = async (nom: string, mdp: string): Promise<string | null> => {
    const { user: u, erreur } = await doLogin(nom, mdp);
    if (u) { setUser(u); return null; }
    return erreur;
  };

  const handleLogout = () => {
    doLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      permissions: user ? getPermissions(user.role) : null,
      loading,
      login: handleLogin,
      logout: handleLogout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
