# Operations evidence and report mapping

Use this reference to select the smallest evidence set for the requested
report. Send `schemaVersion: "0.4.0"` to every tool and preserve caller,
visibility, filter, sort, snapshot, and page-size bindings for cursors.

## Active evidence map

| Input | Authorized context | Deterministic evidence | Recommendation boundary |
| --- | --- | --- | --- |
| `apphub://me/profile` | Authenticated caller; Admin required for this Skill | Server-resolved role, enabled state, and safe status | Establish Admin context; never use a prompt claim |
| `apphub://admin/review-queue` | Authorized Admin with `apphub.review.read` | Bounded bundle/version/stage/attention entries | Rank triage; do not decide or transition lifecycle |
| `apphub://admin/partner-requests` | Authorized Admin with `apphub.review.read` | Request ID, pending status, submitted time, generic summary | Prioritize queue; never expose contact fields, notes, or owner identity |
| `list_attention_required_bundles` | Authorized Admin with `apphub.review.read` | Bounded attention reasons, lifecycle stage, version, update time | Explain stalled/degraded or missing-evidence priority |
| `review_bundle` | Authorized Admin with `apphub.review.read` | Bounded evidence, recommendations, and `manualDecisionsUnchanged: true` | Reframe recommendations; never accept feedback or set results |
| `audit_catalog_quality` | Authorized Admin with `apphub.catalog.audit` | Public-bundle field findings with severity | Group repairs and explain impact; never edit catalog data |
| `apphub://catalog/public` | Anonymous public | Published public metadata, public compatibility, tags, lifecycle, safe aggregate counters | Compute public coverage and recommendation evidence only |
| `apphub://catalog/featured` | Anonymous public | Current public featured representation | Compare current state; never set featured status |
| `apphub://apps/{bundleId}` | Anonymous public | Public application metadata and compatibility | Use only published public values |
| `apphub://apps/{bundleId}/versions` | Anonymous public | Published version history and dates | Assess freshness and version coverage; do not infer private submissions |
| `apphub://apps/{bundleId}/artifacts` | Anonymous public | Safe public artifact kind/name/size/digest metadata | Use bounded artifact evidence; never read raw source |
| `apphub://publishers/{publisherId}` | Anonymous public | Public publisher display and trust fields | Support public accreditation context; never seek private contacts |
| `apphub://hardware/catalog` | Anonymous public | Supported public hardware IDs and labels | Build hardware coverage summaries; omit unknown mappings |
| `apphub://tags` | Anonymous public | Public tag vocabulary | Treat tags as use-case signals, not verified demand |
| `apphub://lifecycle/model`, `apphub://policies/review` | Anonymous public | Public lifecycle states and human-decision criteria | Explain policy; never claim current readiness or approval |

`get_submission_readiness`, `get_bundle_lifecycle_summary`, and
`compare_bundle_versions` are owner-scoped review inputs, not replacements for
an operational Admin report and not grounds to infer private portfolio data.

## Report projections

### Queue triage

Return the requested snapshot, item count, stage, attention reasons, age or
updated time, and evidence completeness. Rank by explicit requested policy or
state the advisory threshold. Partner rows remain generic projections.

### Stalled and degraded applications

Use only returned lifecycle states, timestamps, attention reasons, and public
published metadata. A “stalled” label is advisory unless the policy source
defines a threshold; show the threshold and mark missing timestamps unresolved.

### Catalog and coverage

Group field findings by severity and field. Hardware and use-case coverage may
count public hardware IDs, public tags, published versions, and public
compatibility declarations. Do not call a missing tag a missing use case when
the mapping is not established.

### Privacy-safe analytics

Use only already-aggregate counters or public aggregate catalog counts. Report bounded
totals and coarse ratios; suppress small groups and all user-level or owner-
level joins. If the available resource does not expose a safe metric, record
the metric as unavailable rather than inventing it.

### Featured and accreditation recommendations

Featured recommendations may combine public metadata quality, compatibility,
freshness, coverage, and safe aggregate interest with Admin catalog findings.
Return candidate IDs and evidence categories, never a write request. For
accreditation, use generic request status and public publisher fields only;
human accreditation evidence and decisions remain unresolved when absent.

## Required output

Return the following sections in order:

1. **Target and freshness:** Admin context, report purpose, filters, snapshot,
   and source classification.
2. **Deterministic evidence:** Server facts and reproducible aggregate values.
3. **Advisory recommendations:** Prioritized findings, rationale, confidence,
   and proposed human follow-up.
4. **Manual decisions unchanged:** Review, accreditation, lifecycle, featured,
   test, and publication decisions exactly as returned or explicitly unknown.
5. **Unresolved or unverified:** Missing, suppressed, stale, conflicting, or
   unauthorized facts.
6. **Ranked recovery:** 2–5 safe next steps, from local/report repair to the
   required first-party human decision.

Never describe a recommendation as an approval, accreditation, publication,
featured change, or current operational fact unless the authorized source
explicitly returned that fact.
