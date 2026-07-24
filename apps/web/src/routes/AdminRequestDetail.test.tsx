import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AdminRequestDetail as AdminRequestDetailType } from 'shared';
import type * as AdminApiModule from '@/lib/adminApi';
import { AdminRequestDetail } from './AdminRequestDetail';

vi.mock('@/lib/adminApi', async () => {
  const actual = await vi.importActual<typeof AdminApiModule>('@/lib/adminApi');
  return {
    ...actual,
    getRequestDetail: vi.fn(),
    revealReason: vi.fn(),
    updateRequestStatus: vi.fn(),
    deleteRequest: vi.fn(),
  };
});
import { deleteRequest, getRequestDetail, revealReason } from '@/lib/adminApi';

afterEach(() => {
  vi.clearAllMocks();
});

const DETAIL: AdminRequestDetailType = {
  id: 'r1',
  reference: 'BR-ABC234',
  status: 'pending',
  serviceSlug: 'physiotherapy-initial',
  fullName: 'Jo Nguyen',
  phone: '0412 345 678',
  email: null,
  createdAt: '2026-07-20T00:00:00.000Z',
  statusUpdatedAt: null,
  lastActionedBy: null,
  practitioner: null,
  preferred: [],
  internalNote: null,
  contactedAt: null,
  version: 0,
  history: [],
};

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/requests/r1']}>
        <Routes>
          <Route path="/admin/requests" element={<p>Booking requests list</p>} />
          <Route path="/admin/requests/:id" element={<AdminRequestDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminRequestDetail', () => {
  it('shows "nothing to show" when the reveal action returns a null reason', async () => {
    vi.mocked(getRequestDetail).mockResolvedValue(DETAIL);
    vi.mocked(revealReason).mockResolvedValue(null);
    const user = userEvent.setup();
    renderDetail();

    await screen.findByText('Jo Nguyen');
    await user.click(screen.getByRole('button', { name: /reveal reason/i }));

    expect(await screen.findByText('Nothing to show — no reason was given.')).toBeInTheDocument();
  });

  it('shows the revealed reason text when one was given', async () => {
    vi.mocked(getRequestDetail).mockResolvedValue(DETAIL);
    vi.mocked(revealReason).mockResolvedValue('wants a follow-up review');
    const user = userEvent.setup();
    renderDetail();

    await screen.findByText('Jo Nguyen');
    await user.click(screen.getByRole('button', { name: /reveal reason/i }));

    expect(await screen.findByText('wants a follow-up review')).toBeInTheDocument();
  });

  it('deletes only after the confirmation step, then returns to the list', async () => {
    vi.mocked(getRequestDetail).mockResolvedValue(DETAIL);
    vi.mocked(deleteRequest).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderDetail();

    await screen.findByText('Jo Nguyen');
    await user.click(screen.getByRole('button', { name: 'Delete request' }));

    // Not deleted yet — only the confirmation step is showing.
    expect(deleteRequest).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(deleteRequest).toHaveBeenCalledWith('r1');
    expect(await screen.findByText('Booking requests list')).toBeInTheDocument();
  });

  it('cancelling the confirmation step does not delete anything', async () => {
    vi.mocked(getRequestDetail).mockResolvedValue(DETAIL);
    const user = userEvent.setup();
    renderDetail();

    await screen.findByText('Jo Nguyen');
    await user.click(screen.getByRole('button', { name: 'Delete request' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(deleteRequest).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete request' })).toBeInTheDocument();
  });

  it('shows a not-available state for a request purged mid-session', async () => {
    const { ApiRequestError } = await import('@/lib/api');
    vi.mocked(getRequestDetail).mockRejectedValue(
      new ApiRequestError(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } }),
    );
    renderDetail();

    expect(await screen.findByText('This request is no longer available.')).toBeInTheDocument();
  });
});
