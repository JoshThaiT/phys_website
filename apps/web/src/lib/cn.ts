import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * The only way conditional classes are composed. String concatenation breaks
 * Tailwind's class detection and produces silently unstyled elements.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
