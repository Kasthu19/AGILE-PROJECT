import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, clearToken, getToken, setToken } from '../lib/api';
import { Profile } from '../lib/supabase';

interface AuthUser {
  id: string;
  email?: string;
}

interface AuthContextValue {
  session: { token: string } | null;
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<{ token: string } | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshProfile() {
    const result = await api<{ profile: Profile }>('/api/auth/me');
    setProfile(result.profile);
    setUser({ id: result.profile.id });
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setSession({ token });
    refreshProfile()
      .catch(() => {
        clearToken();
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function signIn(email: string, password: string) {
    try {
      const result = await api<{ token: string; profile: Profile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(result.token);
      setSession({ token: result.token });
      setProfile(result.profile);
      setUser({ id: result.profile.id, email });
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Login failed' };
    }
  }

  async function signOut() {
    clearToken();
    setSession(null);
    setUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
