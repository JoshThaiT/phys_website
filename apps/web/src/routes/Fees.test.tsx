import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Fees } from './Fees';
import { services } from '@/content/services';

const renderFees = () => render(<MemoryRouter><Fees /></MemoryRouter>);

describe('Fees', () => {
  it('lists every service with its fee', () => {
    renderFees();
    for (const s of services) {
      expect(screen.getByRole('rowheader', { name: s.name })).toBeInTheDocument();
      expect(screen.getAllByText(`$${s.feeAud}`).length).toBeGreaterThan(0);
    }
  });

  it('labels which discipline is AHPRA registered and which is self-regulated', () => {
    renderFees();
    expect(screen.getByText(/AHPRA registered/i)).toBeInTheDocument();
    expect(screen.getByText(/self-regulated/i)).toBeInTheDocument();
  });

  it('states the referral position for every service', () => {
    renderFees();
    expect(screen.getAllByText(/Not required|Required/).length).toBe(services.length);
  });

  it('explains the health fund rebate position', () => {
    renderFees();
    expect(screen.getByRole('heading', { name: /private health funds/i })).toBeInTheDocument();
  });
});
