import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { Seo } from './Seo';

afterEach(() => {
  document.head.querySelectorAll('meta[name="robots"]').forEach((el) => el.remove());
});

describe('Seo', () => {
  it('marks the page noindex when requested', () => {
    render(<Seo title="Requests" description="Booking request list." noindex />);
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex,nofollow',
    );
  });

  it('clears a previous noindex on a client-side navigation to a public page', () => {
    const { rerender } = render(<Seo title="Requests" description="Booking request list." noindex />);
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex,nofollow',
    );

    // Same <head>, same SPA session — the next page rendered doesn't ask for noindex.
    rerender(<Seo title="Home" description="Clinic home page." />);
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');
  });
});
