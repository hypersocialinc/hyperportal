# CLI design rules (agent-legible tooling)

Both CLIs — `bin/hyperportal` (scaffold/verify) and each portal's
`scripts/portal.mjs` (access/operate) — follow five rules. Keep them when
extending either; they're what makes the tooling safe for an agent (or a
distracted human) to drive.

## 1. Self-verifying mutations

A state change reports success only after **observing the new state from the
outside**: `add` probes `/r/<token>` for a redirect, `revoke` probes for a
403, `publish` polls `/api/version` until the pushed commit actually serves.
This matters more for agents than humans — an agent will confidently relay
"revoked ✓" to the user, so the ✓ must be a fact about the live site, not
about an API call having returned 200. When adding a mutation, add its probe.

## 2. Non-interactive, ambiguity is a hard error

No prompts, no "did you mean". `add` refuses an org that already exists;
`get-link` refuses one that doesn't; duplicate names die with "fix by hand";
`new` refuses a non-empty directory and a non-kebab name. Wrong guesses about
identity must be impossible, not unlikely — an agent can't eyeball a prompt.

## 3. `--json` on reads, exit codes always

Every read command offers `--json` so an agent parses instead of scraping ANSI
tables. Every command exits non-zero on failure — including *partial* failure
(revoke verified failed ⇒ `exitCode = 1` even though the env write succeeded).

## 4. Dry-run against real state

`PORTAL_DRY_RUN=1` reads real production data and writes nothing, printing
what would change. Rehearsal must exercise the same code path as the real run
minus the writes — a fake dry-run that skips the reads validates nothing.

## 5. Fail loud, with the recovery command

Errors state what happened *and what to run next*: the failed `writeTeams`
prints the backup path and the exact restore command; the stale-deployment
guard names both commits and says "push or wait, then retry". Assume the
reader (human or agent) has no other context.

## Anti-patterns seen in the wild

- Reporting success from the API response instead of probing (rule 1) — this
  is exactly how dashboard-edit revokes silently no-op.
- Adding an interactive confirm ("y/N?") for safety — it breaks agents and
  trains humans to autopilot `y`. Safety comes from dry-run + verification.
- Letting a command "helpfully" create what it couldn't find (rule 2) — a
  typo'd org name must never mint a new link.
