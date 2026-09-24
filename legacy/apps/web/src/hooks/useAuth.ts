'use client';

import { create } from 'zustand';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AuthStore {
  user: any | null;
  setUser: (user: any) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));

export function useAuth() {
  const { user, setUser, clearUser } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['auth-profile'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/v1/auth/me');
        setUser(response.data);
        return response.data;
      } catch (error) {
        clearUser();
        throw error;
      }
    },
    enabled: typeof window !== 'undefined' && !!localStorage.getItem('accessToken'),
    retry: false,
  });

  const activeUser = user || data;
  const roles: string[] = activeUser?.userRoles?.map((ur: any) => ur.role.slug) || activeUser?.roles || [];

  return {
    user: activeUser,
    isLoading,
    isAuthenticated: !!activeUser,
    roles,
    hasRole: (role: string) => roles.includes(role),
    isAdmin: () => roles.some((r) => ['global-super-admin', 'super-admin', 'platform-admin'].includes(r)),
    isSuperAdmin: () => roles.includes('global-super-admin'),
  };
}
