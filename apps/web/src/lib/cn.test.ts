import { describe, it, expect } from 'vitest';
import { cn } from './cn.js';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    const off: string | false = false;
    expect(cn('a', off, undefined, null, 'c')).toBe('a c');
  });

  it('lets a later conflicting utility win', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it.each([
    [true, 'text-accent'],
    [false, 'text-ink'],
  ])('resolves a conditional override when active=%s', (active, expected) => {
    expect(cn('text-ink', active && 'text-accent')).toBe(expected);
  });
});
