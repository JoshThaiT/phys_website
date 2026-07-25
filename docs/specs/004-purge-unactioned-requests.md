# 004 — Purge of expired booking requests

**Status:** draft — awaiting approval
**Author:** spec-writer, 2026-07-24

## Problem

Spec 002 made a promise the system does not yet keep: "an unactioned request is
purged after 90 days." Every `booking_requests` row is written with a
`purgeAfter` date 90 days out (002 AC10), but nothing ever acts on it. Rows
accumulate forever, and because one column holds health information (`reason`),
an unbounded table is a growing pool of sensitive data kept past the retention
period the clinic committed to — the precise failure the Privacy Act and the NSW
Health Records and Information Privacy Act exist to prevent.

Spec 003 deliberately left this gap open. The admin list reads and updates rows
within their existing window and defers all deletion-by-time to this spec. So the
job described here is the missing half of the retention story: it runs on its own
schedule, with no human in the loop, and removes requests once they pass their
retention date — both the ones nobody ever actioned and the ones reception
finished with, on the two clocks defined below.

## Goal

Booking requests are automatically and permanently deleted once they pass their
retention date, so no request — and no `reason` text — is ever held longer than
the clinic committed to.

## Non-goals

- No change to how requests are created, validated, or notified (002/005), and
  no change to the admin list's read/update behaviour (003).
- No user-facing surface. This job has no UI; reception does not run it and does
  not see it run.
- No soft delete, archive, tombstone, or "recycle bin." Expired rows are
  physically removed; a retained flag would keep health data past its date and
  defeat the purpose.
- No change to the `purgeAfter` value on any row. This job reads retention dates;
  it never extends, resets, or shortens them.
- No export or backup of rows before deletion. A saved copy of expired health
  data is the same violation in a different file.
- No manual "purge now" trigger and no per-request deletion — that already exists
  in 003 for reception. This spec is the time-based automatic path only.

## Privacy requirements — requirements, not preferences

These inherit from spec 002 and are not open for relitigation here.

1. **Deletion is permanent.** After a successful run the row is gone from the
   table; it is not recoverable from application state.
2. **No health information survives the job, anywhere.** The `reason` text is
   never read, copied, logged, or included in any audit record the job writes.
3. **The audit trail the job leaves carries no personal or health data** — no
   reference, name, contact, or reason; only a count and a timestamp (see Data).
4. **The trigger is not publicly reachable.** Only the scheduler, proving a
   shared secret, can cause a purge to run.
5. **The job never extends retention.** Reading a row does not touch its
   `purgeAfter`; being seen by the job is not "actioning" it.

## Retention rule — the two clocks

A request is eligible for deletion when its retention date has passed. Which date
applies depends on whether reception ever engaged with it.

1. **Unactioned request** — still `pending`, never contacted. Eligible once its
   `purgeAfter` date (90 days from creation, per 002) has passed. This is the
   literal 002 promise.
2. **Actioned request** — status is `contacted`, `scheduled`, or `declined`, or
   a contact timestamp is recorded. Eligible 30 days after the moment it was
   actioned, regardless of `purgeAfter`. Once reception has engaged, the
   authoritative record lives in the practice-management system and the website
   copy is redundant health data that should not linger for the remainder of the
   90 days.

The effect is that every request is eventually deleted: nothing unactioned
outlives 90 days, and nothing actioned outlives its action by more than ~30 days.
The two clocks never conflict — a row is on exactly one of them at any moment,
determined by its current status.

## Job flow

1. The scheduler fires on its cadence and calls the internal purge trigger,
   presenting the shared secret.
2. A request without the correct secret, or from any public caller, is rejected
   and nothing is deleted.
3. The job selects rows whose applicable retention date (per the two clocks) has
   passed, in a bounded batch, and deletes them permanently.
4. It repeats batches until no eligible rows remain or a per-run limit is
   reached, whichever comes first.
5. It writes one summary audit record — actor `system`, the run time, and how
   many rows were deleted, split into unactioned and actioned — and finishes.
6. If a batch fails, the job stops cleanly; rows already deleted stay deleted,
   and the next scheduled run re-selects whatever remains.

## Acceptance criteria

- [ ] AC1: A request that is still `pending` and whose `purgeAfter` has passed is
      permanently deleted on the next run and is absent from the admin list.
- [ ] AC2: A request that has been actioned (`contacted`, `scheduled`, or
      `declined`, or with a contact timestamp) is permanently deleted once 30 days
      have passed since it was actioned, even if its `purgeAfter` has not.
- [ ] AC3: An actioned request whose action was fewer than 30 days ago is **not**
      deleted, even if its `purgeAfter` date has already passed.
- [ ] AC4: A `pending` request whose `purgeAfter` is in the future is not deleted.
- [ ] AC5: Deletion is physical: after a run the row cannot be read back through
      any application path; there is no soft-delete flag.
- [ ] AC6: The job writes exactly one audit record per run, with actor `system`,
      a run timestamp, and counts of rows deleted (unactioned and actioned), and
      it contains no reference, name, contact, or `reason`.
- [ ] AC7: The `reason` column is never read by the job and never appears in any
      log, metric, or audit record the job produces.
- [ ] AC8: The trigger rejects any caller that does not present the scheduler
      secret; no request data is deleted or returned on rejection.
- [ ] AC9: The job runs in bounded batches and is idempotent: interrupting it
      mid-run leaves already-deleted rows deleted, deletes no row twice, and the
      next run resumes from the remaining eligible rows.
- [ ] AC10: A run that deletes nothing (no eligible rows) still completes
      successfully and records a zero-count audit entry.
- [ ] AC11: The job never modifies `purgeAfter`, status, or any other field on a
      surviving row; reading a row to evaluate eligibility does not action it.
- [ ] AC12: A single run cannot exceed its serverless time budget: it stops at a
      per-run batch ceiling and lets the next scheduled run continue, rather than
      running long or timing out.

## Data

This job reads and deletes rows in the existing `booking_requests` table and
writes to the audit table introduced in spec 003. It introduces no new
patient-facing fields.

- **Read, per candidate row:** status, the contact/action timestamp, and
  `purgeAfter` — the fields needed to decide eligibility. The `reason` is never
  among them.
- **Deleted:** the entire row, once eligible.
- **Written:** one audit record per run — actor `system`, run timestamp, count of
  unactioned rows deleted, count of actioned rows deleted. No per-row detail, no
  identifiers, no `reason`. This is the only residue of a purge.

Whether "the moment it was actioned" reads from `status_updated_at`,
`contactedAt`, or another timestamp, and the exact batch size, per-run ceiling,
and schedule cadence, are the architect's to choose within the behaviour fixed
here.

## Scheduling and failure

- **Trigger:** a scheduled job (Vercel Cron) invokes an internal serverless
  endpoint once daily, off-peak in Australian time. The endpoint is not part of
  the public API surface and runs nothing without the scheduler secret. Migrations
  are never run from this or any handler (CLAUDE.md).
- **Time budget:** the run must fit a serverless invocation. It deletes in
  batches with a per-run ceiling; if eligible rows remain when the ceiling is
  reached, they are left for the next run. Nothing about correctness depends on
  clearing everything in one invocation.
- **Partial failure:** each batch commits independently. A crash or error stops
  the run; already-committed deletions stand, no row is deleted twice, and the
  next scheduled run re-selects the remainder. The failure is logged by count and
  error only — never by row content.
- **Observability:** each run's outcome (started, deleted counts, completed or
  failed) is observable without exposing any request data, so the clinic can
  confirm retention is actually happening.

## Edge cases

- **Row becomes eligible between selection and deletion:** harmless — it is
  deleted this run or the next; either way it does not survive past its date.
- **Reception actions a request the same day it would otherwise purge:** the row
  moves from the 90-day clock to the 30-days-after-action clock, so it is not
  deleted now; engagement never causes immediate loss of a record reception is
  mid-way through booking.
- **Clock skew or a row with a null action timestamp but a non-`pending`
  status:** eligibility must be decided from a definite timestamp; if the field
  the 30-day clock depends on is absent, the row is treated as not-yet-eligible
  rather than deleted early. A record is never deleted on ambiguous timing.
- **Two runs overlap (a slow run still executing when the next fires):** deletion
  is idempotent and batched, so an overlap cannot double-delete or corrupt
  counts; at worst a row is attributed to whichever run removes it.
- **Empty table or no eligible rows:** the run succeeds and records a zero-count
  audit entry (AC10).
- **Scheduler misfires or is disabled:** rows are not deleted on time, which is a
  retention breach the observability signal must make visible; the job itself
  does nothing unsafe, but a silent absence of runs must be detectable.

## Out of scope for now

- Configurable per-service or per-status retention periods — deferred; the two
  clocks here are fixed until there is a reason to vary them.
- Restoring or undoing a purge — deferred and, by design, not possible; deletion
  is permanent.
- Purging or retention of the `admin_audit` records themselves — deferred; those
  carry no personal or health data, so they are not on this job's clock.
- Alerting when a scheduled run is missed — deferred to whatever owns operational
  monitoring; this spec requires the signal be observable, not that it page.
