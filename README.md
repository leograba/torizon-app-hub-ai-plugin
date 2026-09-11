# Torizon App Hub AI Plugin

This repository is the App Hub-controlled, marketplace-independent distribution
source for the Torizon App Hub AI Plugin. It is not an official Claude or
OpenAI marketplace listing.

Start at the [App Hub installation page](https://tznapphub.link/ai-plugin),
choose your journey and host, and use the current approved release shown
there. The page is the source of truth for channel status, checksums, recovery,
OAuth, updates, disconnect, and removal.

## Host channels

- Codex: add this repository through Codex's custom Git marketplace flow, then
  install `torizon-app-hub` from the `torizon` App Hub catalog.
- Claude Code: add this repository through Claude Code's custom marketplace
  flow, then install `torizon-app-hub` from the App Hub catalog.
- Generic fallback: download the `generic.zip` release asset only when no
  approved custom host channel is available. It provides reduced public
  discovery and bundle-building capabilities.

Use an immutable release tag or commit. Do not install from an unreviewed
default-branch snapshot, and do not add a second standalone App Hub MCP entry.
After installation, start a fresh host session. OAuth is host-managed and is a
separate step from package installation.

## Release verification

Each release under `releases/<version>/` contains the generated package assets,
release metadata, evidence, and `SHA256SUMS`. Verify the exact archive checksum
before extracting or installing an archive. The App Hub distribution index
records the final repository commit, release asset URLs, checksums, approval,
and revocation state.

Updates and rollback are channel-scoped. If a channel is revoked, follow the
App Hub recovery guidance and use the previous approved release or the generic
fallback. Never place credentials, bearer tokens, authorization codes, or
client secrets in this repository or its URLs.
