'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useFeatureFlags() {
  const { data, isLoading } = useQuery({
    queryKey: ['feature-flags-nav'],
    queryFn: () => api.get('/api/v1/features/navigation').then((r) => r.data),
    staleTime: 60_000,
    retry: false,
  });

  return {
    flags: data || {},
    isLoading,
    isEnabled: (key: string): boolean => {
      const alwaysOn = ['home', 'profile', 'regions'];
      if (alwaysOn.includes(key)) return true;
      return data?.[key] === true;
    },
  };
}
