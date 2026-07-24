import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'react-router-dom';
import {
  PREFERRED_WINDOW_LABELS,
  REASON_MAX,
  bookingRequestSchema,
  bookingResponseSchema,
  preferredWindowSchema,
  type BookingRequest,
  type BookingRequestInput,
  type BookingResponse,
} from 'shared';
import { ApiRequestError, apiFetch } from '@/lib/api';
import { CollectionNotice } from '@/components/CollectionNotice';
import { Field, inputClass } from '@/components/Field';
import { Seo } from '@/components/Seo';
import { clinic } from '@/content/clinic';
import { services } from '@/content/services';
import { practitioners } from '@/content/practitioners';

const windows = preferredWindowSchema.options;

export function Book() {
  const [params] = useSearchParams();
  const [result, setResult] = useState<BookingResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** Stable for the life of the form, so a retry cannot create a duplicate. */
  const [idempotencyKey] = useState(() => globalThis.crypto.randomUUID());

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BookingRequestInput, unknown, BookingRequest>({
    resolver: zodResolver(bookingRequestSchema),
    defaultValues: {
      serviceSlug: params.get('service') ?? '',
      preferred: [],
      consent: false as unknown as true,
    },
  });

  const reason = watch('reason') ?? '';

  async function onSubmit(values: BookingRequest) {
    setSubmitError(null);
    try {
      const response = await apiFetch('/booking-requests', bookingResponseSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(values),
      });
      setResult(response);
    } catch (err) {
      setSubmitError(
        err instanceof ApiRequestError
          ? err.message
          : `We could not send that. Please phone the clinic on ${clinic.phone}.`,
      );
    }
  }

  if (result) {
    return (
      <>
        <Seo title="Request received" description="Your appointment request has been received." />
        <div className="mx-auto max-w-measure px-gutter py-section">
          <h1 className="text-title">Request received</h1>
          <p className="mt-4 text-lg text-ink-muted">{result.message}</p>
          <p className="mt-6 rounded-card border border-line bg-paper-raised p-5 font-mono">
            Your reference: <strong>{result.reference}</strong>
          </p>
          <p className="mt-6 text-ink-muted">
            Nothing is booked yet — this is a request. If you have not heard from us by the end of
            the next business day, please phone{' '}
            <a className="underline underline-offset-4" href={`tel:${clinic.phone.replace(/\s|\(|\)/g, '')}`}>
              {clinic.phone}
            </a>
            .
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Seo
        title="Request an appointment"
        description="Request a physiotherapy or remedial massage appointment. Reception will contact you to confirm a time."
      />
      <div className="mx-auto max-w-measure px-gutter py-section">
        <h1 className="text-title">Request an appointment</h1>
        <p className="mt-4 text-lg text-ink-muted">
          This sends a request, not a confirmed booking. Reception will contact you to agree a
          time — usually within one business day.
        </p>
        <p className="mt-3 text-ink-muted">
          If you need to be seen today, please phone{' '}
          <a className="underline underline-offset-4" href={`tel:${clinic.phone.replace(/\s|\(|\)/g, '')}`}>
            {clinic.phone}
          </a>
          .
        </p>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="mt-10 space-y-8">
          {submitError && (
            <div role="alert" className="rounded-card border border-alert bg-paper-raised p-4 text-alert">
              {submitError}
            </div>
          )}

          <Field id="fullName" label="Your name" error={errors.fullName?.message}>
            {(p) => <input {...p} {...register('fullName')} className={inputClass} autoComplete="name" />}
          </Field>

          <Field
            id="phone"
            label="Phone"
            hint="We will call you on this number to arrange a time."
            error={errors.phone?.message}
          >
            {(p) => <input {...p} {...register('phone')} type="tel" className={inputClass} autoComplete="tel" />}
          </Field>

          <Field id="email" label="Email" optional error={errors.email?.message}>
            {(p) => <input {...p} {...register('email')} type="email" className={inputClass} autoComplete="email" />}
          </Field>

          <Field id="serviceSlug" label="Appointment type" error={errors.serviceSlug?.message}>
            {(p) => (
              <select {...p} {...register('serviceSlug')} className={inputClass}>
                <option value="">Choose an appointment type</option>
                {services.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name} — {s.durationMinutes} min, ${s.feeAud}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field id="practitioner" label="Preferred practitioner" optional error={errors.practitioner?.message}>
            {(p) => (
              <select {...p} {...register('practitioner')} className={inputClass}>
                <option value="">No preference</option>
                {practitioners.map((practitioner) => (
                  <option key={practitioner.name} value={practitioner.name}>
                    {practitioner.name} — {practitioner.title}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <fieldset>
            <legend className="font-medium">
              When suits you? <span className="font-normal text-ink-muted">(optional)</span>
            </legend>
            <div className="mt-3 space-y-2">
              {windows.map((w) => (
                <label key={w} className="flex items-center gap-3">
                  <input type="checkbox" value={w} {...register('preferred')} className="size-4" />
                  <span>{PREFERRED_WINDOW_LABELS[w]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field
            id="reason"
            label="What would you like help with?"
            optional
            hint="One sentence is plenty. You do not need to give clinical detail here — reception will ask what they need when they call."
            error={errors.reason?.message}
          >
            {(p) => (
              <>
                <textarea {...p} {...register('reason')} rows={3} maxLength={REASON_MAX} className={inputClass} />
                <p className="mt-1 text-right font-mono text-sm text-ink-faint">
                  {reason.length}/{REASON_MAX}
                </p>
              </>
            )}
          </Field>

          {/* Honeypot. Hidden from people and assistive technology; bots fill it. */}
          <div aria-hidden="true" className="absolute left-[-9999px]">
            <label htmlFor="company">Company</label>
            <input id="company" tabIndex={-1} autoComplete="off" {...register('company')} />
          </div>

          <CollectionNotice />

          <div>
            <label className="flex items-start gap-3">
              <input type="checkbox" {...register('consent')} className="mt-1 size-4" />
              <span>
                I consent to the clinic collecting these details, including anything I have written
                about my reason for visiting, so they can contact me and arrange an appointment.
              </span>
            </label>
            {errors.consent && (
              <p role="alert" className="mt-2 text-sm font-medium text-alert">
                {errors.consent.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-card bg-clinic px-5 py-3 font-medium text-ink-inverse
                       transition-colors hover:bg-clinic-deep disabled:opacity-60 sm:w-auto"
          >
            {isSubmitting ? 'Sending…' : 'Send request'}
          </button>
        </form>
      </div>
    </>
  );
}
