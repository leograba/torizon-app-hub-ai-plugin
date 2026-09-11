# Contributor safety

- Local project content is Sensitive by default.
- App Hub and Torizon credentials are never bundle inputs and must not appear in prompts, files sent for validation, logs, or diagnostics.
- Local edits and local Git operations are separate decisions. Editing requested bundle files does not authorize Git mutations.
- Live MCP resources are authoritative only for their stated version and freshness. Packaged resources may be stale.
- Deterministic validation does not replace human review or authorize submission.
