import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, type AppUser } from '../services/authService';

interface AuthContextType {
  user: AppUser | null;
  userRole: 'teacher' | 'student' | null;
  loading: boolean;
  /** Signed in with Google for the first time: must choose teacher or student. */
  needsRole: boolean;
  chooseRole: (role: 'teacher' | 'student') => Promise<'teacher' | 'student'>;
  setUserRole: (role: 'teacher' | 'student') => void;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [userRole, setUserRoleState] = useState<'teacher' | 'student' | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsRole, setNeedsRole] = useState(false);

  const fetchRole = async (uid: string) => {
    try {
      const state = await authService.getRoleState(uid);
      setUserRoleState(state.role);
      setNeedsRole(state.needsChoice);
    } catch (error) {
      console.warn('Could not resolve the account role', error);
      setUserRoleState(null);
      setNeedsRole(false);
    }
  };

  const chooseRole = async (role: 'teacher' | 'student') => {
    const stored = await authService.chooseRole(role);
    setUserRoleState(stored);
    setNeedsRole(false);
    return stored;
  };

  useEffect(() => {
    const unsubscribe = authService.subscribeToAuthState(async (currentUser) => {
      setUser(currentUser);
      if (currentUser && 'id' in currentUser) {
        await fetchRole(currentUser.id);
      } else {
        setUserRoleState(null);
        setNeedsRole(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // This setter is only for synchronizing the role returned by the authenticated
  // server lookup after sign-in/sign-up. It must never be used as an authorization
  // mechanism or persisted from arbitrary client input.
  const setUserRole = (role: 'teacher' | 'student') => {
    setUserRoleState(role);
  };

  const refreshAuth = async () => {
    if (user && 'id' in user) {
      await fetchRole(user.id);
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setUserRoleState(null);
    setNeedsRole(false);
  };

  return (
    <AuthContext.Provider value={{ user, userRole, loading, needsRole, chooseRole, setUserRole, refreshAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
