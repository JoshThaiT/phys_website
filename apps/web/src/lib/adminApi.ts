import { z } from 'zod';
import {
  adminRequestDetailSchema,
  adminRequestListResponseSchema,
  adminRevealResponseSchema,
  adminSessionSchema,
  adminSignInResponseSchema,
  type AdminRequestDetail,
  type AdminRequestListResponse,
  type AdminSession,
  type AdminSettableStatus,
} from 'shared';
import { ApiRequestError, apiFetch } from '@/lib/api';

/**
 * Typed admin calls, all via `apiFetch` so every response is parsed against
 * the same Zod schema the server validates against. `reason` only ever
 * appears in `revealReason`'s return value — no other function here can
 * surface it, matching the schema-level guarantee in packages/shared/src/admin.ts.
 */

export async function requestSignInLink(email: string): Promise<void> {
  await apiFetch('/admin-auth?action=request', adminSignInResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifySignIn(token: string): Promise<AdminSession> {
  return apiFetch('/admin-auth?action=verify', adminSessionSchema, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function signOut(): Promise<void> {
  await apiFetch('/admin-auth?action=signout', z.null(), { method: 'POST' });
}

export async function getSession(): Promise<AdminSession> {
  return apiFetch('/admin-auth?action=me', adminSessionSchema);
}

export async function listRequests(cursor?: string): Promise<AdminRequestListResponse> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiFetch(`/admin-requests${qs}`, adminRequestListResponseSchema);
}

export async function getRequestDetail(id: string): Promise<AdminRequestDetail> {
  return apiFetch(`/admin-requests?id=${encodeURIComponent(id)}`, adminRequestDetailSchema);
}

/** The single exit for `reason` on the client. */
export async function revealReason(id: string): Promise<string | null> {
  const result = await apiFetch('/admin-requests', adminRevealResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ action: 'reveal', id }),
  });
  return result.reason;
}

/**
 * Thrown when a status/note update loses the optimistic-concurrency check
 * (AC13). `apiFetch`'s error handling only exposes the `error` half of the
 * server's 409 body, so this re-fetches the record to obtain `current` — the
 * caller shows the reviewer the state that actually won, not a silent
 * overwrite.
 */
export class AdminConflictError extends Error {
  constructor(readonly current: AdminRequestDetail) {
    super('This request was changed by someone else.');
    this.name = 'AdminConflictError';
  }
}

export async function updateRequestStatus(params: {
  id: string;
  status?: AdminSettableStatus;
  note?: string;
  expectedVersion: number;
}): Promise<AdminRequestDetail> {
  try {
    return await apiFetch(`/admin-requests?id=${encodeURIComponent(params.id)}`, adminRequestDetailSchema, {
      method: 'PATCH',
      body: JSON.stringify({ status: params.status, note: params.note, expectedVersion: params.expectedVersion }),
    });
  } catch (err) {
    if (err instanceof ApiRequestError && err.code === 'CONFLICT') {
      const current = await getRequestDetail(params.id);
      throw new AdminConflictError(current);
    }
    throw err;
  }
}

export async function deleteRequest(id: string): Promise<void> {
  await apiFetch(`/admin-requests?id=${encodeURIComponent(id)}`, z.null(), { method: 'DELETE' });
}
