// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/shared/lib/errorLogger';
import { useManagerScope } from '@/shared/hooks/useManagerScope';

// Query key factory for consistent, typed query keys
export const queryKeys = {
  // Base keys
  all: ['all'] as const,
  
  // Property queries
  properties: {
    all: ['properties'] as const,
    list: (managerId: string) => [...queryKeys.properties.all, 'list', managerId] as const,
    detail: (id: string) => [...queryKeys.properties.all, 'detail', id] as const,
    stats: (managerId: string) => [...queryKeys.properties.all, 'stats', managerId] as const,
  },
  
  // Tenant queries
  tenants: {
    all: ['tenants'] as const,
    list: (managerId: string) => [...queryKeys.tenants.all, 'list', managerId] as const,
    detail: (id: string) => [...queryKeys.tenants.all, 'detail', id] as const,
    history: (id: string) => [...queryKeys.tenants.all, 'history', id] as const,
  },
  
  // Lease queries
  leases: {
    all: ['leases'] as const,
    list: (managerId: string) => [...queryKeys.leases.all, 'list', managerId] as const,
    detail: (id: string) => [...queryKeys.leases.all, 'detail', id] as const,
    expiring: (managerId: string) => [...queryKeys.leases.all, 'expiring', managerId] as const,
  },
  
  // Invoice queries
  invoices: {
    all: ['invoices'] as const,
    list: (managerId: string) => [...queryKeys.invoices.all, 'list', managerId] as const,
    detail: (id: string) => [...queryKeys.invoices.all, 'detail', id] as const,
    pending: (managerId: string) => [...queryKeys.invoices.all, 'pending', managerId] as const,
    overdue: (managerId: string) => [...queryKeys.invoices.all, 'overdue', managerId] as const,
  },
  
  // Dashboard stats
  dashboard: {
    stats: (managerId: string) => ['dashboard', 'stats', managerId] as const,
    recentActivity: (managerId: string) => ['dashboard', 'activity', managerId] as const,
    upcomingPayments: (managerId: string) => ['dashboard', 'upcoming', managerId] as const,
  },
  
  // Profile queries
  profile: {
    all: ['profile'] as const,
    detail: (userId: string) => [...queryKeys.profile.all, 'detail', userId] as const,
  },
  
  // Manager scope
  manager: {
    profile: (managerId: string) => ['manager', 'profile', managerId] as const,
    subProfile: (managerId: string) => ['manager', 'subProfile', managerId] as const,
  },
};

// Default stale times for different query types
export const STALE_TIMES = {
  // Frequently changing data - 30 seconds
  frequentlyChanging: 30 * 1000,
  
  // Normal data - 5 minutes
  normal: 5 * 60 * 1000,
  
  // Stable data - 15 minutes
  stable: 15 * 60 * 1000,
  
  // Very stable data - 30 minutes
  veryStable: 30 * 60 * 1000,
  
  // Reference data - 1 hour
  reference: 60 * 60 * 1000,
  
  // Profile data - 10 minutes
  profile: 10 * 60 * 1000,
};

// Query options factory
export function createQueryOptions<TData, TError = Error>(
  options: Partial<UseQueryOptions<TData, TError>>
): UseQueryOptions<TData, TError> {
  return {
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: STALE_TIMES.normal,
    ...options,
  };
}

// Optimized properties query with caching
export function useOptimizedProperties(managerId: string | null) {
  return useQuery({
    queryKey: queryKeys.properties.list(managerId ?? ''),
    queryFn: async () => {
      if (!managerId) return [];
      
      const { data, error } = await supabase
        .from('properties')
        .select('id, name, address, units, occupied, revenue, image_url, status, created_at')
        .eq('manager_id', managerId)
        .neq('status', 'inactive')
        .order('created_at', { ascending: false });
      
      if (error) {
        logError('useOptimizedProperties', error);
        throw error;
      }
      
      return data ?? [];
    },
    enabled: !!managerId,
    staleTime: STALE_TIMES.frequentlyChanging,
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

// Optimized tenants query with caching
export function useOptimizedTenants(managerId: string | null) {
  return useQuery({
    queryKey: queryKeys.tenants.list(managerId ?? ''),
    queryFn: async () => {
      if (!managerId) return [];
      
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, email, phone, unit, property_id, status, monthly_rent, move_in_date')
        .eq('manager_id', managerId)
        .order('name', { ascending: true });
      
      if (error) {
        logError('useOptimizedTenants', error);
        throw error;
      }
      
      return data ?? [];
    },
    enabled: !!managerId,
    staleTime: STALE_TIMES.frequentlyChanging,
    gcTime: 10 * 60 * 1000,
  });
}

// Optimized dashboard stats query - combines multiple queries into one
export function useOptimizedDashboardStats(managerId: string | null) {
  const { restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const assignedKey = assignedPropertyIds.join(',');
  return useQuery({
    queryKey: [...queryKeys.dashboard.stats(managerId ?? ''), assignedKey],
    queryFn: async () => {
      if (!managerId) {
        const { EMPTY_DASHBOARD_STATS } = await import('@/features/dashboard/lib/dashboardStats');
        return EMPTY_DASHBOARD_STATS;
      }
      const { fetchManagerDashboardStats } = await import('@/features/dashboard/lib/dashboardStats');
      return fetchManagerDashboardStats(managerId, {
        restrictToAssignedProperties,
        assignedPropertyIds,
      });
    },
    enabled: !!managerId,
    staleTime: STALE_TIMES.frequentlyChanging,
    gcTime: 5 * 60 * 1000,
  });
}

// Prefetch helper hook
export function usePrefetch() {
  const queryClient = useQueryClient();
  
  const prefetchProperties = useCallback(
    (managerId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.properties.list(managerId),
        queryFn: async () => {
          const { data } = await supabase
            .from('properties')
            .select('id, name, address, units, occupied, revenue, image_url, status, created_at')
            .eq('manager_id', managerId)
            .neq('status', 'inactive');
          return data ?? [];
        },
        staleTime: STALE_TIMES.frequentlyChanging,
      });
    },
    [queryClient]
  );
  
  const prefetchTenants = useCallback(
    (managerId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.tenants.list(managerId),
        queryFn: async () => {
          const { data } = await supabase
            .from('tenants')
            .select('id, name, email, status, property_id, unit')
            .eq('manager_id', managerId);
          return data ?? [];
        },
        staleTime: STALE_TIMES.frequentlyChanging,
      });
    },
    [queryClient]
  );
  
  return { prefetchProperties, prefetchTenants };
}

// Optimistic update hook
export function useOptimisticUpdate<T>(queryKey: readonly unknown[]) {
  const queryClient = useQueryClient();
  
  const update = useCallback(
    (updater: (old: T | undefined) => T | undefined) => {
      queryClient.setQueryData<T>(queryKey as string[], updater);
    },
    [queryClient, queryKey]
  );
  
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);
  
  return { update, invalidate };
}

// Debounced search hook
export function useDebouncedSearch<T>(
  searchFn: (query: string) => Promise<T[]>,
  debounceMs = 300
) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const searchFnRef = useRef(searchFn);

  useEffect(() => {
    searchFnRef.current = searchFn;
  }, [searchFn]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        const data = await searchFnRef.current(query);
        setResults(data);
      } catch (error) {
        logError('useDebouncedSearch', error);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query, debounceMs]);

  return { query, setQuery, results, isLoading };
}

// Pagination helper
export function usePagination<T>(
  items: T[],
  pageSize = 10
) {
  const [page, setPage] = useState(0);
  
  const totalPages = Math.ceil(items.length / pageSize);
  const startIndex = page * pageSize;
  const endIndex = startIndex + pageSize;
  const currentItems = items.slice(startIndex, endIndex);
  
  const goToPage = useCallback((pageNum: number) => {
    setPage(Math.max(0, Math.min(pageNum, totalPages - 1)));
  }, [totalPages]);
  
  const nextPage = useCallback(() => {
    goToPage(page + 1);
  }, [page, goToPage]);
  
  const prevPage = useCallback(() => {
    goToPage(page - 1);
  }, [page, goToPage]);
  
  return {
    currentItems,
    page,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    hasNext: page < totalPages - 1,
    hasPrev: page > 0,
    startIndex,
    endIndex,
    totalItems: items.length,
  };
}

export default {
  queryKeys,
  STALE_TIMES,
  createQueryOptions,
  useOptimizedProperties,
  useOptimizedTenants,
  useOptimizedDashboardStats,
  usePrefetch,
  useOptimisticUpdate,
  useDebouncedSearch,
  usePagination,
};
