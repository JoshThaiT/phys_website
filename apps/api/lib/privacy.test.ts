import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { clientIp, hashSource, safeFieldNames } from './privacy.js';

describe('hashSource', () => {
  beforeEach(() => { process.env['SOURCE_HASH_SALT'] = 'test-salt'; });
  afterEach(() => { delete process.env['SOURCE_HASH_SALT']; });

  it('is stable for the same address', () => {
    expect(hashSource('1.2.3.4')).toBe(hashSource('1.2.3.4'));
  });

  it('differs between addresses', () => {
    expect(hashSource('1.2.3.4')).not.toBe(hashSource('1.2.3.5'));
  });

  it('does not contain the original address', () => {
    expect(hashSource('203.0.113.9')).not.toContain('203.0.113');
  });

  it('throws when the salt is missing rather than hashing unsalted', () => {
    delete process.env['SOURCE_HASH_SALT'];
    expect(() => hashSource('1.2.3.4')).toThrow(/SOURCE_HASH_SALT/);
  });
});

describe('clientIp', () => {
  it('takes the first entry of x-forwarded-for', () => {
    expect(clientIp({ 'x-forwarded-for': '203.0.113.9, 70.41.3.18' })).toBe('203.0.113.9');
  });

  it('falls back to unknown when absent', () => {
    expect(clientIp({})).toBe('unknown');
  });
});

describe('safeFieldNames', () => {
  it('returns names without values', () => {
    const names = safeFieldNames({ reason: 'lower back pain since surgery' });
    expect(names).toEqual(['reason']);
    expect(JSON.stringify(names)).not.toContain('surgery');
  });

  it('handles absent fields', () => {
    expect(safeFieldNames(undefined)).toEqual([]);
  });
});
