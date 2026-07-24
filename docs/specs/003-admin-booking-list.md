# 003 — Admin booking-request list

**Status:** draft — awaiting approval
**Author:** spec-writer, 2026-07-24

## Problem

Spec 002 shipped an endpoint that lands appointment requests in a
`booking_requests` table, but gave reception no way to see them. Its own open
questions deferred the answer here: "Should the admin list be built now or does
reception work from email links? [assumed a minimal authenticated admin list is
spec 003]." Today reception would have to open each notification email and act
on it individually, with no shared view of what is outstanding, no record of who
has picked up which request, and nothing to stop two people phoning the same
patient.

Reception is a small, known set of clinic staff who need to see the queue of
requests, contact each patient, and mark the request's progress through to
booked-in — all inside an authenticated view, because one of the fields
(`reason`) is health information that spec 002 requires be readable only there.
This spec covers that view and nothing else: it does not collect new data, it
reads and updates what 002 already stores.

## Goal

A member of clinic reception can sign in, see every outstanding booking request
in one list, and move each one through to actioned without leaving the app.

## Non-goals

- No public sign-up, no patient accounts, no password-based login, no roles or
  permission tiers — every authenticated user is reception with the same access.
- No calendar, availability, or booking confirmation. Reception still books the
  patient in the practice's own system; this list only tracks that they did.
- No editing of patient-submitted fields. Name, phone, email, service and reason
  are read-only; reception changes only status and its own note.
- No export, download, CSV, or print view of any request or the list. A file of
  health data defeats 002's "read only in the admin view" containment.
- No bulk actions across multiple requests.
- No purge job. Spec 004 owns automatic deletion; this spec must not change
  `purgeAfter` or duplicate its behaviour.
- No new notification or SMS. Notifications remain as built in 002/005.
- No analytics, tag manager, session recorder or ad pixel — the 002 prohibition
  extends to every page that can display a `reason`.

## Privacy requirements — requirements, not preferences

These inherit directly from spec 002 and are not open for relitigation here.

1. **The `reason` field is health information.** It may be displayed only to an
   authenticated user, only in this view, and only after a deliberate reveal
   (see AC7). It never enters a log, an error response, an analytics call, or
   the URL.
2. **Access is gated on proving control of an allowlisted mailbox.** There is no
   anonymous path to any endpoint that returns a `reason`.
3. **The admin pages are excluded from indexing** and carry no third-party
   scripts of any kind.
4. **Every state change is attributable.** The record shows which user changed a
   request's status and when; a manual deletion is recorded as an audit event
   that names the actor and time but never the `reason` text.
5. **This view does not extend retention.** It reads rows within their existing
   90-day window; it does not reset, lengthen, or depend on `purgeAfter`.

## User flows

1. A reception staff member opens the admin URL → is not signed in → enters
   their clinic email → receives a single-use sign-in link by email → follows it
   → lands on the request list.
2. An email not on the allowlist requests a link → the app shows the same
   neutral "check your email" message but no link is sent and no access is
   granted; the response does not reveal whether the address is known.
3. The list shows outstanding requests newest-first: reference, service,
   patient name, phone/email, when it arrived, current status, and who last
   touched it. The `reason` is not shown until revealed.
4. Reception clicks a request → sees its full detail → clicks to reveal the
   reason if needed → phones or emails the patient → sets the status (contacted,
   scheduled, or declined) and optionally adds a short internal note → the change
   is saved with their name and timestamp.
5. A patient phones asking to be removed → reception opens the request → deletes
   it behind a confirmation step → it disappears from the list and an audit
   event records who deleted it and when.
6. Reception leaves the tab idle past the timeout → the next action requires
   signing in again.

## Acceptance criteria

- [ ] AC1: An unauthenticated visitor to any admin page or admin data endpoint
      receives no request data and is directed to sign in.
- [ ] AC2: A sign-in link is sent only to an address on the reception allowlist;
      a non-allowlisted address gets an identical "check your email" response
      and no link, with no signal that distinguishes the two cases.
- [ ] AC3: A sign-in link is single-use and expires; a used or expired link
      grants no access.
- [ ] AC4: The list shows every non-purged request, newest first, with
      reference, service, name, contact, arrival time, status, and last-actioned-by
      — and does not render `reason` inline.
- [ ] AC5: A signed-in user can move a request to `contacted`, `scheduled`, or
      `declined`; the record then shows the new status, the acting user, and the
      time of the change.
- [ ] AC6: Setting status to `contacted` records the moment of contact; a
      request's history of who-did-what is visible to reception.
- [ ] AC7: The `reason` is hidden by default and shown only after an explicit
      per-request reveal action; it never appears in a list row, a URL, a log,
      or an error message.
- [ ] AC8: A signed-in user can delete a single request behind a confirmation;
      afterwards it is absent from the list and an audit event names the actor
      and time without containing the `reason`.
- [ ] AC9: An optional internal note can be attached to a request, is bounded in
      length, is shown only in this authenticated view, and is understood to be
      reception's own words, not clinical detail.
- [ ] AC10: An idle session expires after a defined period; the next action
      requires re-authentication.
- [ ] AC11: The admin pages are marked not-indexable and load no third-party
      analytics, tag manager, session recorder, or ad pixel.
- [ ] AC12: The list has explicit loading, error, and empty states; the empty
      state confirms there are no outstanding requests rather than looking broken.
- [ ] AC13: Concurrent action is safe: if two users change the same request, the
      result is a single coherent status and the second user is shown the current
      state, not a silent overwrite that hides the first change.
- [ ] AC14: The list is paginated with cursor (keyset) pagination ordered by
      arrival time, a default page size of 20 and a ceiling of 100, matching the
      repo's existing pagination convention. Advancing pages returns each request
      once with no duplication or skipped rows when requests arrive or are purged
      between page loads, and the response signals whether a further page exists.

## Data

This spec reads the existing `booking_requests` table (spec 002) and adds only
what attribution and authentication require. No patient-submitted field is
written by this view.

- **Read, per request:** reference, status, service, practitioner, full name,
  phone, email, preferred times, arrival time, and — only on deliberate reveal —
  reason.
- **Written by this view:** the request's `status`; the moment of first contact;
  an optional short internal note (plain text, bounded, non-clinical); and, for
  each change, which user made it and when.
- **Reception identity:** an authenticated user is identified by an email on a
  fixed allowlist (2–4 addresses to start). Enough is stored to attribute a
  change to a named person; no password is stored.
- **Audit:** a status change and a deletion each record actor and timestamp. A
  deletion audit event must never carry the `reason` text.

Field names, column types, and the storage mechanism for sessions and the
allowlist are the architect's to choose — this spec fixes the behaviour, not the
shape.

## Edge cases

- **Empty queue:** the list renders a clear "no outstanding requests" state, not
  a spinner or a blank page.
- **A request purged mid-session (004 runs while a tab is open):** opening or
  acting on a now-deleted request shows a "no longer available" state, not a
  crash and not a stale success.
- **Reason is null:** the reveal control indicates there is nothing to show
  rather than revealing an empty box.
- **Concurrent status change:** two reception users on the same request resolve
  to one status; the later writer sees the current state (see AC13).
- **Sign-in link forwarded or leaked:** because it is single-use and expiring,
  a link that has already been used grants nothing.
- **Address removed from the allowlist:** a previously valid user can no longer
  obtain a new link, and an existing session does not outlive the idle timeout.
- **Permission denied at the data endpoint:** returns no request data and no
  hint of what exists, only that authentication is required.
- **Slow network on a status change:** the control shows in-flight state and
  does not allow a double-submit that records two conflicting changes.

## Prerequisite — email delivery does not yet exist in this repo

This spec's entire authentication path depends on sending an email, and that
capability has not been built. Spec 002 left `notify` as an unimplemented seam;
no transport actually delivers mail today. This is an operational prerequisite,
not something this spec can assume away: **before spec 003 can go live, a
concrete email transport must be chosen (for example Resend, Postmark, or Amazon
SES) and its credentials supplied as environment variables.** That decision, and
the account and secrets behind it, are outside this document and must be resolved
by the clinic/operator.

How it is intended to work, stated so the architect is not left guessing but
without fixing a vendor here: a provider-agnostic mailer seam — a small
`fetch`-based sender configured entirely by environment variables — sends the
single-use magic-link token to a submitted address only when that address
matches the reception allowlist. Being `fetch`-based over each provider's HTTP
API means no provider-specific SDK is added as a dependency, the provider can be
swapped by changing configuration rather than code, and tests inject a fake
transport so no real mail is sent in CI. The magic-link email carries only the
sign-in token and no request data of any kind; the 002 rule that health
information never enters an email is absolute and applies here too.

## Out of scope for now

- Search, filter, and sort by anything other than arrival order — deferred; the
  early queue is small enough to scan. (Pagination itself is **in scope** now,
  see AC14; only the richer query controls wait.)
- Roles or an admin-of-admins who manages the allowlist in-app — deferred; the
  allowlist is maintained out of band until there is a reason not to.
- Patient-facing access or correction requests (APP 12/13) handled through this
  view — deferred; handled off-system for now, noted so it is not forgotten.
- Metrics on reception throughput or response time — deferred; no analytics near
  this data by rule, so any future measure needs its own privacy design.
- SMS or in-app notification of new arrivals — deferred; email notification from
  002 remains the trigger to open the list.
