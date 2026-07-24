import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RETENTION_DAYS } from 'shared';
import { Book } from './Book';

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
afterEach(() => vi.unstubAllGlobals());

const renderBook = (entry = '/book') =>
  render(<MemoryRouter initialEntries={[entry]}><Book /></MemoryRouter>);

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/your name/i), 'Jo Nguyen');
  await user.type(screen.getByLabelText(/^phone$/i), '0412345678');
  await user.selectOptions(screen.getByLabelText(/appointment type/i), 'physiotherapy-initial');
}

describe('Book', () => {
  it('shows the collection notice before submission', () => {
    renderBook();
    expect(screen.getByRole('heading', { name: /how we handle what you tell us/i })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${RETENTION_DAYS} days`))).toBeInTheDocument();
  });

  it('leaves consent unticked on load', () => {
    renderBook();
    expect(screen.getByRole('checkbox', { name: /i consent/i })).not.toBeChecked();
  });

  it('marks the reason field optional and says clinical detail is not needed', () => {
    renderBook();
    const label = screen.getByText(/what would you like help with/i).closest('label');
    expect(label).toHaveTextContent(/optional/i);
    expect(screen.getByText(/do not need to give clinical detail/i)).toBeInTheDocument();
  });

  it('blocks submission without consent and says why', async () => {
    const user = userEvent.setup();
    const fetchFn = mockFetch(202, {});
    renderBook();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: /send request/i }));
    expect(await screen.findByText(/we need your consent/i)).toBeInTheDocument();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('blocks submission with neither phone nor email', async () => {
    const user = userEvent.setup();
    const fetchFn = mockFetch(202, {});
    renderBook();
    await user.type(screen.getByLabelText(/your name/i), 'Jo Nguyen');
    await user.selectOptions(screen.getByLabelText(/appointment type/i), 'physiotherapy-initial');
    await user.click(screen.getByRole('checkbox', { name: /i consent/i }));
    await user.click(screen.getByRole('button', { name: /send request/i }));
    expect(await screen.findByText(/either a phone number or an email/i)).toBeInTheDocument();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('submits a valid request and shows the reference', async () => {
    const user = userEvent.setup();
    mockFetch(202, { reference: 'BR-ABC234', message: 'Reception will contact you.' });
    renderBook();
    await fillValid(user);
    await user.click(screen.getByRole('checkbox', { name: /i consent/i }));
    await user.click(screen.getByRole('button', { name: /send request/i }));
    expect(await screen.findByText('BR-ABC234')).toBeInTheDocument();
  });

  it('sends a stable idempotency key so a retry cannot duplicate', async () => {
    const user = userEvent.setup();
    const fetchFn = mockFetch(202, { reference: 'BR-ABC234', message: 'ok' });
    renderBook();
    await fillValid(user);
    await user.click(screen.getByRole('checkbox', { name: /i consent/i }));
    await user.click(screen.getByRole('button', { name: /send request/i }));
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    const headers = fetchFn.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toMatch(/[0-9a-f-]{36}/);
  });

  it('preserves what was typed when the network fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    renderBook();
    await fillValid(user);
    await user.click(screen.getByRole('checkbox', { name: /i consent/i }));
    await user.click(screen.getByRole('button', { name: /send request/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/phone the clinic/i);
    expect(screen.getByLabelText(/your name/i)).toHaveValue('Jo Nguyen');
  });

  it('preselects the service from the query string', () => {
    renderBook('/book?service=remedial-massage-60');
    expect(screen.getByLabelText(/appointment type/i)).toHaveValue('remedial-massage-60');
  });

  it('hides the honeypot from assistive technology', () => {
    const { container } = renderBook();
    const honeypot = container.querySelector('#company');
    expect(honeypot).toBeTruthy();
    expect(honeypot?.closest('[aria-hidden="true"]')).toBeTruthy();
  });

  it('says plainly that nothing is booked yet', () => {
    renderBook();
    expect(screen.getByText(/not a confirmed booking/i)).toBeInTheDocument();
  });
});
