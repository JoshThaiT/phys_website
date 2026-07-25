import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { getSession } from '@/lib/adminApi';

interface RequireAdminProps {
  children: ReactNode;
}

/**
 * Gates the admin data screens on a valid session. The actual access control
 * is server-side (`requireAdmin` in apps/api/lib/adminAuth.ts, called first
 * by every admin data handler) — this component only decides what the UI
 * shows while that check is pending or has failed, so a request never
 * reaches the screen without a session already having been confirmed.
 */
export function RequireAdmin({ children }: RequireAdminProps) {
  const location = useLocation();
  const query = useQuery({
    queryKey: ['admin', 'session'],
    queryFn: getSession,
    retry: false,
    staleTime: 60_000,
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-shell px-gutter py-section" aria-busy="true" aria-live="polite">
        <span className="sr-only">Checking your session</span>
        <div className="h-12 w-48 animate-pulse rounded-card bg-paper-sunk" />
      </div>
    );
  }

  if (query.error || !query.data) {
    return <Navigate to="/admin" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
