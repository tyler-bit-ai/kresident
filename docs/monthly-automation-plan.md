# Plan: Fully automate the monthly immigration statistics update

Status: reviewed and approved (via `/plan-eng-review`, 2026-07-05). Ready for
implementation by any LLM/agent. This doc is the single source of truth —
implement exactly what's below; do not re-litigate the decisions unless you
find a factual error in the "current state" section.

## Goal

Today, updating the dashboard is 100% manual: the user runs the downloader
locally, generates the dashboard dataset, commits, and pushes. The goal is to
remove all manual steps: a GitHub Actions schedule should detect when the
Ministry of Justice (법무부) publishes a new monthly 통계월보 (around the
20th-24th of each month), download it, rebuild the dashboard, and deploy to
GitHub Pages — with no human involved, except reviewing failures if the
Ministry site breaks the pipeline.

## Current state (verified against the repo, do not re-derive from scratch)

- Public repo: `tyler-bit-ai/kresident` (confirmed via GitHub API — Actions
  minutes are unlimited/free regardless of usage).
- `npm run dev` → `src/app/run-monthly-download.ts` → crawls
  `https://www.immigration.go.kr` (no auth needed), downloads new attachments
  into `data/raw/<year>/<year-month>/`, records them in
  `data/metadata/download-registry.json`. Dedup is by `articleId` +
  `attachmentName` only (see `src/infrastructure/registry/json-download-registry-repository.ts`,
  `isAlreadyDownloaded`) — NOT by content hash, so a corrected re-upload under
  the same article/filename would be silently skipped forever (tracked as
  `TODOS.md` item 1, out of scope for this change).
- `npm run generate:dashboard` → `src/application/dashboard/build-dashboard-dataset.ts`
  → **fully re-parses every file under `data/raw/` from scratch** on every
  run (no incremental merge). This is existing behavior and is NOT being
  changed — it's cheap enough at ~160 files.
- `npm run verify:dashboard-raw` → `src/cli/verify-dashboard-raw.ts` → spot
  checks the generated dataset against representative raw workbooks per
  format, writes `logs/dashboard-raw-verification.json`. This is the
  correctness gate for the automated pipeline.
- `data/raw/` and `data/metadata/download-registry.json` are currently
  **gitignored** — CI has never had access to them. `.github/workflows/deploy-pages.yml`
  only deploys the already-committed `site/` folder on push to `main`; it
  does not run the downloader or generator.
- Registry `localPath` values are currently **absolute Windows paths**
  (e.g. `C:\Codex\kresident\data\raw\2026\2026-02\...`). This will break on
  Linux CI (see Decision 3 below).
- Published report period lags the calendar: the "2026년 2월" (February)
  report has `publishedAt: "2026.03.20"` — confirmed directly from the
  registry data. Data for month N is published in month N+1, around the
  20th-24th. Any logic based on "does periodKey match the current month"
  is wrong (see Decision 4).
- Project has **zero test infrastructure** (no test runner, no test files,
  no `test` script in `package.json`). Not adding one is an explicit,
  reviewed decision for this change.

## Decisions (all reviewed and approved — do not redesign these)

### Decision 1 — Commit `data/raw/` + registry to git
Un-ignore `data/raw/` and `data/metadata/download-registry.json` in
`.gitignore`; commit the existing local files once (160 files, ~19MB — well
within normal git limits, no LFS needed). This gives CI checkouts full
history + registry state, so the existing registry-based dedup "just works"
in CI with zero changes to the download/generate logic. Rejected: GitHub
Actions cache (evicted after 7 days idle — unreliable for a monthly cadence)
and re-crawling all history every run (wasteful, fragile).

### Decision 2 — Validation gate before any commit
Run `npm run verify:dashboard-raw` after `generate:dashboard` and BEFORE any
git commit/push. If it fails, the workflow must fail (exit non-zero) and NOT
commit/push anything. Rely on GitHub's built-in scheduled-workflow-failure
email notification — no extra alerting infrastructure for now.

### Decision 3 — `GITHUB_TOKEN` direct push, deploy folded into the SAME workflow
Use the workflow's default `GITHUB_TOKEN` with `permissions: contents: write`
to commit as `github-actions[bot]` and push directly to `main`. **Critical:**
`GITHUB_TOKEN`-authored pushes do NOT trigger other workflows' `push` events
(GitHub's anti-recursion policy) — so `deploy-pages.yml` would silently never
fire after this workflow's commit. Do not rely on it. Instead, copy the Pages
deploy steps (`actions/configure-pages`, `actions/upload-pages-artifact`,
`actions/deploy-pages`) into the END of this same new workflow, in the same
job, after the commit/push step. `deploy-pages.yml` stays unchanged and
continues to handle manual pushes.

### Decision 4 — Cron schedule + early-exit by download count, NOT by date math
`cron` fires daily from the 20th through the 31st of each month (exact
Ministry publish date varies). The workflow always runs the (cheap) download
step first — this only hits the board pages + registry dedup, no full
re-parse. **Do NOT try to predict whether "this month's data" should exist
by comparing periodKey to the current calendar month** — the publish lag
(N+1 month) makes that comparison permanently false, defeating the
optimization (see "current state" above). Instead: check the downloader's
own reported `downloaded` count.
- `downloaded == 0` → exit immediately, skip generate/verify/commit/deploy.
- `downloaded > 0` → continue to generate → verify → commit → deploy.
Read this count via a GitHub Actions **step output** (`$GITHUB_OUTPUT`), not
by re-parsing the CLI's pretty-printed JSON off stdout — that's brittle.
Since there's no date math in this design, timezone (UTC cron vs Asia/Seoul)
is a non-issue.

### Decision 5 — Registry path portability fix (required, not optional)
`json-download-registry-repository.ts`'s `saveRecord` currently stores
`localPath` as an OS-native absolute path. On Linux CI,
`dashboard-source-records.ts`'s `path.resolve(record.localPath)` will not
recognize Windows backslashes as separators, so registry records won't match
files on disk — `generate:dashboard` would still succeed (falls back to
`manual-...` placeholder records) but source attribution (article
title/publish date) for all 160 historical files would be silently lost.
Fix: store `localPath` relative to `rawDir` (POSIX separators) on save;
reconstruct the absolute path relative to `rawDir` on read. Migrate the
existing 160 registry entries as part of this change (one script run).

### Decision 6 — 60-day auto-disable risk: accepted, not mitigated
GitHub auto-disables scheduled workflows after 60 days with no repo push
activity. If the Ministry changes site structure and the verify gate fails
for 2+ consecutive months, the schedule could silently disable itself and
not auto-resume even after the site is fixed. User explicitly chose to
accept this risk (no GitHub Issue-based alerting) given the site has been
structurally stable for years. Document this tradeoff in the README so
future-you isn't surprised.

### Decision 7 — Keep the existing full re-parse (no incremental dataset merge)
`build-dashboard-dataset.ts` stays untouched. Building incremental
merge logic was explicitly rejected as scope creep unrelated to the
automation goal — the full re-parse of ~160 files is cheap at this scale.

### Decision 8 — Repo hygiene bundled into this change
- Delete root-level `출력파일_예시.xlsx` (confirmed disposable sample).
- Add `logs/*.json` to `.gitignore` (currently only `*.log` is ignored,
  so `logs/dashboard-raw-verification.json` was showing as untracked).
- Add `.codex-backups/` to `.gitignore`.

### Decision 9 — Self-hosted runner, not GitHub-hosted (discovered post-implementation)

The first real `workflow_dispatch` run failed at the download step with
`TypeError: fetch failed`. Improving the error message (walking the `.cause`
chain in `fetch-with-retry.ts`) revealed the real cause:
`ConnectTimeoutError: Connect Timeout Error (attempted address:
www.immigration.go.kr:443, timeout: 10000ms)`. A connect-level timeout
(packets silently dropped, no TCP RST, no HTTP response) rather than an
HTTP-level rejection is the signature of a network firewall dropping
traffic from a source IP range — in this case, GitHub-hosted runners
(Azure datacenter IPs, non-Korean). This is a well-known pattern for
Korean government (`.go.kr`) sites, which commonly block overseas/cloud IP
ranges outright. No amount of workflow-level retry/backoff logic fixes a
network-level block — the job must run from a machine with a Korean
residential/office IP that can actually reach the site.

**Fix:** run the job on a self-hosted runner instead of GitHub's cloud
runners. The user has an always-on Mac mini; this became the runner. Changes
required:
- `.github/workflows/monthly-update.yml`: `runs-on: ubuntu-latest` →
  `runs-on: self-hosted`.
- Replace the `jq`-based downloaded-count extraction with a `node -e`
  one-liner (`jq` isn't guaranteed present on a fresh macOS machine; Node is
  already required and installed by `actions/setup-node`).
- No changes needed to `actions/checkout`, `actions/setup-node`,
  `actions/configure-pages`, `actions/upload-pages-artifact`,
  `actions/deploy-pages` — all work the same on a self-hosted macOS runner.
- The GitHub Actions self-hosted runner agent must be installed and
  registered on the Mac mini (via repo Settings → Actions → Runners → New
  self-hosted runner), and installed as a persistent background service
  (`./svc.sh install && ./svc.sh start`) so it survives reboots/logout and
  is listening whenever the schedule fires.
- Security note: self-hosted runners on a **public** repo are only safe
  when the workflows that use them don't run on `pull_request` from forks
  (which would let anyone execute arbitrary code on the runner machine).
  This workflow only triggers on `schedule` and `workflow_dispatch`, both of
  which always run the workflow definition from `main` (which only the repo
  owner controls) — safe as configured. Do not add `self-hosted` to any
  future workflow that reacts to fork pull requests.

## Final architecture (implement exactly this flow)

```
cron: daily 20th-31st (any hour — no date math needed)
        │
        ▼
[1] npm ci
[2] npm run dev (download)          — cheap: board fetch + registry dedup, no full re-parse
        │
        ▼
   downloaded > 0 ? ──NO──> exit 0 (no further steps run)
        │YES
        ▼
[3] npm run generate:dashboard      — existing full re-parse of data/raw/**, unchanged
        │
        ▼
[4] npm run verify:dashboard-raw    ──FAILS──> workflow fails, NOTHING committed
        │PASSES                                (GitHub emails on scheduled-workflow failure)
        ▼
[5] git diff --quiet? ──NO CHANGES──> exit 0
        │CHANGES
        ▼
[6] git config user github-actions[bot]; add data/raw + registry + site/; commit; push (contents: write)
        │
        ▼
[7] configure-pages → upload-pages-artifact → deploy-pages   (same job — no cross-workflow trigger needed)
```

## Implementation tasks (in order)

1. **T1** — `.gitignore`: un-ignore `data/raw/` and
   `data/metadata/download-registry.json`; add `logs/*.json` and
   `.codex-backups/`.
2. **T2** — Delete `출력파일_예시.xlsx`; one-time `git add` of the existing
   local `data/raw/` (160 files) + `download-registry.json`.
3. **T3** — Normalize registry `localPath` to relative-to-`rawDir` (POSIX
   separators) in `json-download-registry-repository.ts` (save) and
   `dashboard-source-records.ts` (read/resolve). Migrate the 160 existing
   entries. Verify: after migration, `generate:dashboard`'s output
   `sourceFile.articleTitle` values are real titles, not `manual-...`
   placeholders.
4. **T4** — New `.github/workflows/monthly-update.yml` implementing the flow
   above. Use `$GITHUB_OUTPUT` for the downloaded-count check, not stdout
   parsing. `permissions: contents: write, pages: write, id-token: write`.
5. **T5** — Update `README.md`: document the new automated flow, the
   accepted 60-day auto-disable risk, and that `deploy-pages.yml` remains
   only for manual pushes.
6. **T6/T7** — See `TODOS.md` (checksum-based correction detection;
   auto-commit guardrails) — explicitly deferred, do not build in this PR.

## Verification before calling this done

- Manual `workflow_dispatch` dry run of the new workflow (no automated test
  framework exists in this project — this was a reviewed, accepted
  tradeoff, not an oversight).
- Confirm the dry run's commit actually results in the live GitHub Pages
  site updating (this is the exact failure mode the review caught — verify
  it, don't assume it).

## Explicitly NOT in scope for this change

- Rewriting `build-dashboard-dataset.ts` for incremental merging.
- Adding a test framework to the project.
- Checksum-based re-detection of Ministry corrections (`TODOS.md` #1).
- Guardrails on auto-committed binaries beyond existing attachment filters
  (`TODOS.md` #2).
- PAT/GitHub App token setup (`GITHUB_TOKEN` is sufficient with Decision 3).
- Changing `deploy-pages.yml` itself (it's untouched, still handles manual
  pushes).
