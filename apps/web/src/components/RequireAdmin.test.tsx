import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RequireAdmin } from './RequireAdmin';

vi.mock('@/lib/adminApi', () => ({ getSession: vi.fn() }));
import { getSession } from '@/lib/adminApi';

function renderProtected() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/requests']}>
        <Routes>
          <Route path="/admin" element={<p>Sign in page</p>} />
          <Route
            path="/admin/requests"
            element={
              <RequireAdmin>
                <p>Protected content</p>
              </RequireAdmin>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RequireAdmin', () => {
  it('redirects unauthenticated', async () => {
    vi.mocked(getSession).mockRejectedValue(new Error('401'));
    renderProtected();
    expect(await screen.findByText('Sign in page')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders the protected content for an authenticated session', async () => {
    vi.mocked(getSession).mockResolvedValue({ email: 'reception@example.com', name: 'Reception' });
    renderProtected();
    expect(await screen.findByText('Protected content')).toBeInTheDocument();
  });
});
