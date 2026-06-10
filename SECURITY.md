# Security Policy

Please report vulnerabilities privately to **email@ondrejmisak.cz** — do not open public issues for security reports.

Session tokens are stored in an owner-only file (`~/.config/tf-hub/credentials.json`, permissions 0600) — the same model npm, gcloud and docker use — and the CLI sends no telemetry.
Outbound traffic is limited to the TF Hub API, Google's token endpoint (session refresh) and the npm
registry (a daily update check, disable with `NO_UPDATE_NOTIFIER=1`); the browser login page additionally
loads SRI-pinned scripts from jsdelivr and gstatic.
