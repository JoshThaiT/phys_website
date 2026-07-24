import { useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifySignIn } from '@/lib/adminApi';
import { ApiRequestError } from '@/lib/api';
import { Seo } from '@/components/Seo';

/**
 * Consumes the single-use magic-link token in the URL and, on success,
 * establishes the session cookie server-side and moves on to the list.
 * Verifying is a one-shot side effect (the token is consumed on first use),
 * so it is triggered from an effect rather than a render — this is
 * synchronising with the URL/navigation, not deriving a value.
 */
export function AdminCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const attempted = useRef(false);

  const mutation = useMutation({
    mutationFn: (t: string) => verifySignIn(t),
    onSuccess: () => navigate('/admin/requests', { replace: true }),
  });

  useEffect(() => {
    if (attempted.current || !token) return;
    attempted.current = true;
    mutation.mutate(token);
  }, [token, mutation]);

  return (
    <>
      <Seo title="Signing in" description="Completing reception sign-in." noindex />
      <div className="mx-auto max-w-measure px-gutter py-section">
        <h1 className="text-title">Signing in</h1>

        {!token && (
          <p role="alert" className="mt-6 text-alert">
            This sign-in link is missing its token.
          </p>
        )}

        {token && mutation.isPending && (
          <p className="mt-6 text-ink-muted" aria-live="polite">
            Signing you in…
          </p>
        )}

        {token && mutation.isError && (
          <p role="alert" className="mt-6 text-alert">
            {mutation.error instanceof ApiRequestError
              ? mutation.error.message
              : 'This link is invalid or has expired.'}{' '}
            <a href="/admin" className="underline underline-offset-4">
              Request a new one
            </a>
            .
          </p>
        )}
      </div>
    </>
  );
}
