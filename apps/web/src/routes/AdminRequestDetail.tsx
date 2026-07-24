import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { NOTE_MAX, adminSettableStatusSchema, type AdminSettableStatus } from 'shared';
import {
  AdminConflictError,
  deleteRequest,
  getRequestDetail,
  revealReason,
  updateRequestStatus,
} from '@/lib/adminApi';
import { ApiRequestError } from '@/lib/api';
import { Field, inputClass } from '@/components/Field';
import { Seo } from '@/components/Seo';
import { services } from '@/content/services';

const STATUS_OPTIONS = adminSettableStatusSchema.options;
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  contacted: 'Contacted',
  scheduled: 'Scheduled',
  declined: 'Declined',
};

function serviceName(slug: string): string {
  return services.find((s) => s.slug === slug)?.name ?? slug;
}

function isSettableStatus(status: string): status is AdminSettableStatus {
  return adminSettableStatusSchema.safeParse(status).success;
}

const statusFormSchema = z.object({
  status: adminSettableStatusSchema,
  note: z.string().trim().max(NOTE_MAX, `Keep the note under ${NOTE_MAX} characters`).optional(),
});
type StatusFormValues = z.infer<typeof statusFormSchema>;

/**
 * Detail view: reveal-on-demand reason, status + note, delete behind a
 * confirmation step, and the audit history. `reason` is fetched only by the
 * explicit reveal action below — the loaded detail record never carries it.
 */
export function AdminRequestDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['admin', 'requests', id],
    queryFn: () => getRequestDetail(id),
    enabled: Boolean(id),
  });
  const detail = detailQuery.data;

  const revealMutation = useMutation({ mutationFn: () => revealReason(id) });

  const updateMutation = useMutation({
    mutationFn: (values: { status: AdminSettableStatus; note?: string; expectedVersion: number }) =>
      updateRequestStatus({ id, ...values }),
    onSuccess: (updated) => queryClient.setQueryData(['admin', 'requests', id], updated),
    onError: (err) => {
      if (err instanceof AdminConflictError) {
        queryClient.setQueryData(['admin', 'requests', id], err.current);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteRequest(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['admin', 'requests', id] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'requests'], exact: false });
      navigate('/admin/requests', { replace: true });
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StatusFormValues>({
    resolver: zodResolver(statusFormSchema),
    values: detail
      ? { status: isSettableStatus(detail.status) ? detail.status : 'contacted', note: detail.internalNote ?? '' }
      : undefined,
  });

  async function onSubmit(values: StatusFormValues) {
    if (!detail) return;
    await updateMutation.mutateAsync({ status: values.status, note: values.note, expectedVersion: detail.version });
  }

  return (
    <>
      <Seo
        title={detail ? `Request ${detail.reference}` : 'Booking request'}
        description="Booking request detail."
        noindex
      />
      <div className="mx-auto max-w-measure px-gutter py-section">
        <Link to="/admin/requests" className="text-sm underline underline-offset-4">
          Back to the list
        </Link>

        {detailQuery.isLoading && (
          <div className="mt-8 space-y-3" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading</span>
            <div className="h-12 animate-pulse rounded-card bg-paper-sunk" />
          </div>
        )}

        {detailQuery.error && (
          <div role="alert" className="mt-8 rounded-card border border-line p-gutter">
            <p className="font-medium text-alert">
              {detailQuery.error instanceof ApiRequestError && detailQuery.error.code === 'NOT_FOUND'
                ? 'This request is no longer available.'
                : 'Something went wrong loading this request.'}
            </p>
          </div>
        )}

        {detail && (
          <div className="mt-8 space-y-10">
            <div>
              <p className="font-mono text-sm text-ink-faint">{detail.reference}</p>
              <h1 className="mt-1 text-title">{detail.fullName}</h1>
              <p className="mt-2 text-ink-muted">{serviceName(detail.serviceSlug)}</p>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-ink-muted">Phone</dt>
                <dd>{detail.phone ?? '—'}</dd>
                <dt className="text-ink-muted">Email</dt>
                <dd>{detail.email ?? '—'}</dd>
                <dt className="text-ink-muted">Practitioner</dt>
                <dd>{detail.practitioner ?? 'No preference'}</dd>
                <dt className="text-ink-muted">Arrived</dt>
                <dd>{new Date(detail.createdAt).toLocaleString()}</dd>
              </dl>
            </div>

            <div>
              <h2 className="text-lg font-medium">Reason for visit</h2>
              {revealMutation.data === undefined ? (
                <button
                  type="button"
                  onClick={() => revealMutation.mutate()}
                  disabled={revealMutation.isPending}
                  className="mt-3 rounded-card border border-line-strong px-4 py-2 font-medium hover:border-ink"
                >
                  {revealMutation.isPending ? 'Revealing…' : 'Reveal reason'}
                </button>
              ) : revealMutation.data === null ? (
                <p className="mt-3 text-ink-muted">Nothing to show — no reason was given.</p>
              ) : (
                <p className="mt-3 rounded-card border border-line bg-paper-raised p-4">{revealMutation.data}</p>
              )}
            </div>

            <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="space-y-6">
              <h2 className="text-lg font-medium">Status &amp; note</h2>

              <Field id="status" label="Status" error={errors.status?.message}>
                {(p) => (
                  <select {...p} {...register('status')} className={inputClass}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              <Field
                id="note"
                label="Internal note"
                optional
                hint="Reception's own words, not clinical detail. Visible only in this view."
                error={errors.note?.message}
              >
                {(p) => <textarea {...p} {...register('note')} rows={3} maxLength={NOTE_MAX} className={inputClass} />}
              </Field>

              {updateMutation.isError && !(updateMutation.error instanceof AdminConflictError) && (
                <p role="alert" className="text-sm font-medium text-alert">
                  Could not save. Try again.
                </p>
              )}
              {updateMutation.error instanceof AdminConflictError && (
                <p role="alert" className="text-sm font-medium text-alert">
                  This request was changed by someone else. Showing the current state — review it before saving
                  again.
                </p>
              )}

              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="rounded-card bg-clinic px-5 py-3 font-medium text-ink-inverse transition-colors
                           hover:bg-clinic-deep disabled:opacity-60"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </form>

            <div>
              <h2 className="text-lg font-medium">History</h2>
              {detail.history.length === 0 ? (
                <p className="mt-3 text-ink-muted">No changes recorded yet.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {detail.history.map((h) => (
                    <li key={h.id} className="border-b border-line pb-2">
                      <span className="font-medium">{h.actor.name ?? h.actor.email}</span>{' '}
                      {h.action === 'delete' ? 'deleted this request' : `set status to ${h.toStatus ?? 'unchanged'}`}{' '}
                      <span className="text-ink-muted">— {new Date(h.at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-line pt-6">
              {!confirmingDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-card border border-alert px-4 py-2 font-medium text-alert hover:bg-alert hover:text-ink-inverse"
                >
                  Delete request
                </button>
              ) : (
                <div className="rounded-card border border-alert p-4">
                  <p className="font-medium">Delete this request? This cannot be undone.</p>
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                      className="rounded-card bg-alert px-4 py-2 font-medium text-ink-inverse disabled:opacity-60"
                    >
                      {deleteMutation.isPending ? 'Deleting…' : 'Confirm delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="rounded-card border border-line-strong px-4 py-2 font-medium hover:border-ink"
                    >
                      Cancel
                    </button>
                  </div>
                  {deleteMutation.isError && (
                    <p role="alert" className="mt-2 text-sm font-medium text-alert">
                      Could not delete. Try again.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
