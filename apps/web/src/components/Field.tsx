import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface FieldProps {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  optional?: boolean;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }) => ReactNode;
}

/**
 * Wires label, hint and error to the control with the right ARIA attributes.
 * Doing this by hand per field is where accessibility bugs come from.
 */
export function Field({ id, label, error, hint, optional = false, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={id} className="block font-medium">
        {label}
        {optional && <span className="ml-2 font-normal text-ink-muted">(optional)</span>}
      </label>
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-ink-muted">
          {hint}
        </p>
      )}
      <div className="mt-2">
        {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      </div>
      {error && (
        <p id={errorId} className={cn('mt-2 text-sm font-medium text-alert')}>
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  'w-full rounded-card border border-line-strong bg-paper-raised px-3 py-2.5 ' +
  'aria-[invalid=true]:border-alert';
