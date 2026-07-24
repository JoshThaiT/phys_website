import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryState } from './QueryState';

const renderList = (items: string[]) => (
  <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
);

describe('QueryState', () => {
  it('announces loading to assistive technology', () => {
    render(
      <QueryState isLoading error={null} data={undefined}>
        {renderList}
      </QueryState>,
    );
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('shows the error message in an alert', () => {
    render(
      <QueryState isLoading={false} error={new Error('No access.')} data={undefined}>
        {renderList}
      </QueryState>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No access.');
  });

  it('calls onRetry when the retry button is pressed', async () => {
    const onRetry = vi.fn();
    render(
      <QueryState isLoading={false} error={new Error('x')} data={undefined} onRetry={onRetry}>
        {renderList}
      </QueryState>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows the empty state for an empty array', () => {
    render(
      <QueryState isLoading={false} error={null} data={[]} empty={{ title: 'No bookings yet.' }}>
        {renderList}
      </QueryState>,
    );
    expect(screen.getByText('No bookings yet.')).toBeInTheDocument();
  });

  it('renders children when data is present', () => {
    render(
      <QueryState isLoading={false} error={null} data={['Alpha', 'Beta']}>
        {renderList}
      </QueryState>,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('prefers the error branch over the empty branch', () => {
    render(
      <QueryState isLoading={false} error={new Error('boom')} data={[]}>
        {renderList}
      </QueryState>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
