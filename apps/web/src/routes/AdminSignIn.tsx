import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { adminSignInRequestSchema, type AdminSignInRequest } from 'shared';
import { requestSignInLink } from '@/lib/adminApi';
import { Field, inputClass } from '@/components/Field';
import { Seo } from '@/components/Seo';

/**
 * Deliberately shows the same "check your email" message whether or not the
 * address is on the reception allowlist (AC2) — the server's response is
 * identical either way, and this page must not introduce a client-side
 * signal (timing, wording, anything) that an attacker could use to tell them
 * apart.
 */
export function AdminSignIn() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminSignInRequest>({ resolver: zodResolver(adminSignInRequestSchema) });

  const mutation = useMutation({
    mutationFn: (values: AdminSignInRequest) => requestSignInLink(values.email),
    onSuccess: () => setSent(true),
  });

  async function onSubmit(values: AdminSignInRequest) {
    await mutation.mutateAsync(values);
  }

  return (
    <>
      <Seo title="Reception sign in" description="Sign in to the booking request list." noindex />
      <div className="mx-auto max-w-measure px-gutter py-section">
        <h1 className="text-title">Reception sign in</h1>

        {sent ? (
          <p className="mt-8 rounded-card border border-line bg-paper-raised p-5" role="status">
            Check your email. If that address has access, a sign-in link is on its way. It works
            once and expires shortly.
          </p>
        ) : (
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="mt-8 space-y-6">
            <Field id="email" label="Clinic email" error={errors.email?.message}>
              {(p) => (
                <input {...p} {...register('email')} type="email" className={inputClass} autoComplete="email" />
              )}
            </Field>

            {mutation.isError && (
              <p role="alert" className="text-sm font-medium text-alert">
                We could not send that right now. Please try again shortly.
              </p>
            )}

            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-card bg-clinic px-5 py-3 font-medium text-ink-inverse transition-colors
                         hover:bg-clinic-deep disabled:opacity-60"
            >
              {mutation.isPending ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
