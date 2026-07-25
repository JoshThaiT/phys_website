import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { AdminRequestListItem } from 'shared';
import { listRequests } from '@/lib/adminApi';
import { QueryState } from '@/components/QueryState';
import { Seo } from '@/components/Seo';
import { services } from '@/content/services';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  contacted: 'Contacted',
  scheduled: 'Scheduled',
  declined: 'Declined',
};

function serviceName(slug: string): string {
  return services.find((s) => s.slug === slug)?.name ?? slug;
}

function contactLine(item: AdminRequestListItem): string {
  return item.phone ?? item.email ?? 'No contact given';
}

/**
 * The queue reception works from. No `reason` is rendered here — the
 * server's response schema structurally omits it, so there is nothing to
 * accidentally display even by mistake (AC4, AC7).
 */
export function AdminRequests() {
  const [params, setParams] = useSearchParams();
  const cursor = params.get('cursor') ?? undefined;

  const query = useQuery({
    queryKey: ['admin', 'requests', { cursor }],
    queryFn: () => listRequests(cursor),
  });

  function goToNextPage() {
    const nextCursor = query.data?.nextCursor;
    if (!nextCursor) return;
    const next = new URLSearchParams(params);
    next.set('cursor', nextCursor);
    setParams(next);
  }

  return (
    <>
      <Seo title="Booking requests" description="Outstanding appointment requests." noindex />
      <div className="mx-auto max-w-shell px-gutter py-section">
        <h1 className="text-title">Booking requests</h1>

        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          data={query.data?.items}
          onRetry={() => void query.refetch()}
          empty={{ title: 'No outstanding requests.' }}
          className="mt-8"
        >
          {(items) => (
            <>
              <ul className="mt-8 divide-y divide-line border-y border-line">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/admin/requests/${item.id}`}
                      className="flex flex-col gap-2 py-4 hover:bg-paper-sunk sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-mono text-sm text-ink-faint">{item.reference}</p>
                        <p className="font-medium">{item.fullName}</p>
                        <p className="text-sm text-ink-muted">{serviceName(item.serviceSlug)}</p>
                      </div>
                      <div className="text-sm text-ink-muted">
                        <p>{contactLine(item)}</p>
                        <p>{new Date(item.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="text-sm sm:text-right">
                        <p className="font-medium">{STATUS_LABEL[item.status] ?? item.status}</p>
                        <p className="text-ink-muted">
                          {item.lastActionedBy
                            ? `Last by ${item.lastActionedBy.name ?? item.lastActionedBy.email}`
                            : 'Not yet actioned'}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>

              {query.data?.nextCursor && (
                <button
                  type="button"
                  onClick={goToNextPage}
                  className="mt-6 rounded-card border border-line-strong px-5 py-3 font-medium transition-colors hover:border-ink"
                >
                  Next page
                </button>
              )}
            </>
          )}
        </QueryState>
      </div>
    </>
  );
}
