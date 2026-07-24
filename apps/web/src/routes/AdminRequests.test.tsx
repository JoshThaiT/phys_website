import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminRequests } from './AdminRequests';

vi.mock('@/lib/adminApi', () => ({ listRequests: vi.fn() }));
import { listRequests } from '@/lib/adminApi';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminRequests />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  document.head.querySelectorAll('meta[name="robots"]').forEach((el) => el.remove());
});

describe('AdminRequests', () => {
  it('renders a clear empty state when there are no requests', async () => {
    vi.mocked(listRequests).mockResolvedValue({ items: [], nextCursor: null });
    renderPage();
    expect(await screen.findByText('No outstanding requests.')).toBeInTheDocument();
  });

  it('marks the page noindex and loads no third-party scripts', async () => {
    vi.mocked(listRequests).mockResolvedValue({ items: [], nextCursor: null });
    renderPage();
    await waitFor(() => {
      expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex,nofollow',
      );
    });
    expect(document.querySelectorAll('script[src]')).toHaveLength(0);
  });

  it('lists a request without rendering a reason field anywhere on the page', async () => {
    vi.mocked(listRequests).mockResolvedValue({
      items: [
        {
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
        },
      ],
      nextCursor: null,
    });
    renderPage();
    expect(await screen.findByText('Jo Nguyen')).toBeInTheDocument();
    expect(screen.getByText('BR-ABC234')).toBeInTheDocument();
    expect(screen.queryByText(/reason/i)).not.toBeInTheDocument();
  });
});
