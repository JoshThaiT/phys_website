import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface QueryStateProps<T> {
  isLoading: boolean;
  error: unknown;
  data: T[] | undefined;
  children: (data: T[]) => ReactNode;
  onRetry?: () => void;
  empty?: { title: string; action?: ReactNode };
  className?: string;
}

/**
 * Enforces the three-branch rule: every network surface renders loading, error
 * and empty explicitly. Wrapping it here is what stops each new feature from
 * shipping with only the happy path.
 */
export function QueryState<T>({
  isLoading,
  error,
  data,
  children,
  onRetry,
  empty,
  className,
}: QueryStateProps<T>) {
  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)} aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-card bg-surface-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    const message =
      error instanceof Error ? error.message : 'Something went wrong.';
    return (
      <div role="alert" className={cn('rounded-card border border-line p-gutter', className)}>
        <p className="font-medium text-danger">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-card bg-accent px-4 py-2 text-ink-inverse hover:bg-accent-hover"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={cn('rounded-card border border-line p-gutter text-center', className)}>
        <p className="text-ink-muted">{empty?.title ?? 'Nothing here yet.'}</p>
        {empty?.action && <div className="mt-3">{empty.action}</div>}
      </div>
    );
  }

  return <>{children(data)}</>;
}
