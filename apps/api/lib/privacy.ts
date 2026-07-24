import { createHash } from 'node:crypto';

/**
 * A raw IP address is personal information and there is no retention
 * justification for storing one here. Rate limiting only needs a stable
 * pseudonym, so we store a salted hash and nothing else.
 */
export function hashSource(ip: string): string {
  const salt = process.env['SOURCE_HASH_SALT'];
  if (!salt) throw new Error('SOURCE_HASH_SALT is not set.');
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

export function clientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return raw?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Field NAMES are safe to log. Field VALUES are not — a validation error on
 * the reason field would otherwise write health information into a log line
 * that outlives the record itself.
 */
export function safeFieldNames(fields: Record<string, string> | undefined): string[] {
  return fields ? Object.keys(fields) : [];
}
