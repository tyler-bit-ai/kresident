# TODOS

## 1. Detect Ministry corrections to already-downloaded files (checksum-based)

**What:** Extend registry dedup so a file is re-downloaded when its checksum changes, not just when `articleId`+`attachmentName` are new.

**Why:** `isAlreadyDownloaded` (`src/infrastructure/registry/json-download-registry-repository.ts`) only compares `articleId` + `attachmentName`. If the Ministry republishes a corrected file under the same article/filename, the automated pipeline will treat it as already downloaded and silently keep serving stale numbers indefinitely. The `checksum` field already exists on `DownloadRecord` but isn't used for comparison.

**Pros:** Closes a real (if rare) data-correctness gap; low implementation cost since the field already exists.

**Cons:** Requires fetching the remote file's checksum (or re-downloading to compare) even for "already downloaded" entries, adding minor request overhead to every run.

**Context:** Surfaced during the 2026-07 review of the GitHub Actions monthly-automation plan (plan-eng-review). Deferred because it broadens this PR's scope beyond "automate the existing manual flow" — the manual flow has the same gap today.

**Depends on / blocked by:** None.

---

## 2. Guardrails on auto-committed downloaded files

**What:** Add basic sanity checks before the automated workflow commits newly downloaded files — file extension allowlist (`.xls`/`.xlsx`), max file size, max file count per run.

**Why:** Once downloads are committed by a bot with no human review, a compromised or malfunctioning Ministry site could get an unexpected binary auto-committed to the repo. `isEntryStatisticsAttachment`/`isLegacySecondFileAttachment` (`src/infrastructure/parsers/immigration-board-parser.ts`) already filter by attachment name/type as a first line of defense, so this isn't urgent, but it's a second layer worth adding once the pipeline is unattended.

**Pros:** Cheap to implement (a few guard conditions); meaningfully reduces blast radius of an unattended pipeline.

**Cons:** Not implemented now, so until this lands the pipeline relies solely on the existing attachment-name filter.

**Context:** Surfaced during the same 2026-07 automation review, prompted by the outside-voice (Codex) pass noting that "opaque binary auto-committed by a bot" is the actual risk, not repo size.

**Depends on / blocked by:** None.
