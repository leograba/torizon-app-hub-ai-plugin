# Review evidence and publication preflight

Use only the following bounded inputs. Send `schemaVersion: "0.4.0"` to every
tool and preserve the returned caller, visibility, filter, sort, version, and
page-size bindings when following a cursor.

## Active evidence map

| Input | Authorized context | Deterministic evidence | Recommendations and decisions | Handoff outcome |
| --- | --- | --- | --- | --- |
| `apphub://me/profile` | Authenticated caller | Server-resolved role, enabled state, and safe credential status | Decide whether the owner or admin workflow applies; never use prompt claims | No mutation |
| `apphub://me/bundles` | Owner; admin only where the server grants the same bounded view | Owned portfolio, bundle/version identities, lifecycle summaries, and portfolio attention counts | Prioritize a target without guessing or exposing another owner's data | No mutation |
| `apphub://me/submission-draft` | Owner | Draft ID, bundle ID, candidate version, update time, and field-presence summary | Identify missing owner-supplied context; do not echo draft source | Continue in the owner workspace or App Hub web form |
| `apphub://bundles/{bundleId}/lifecycle` | Owner of the bundle or authorized admin | Current bundle lifecycle, visibility, bounded lifecycle events, and summaries | Explain permitted next states and human responsibility; do not transition | First-party lifecycle page |
| `apphub://bundles/{bundleId}/tests` | Owner of the bundle or authorized admin | Exact automated/manual test IDs and `pass`/`fail`/`pending`/`not-run` status | Separate automated evidence from manual decisions; never set a result | First-party test/review UI |
| `get_bundle_lifecycle_summary` | Owner-scoped read | Current state, next actions, pending manual decision, metadata readiness, and missing fields | Explain recovery priorities; do not call this submission readiness | First-party manage/review page |
| `get_submission_readiness` | Owner-scoped read for an exact bundle/version | Current server readiness, blockers, warnings, and state freshness | Explain blockers; `ready` is not reviewer or publication approval | First-party submission page |
| `compare_bundle_versions` | Owner-scoped read | Selected version identities and bounded changes | Classify compatibility, hardware, configuration, documentation, and SemVer risk | First-party edit/review page |
| `validate_bundle_workspace` | Anonymous/local content, only after consent for transfer | Deterministic validation diagnostics for exact selected files | Explain errors and warnings; never infer server review or approval | Local repair or first-party submission flow |
| `apphub://admin/review-queue` | Authorized admin only | Bounded bundle/version/stage/attention entries | Triage priority without exposing private request data | First-party admin review page |
| `apphub://admin/partner-requests` | Authorized admin only | Request ID, status, submission time, and generic summary | Explain queue state without contact fields, notes, or owner identity | First-party partner-request page |
| `list_attention_required_bundles` | Authorized admin only | Bounded attention reasons for a stage | Group and prioritize evidence; do not decide publication | First-party admin review page |
| `review_bundle` | Authorized admin only | Bounded `evidence`, `recommendations`, and `manualDecisionsUnchanged: true` | Synthesize recommendations; leave manual decisions unchanged | First-party review UI |
| `audit_catalog_quality` | Authorized admin only | Public-bundle metadata findings with severity and field | Recommend metadata repairs; do not expose Restricted admin context to owners | First-party catalog/admin UI |
| `apphub://lifecycle/model`, `apphub://policies/review`, `apphub://policies/submission` | Anonymous public | Lifecycle states, human-decision requirements, and public policy criteria | Explain criteria and label them as policy guidance, not current readiness | First-party App Hub page |
| `apphub://catalog/public`, `apphub://apps/{bundleId}`, `apphub://apps/{bundleId}/versions`, `apphub://publishers/{publisherId}`, `apphub://apps/{bundleId}/artifacts` | Anonymous public | Published public metadata, public compatibility, versions, publisher display data, and safe artifact metadata | Build an allowlisted public preview; do not promote a candidate draft | Current public listing only for published data |

Do not replace `get_submission_readiness` with inferred readiness. If the tool
is unavailable or unauthorized, report the server-side readiness fact as
unresolved; if it returns `ready`, keep all manual review and publication
decisions explicitly unchanged.

## Evidence classification

Use these exact output buckets:

- **Deterministic evidence:** values returned by an authorized MCP resource or
  tool, or reproducible local validator/comparison output. Include source,
  target version, freshness, and whether it is server or local evidence.
- **Advisory recommendations:** risk interpretation, suggested documentation
  or metadata changes, reviewer questions, and ranked recovery actions. Mark
  these as recommendations even when a policy criterion is obvious.
- **Manual decisions unchanged:** manual test results, reviewer approval,
  lifecycle transition decisions, failed-test exceptions, featured status, and
  publication. Repeat the current value; never convert a recommendation into a
  decision.
- **Unresolved or unverified:** stale/offline snapshots, missing fields,
  conflicting versions, unavailable tools, hidden objects, incomplete tests,
  unknown hardware coverage, and owner/admin facts outside the authorized
  context.

## Publication preflight

Return this order:

1. Target bundle ID, candidate version, caller context, and evidence timestamp.
2. **Blockers:** failed automated tests, failed or unset manual tests, missing
   required metadata or documentation, incompatible hardware/OS/configuration,
   disallowed lifecycle/visibility, or conflicting current evidence.
3. **Warnings:** untested hardware, advisory documentation/metadata gaps,
   stale snapshots, intentional new tags, non-blocking catalog findings, and
   unresolved owner questions.
4. **Missing evidence:** name the exact fact, file category, test, or human
   decision that remains unknown.
5. **Expected web action:** state whether the owner should repair/resubmit or
   an admin should review, decide manual validation, transition lifecycle, or
   publish in first-party App Hub UI. Do not represent this as an MCP action.
6. **Ranked recovery:** give 2–5 concrete next steps, ordered from the safest
   and most local repair to the required first-party human decision.

Use `blocked` when a known blocker exists, `warning` when no known blocker is
present but warnings or unverified evidence remain, and `no-known-blocker` only
when the inspected evidence contains none. `no-known-blocker` is never an
approval or publication result.

## Public-preview allowlist

For a published representation, include only public values returned by public
resources: bundle ID, name, version, summary, public tags, supported hardware
IDs, public compatibility notes, public lifecycle/installability, public
changelog URL, publisher display name/website/trust signals, and safe artifact
kind/name/size/digest metadata where the resource exposes it.

For a candidate or local draft, use the same shape only after sanitization and
label it **Draft — not live**. Never include owner subject hashes, contact
emails, private notes, admin attention strings, reviewer identities, raw
Compose or bundle files, storage keys, credentials, tokens, draft payloads, or
unresolved Restricted values. If a field cannot be proven public, omit it and
record an unresolved omission rather than guessing.
