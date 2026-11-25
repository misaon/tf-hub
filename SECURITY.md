# Security Policy

Please report vulnerabilities privately to **email@ondrejmisak.cz** — do not open public issues for security reports.

Session tokens are stored in an owner-only file (`~/.config/tf-hub/credentials.json`, permissions 0600) — the same model npm, gcloud and docker use — and the CLI sends no telemetry.
Outbound traffic is limited to the TF Hub API, Google's token endpoint (session refresh) and the npm
registry (a daily update check, disable with `NO_UPDATE_NOTIFIER=1`); the browser login page additionally
loads scripts from jsdelivr and gstatic, each pinned with a subresource integrity hash (the Firebase modules
through an import map). The login callback only accepts the page it served — a per-login nonce plus host and
origin checks — and the local server shuts down after five minutes.

Releases are built in a job without secrets and published with npm provenance; the standalone binaries carry
GitHub build attestations and a `SHA256SUMS` file.
