# Bundle Maintainer compatibility policy

The maintainer uses the MCP contract version `0.4.0`, App Bundle schema range
`>=2.0.0 <3.0.0`, and shared validator range `>=2.0.0 <3.0.0` unless a later
compatible contract is explicitly returned by the server.

Live resources are preferred only when their declared schema and validator
versions are compatible. Packaged snapshots are a bounded offline fallback and
must be labelled as potentially stale. A failed compatibility negotiation is
not a content-validation failure and must not be retried with guessed fields.

The `bundle-assembler` package and download URL are live compatibility aliases
for the unified `torizon-app-hub-contributor.skill` archive. They remain in
service until contributor Task 3 equivalence, hosted evidence, and release approval
authorize retirement without a deployed download gap. Bundle Maintainer owns
update/version/lifecycle guidance; Bundle Builder owns creation and repair of
the first bundle.
