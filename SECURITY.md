# Security Policy

Please report vulnerabilities privately to **email@ondrejmisak.cz** — do not open public issues for security reports.

Session tokens are stored in your OS keychain (never in plaintext) and the CLI sends no telemetry.
Outbound traffic is limited to the TF Hub API, Google's token endpoint (session refresh) and the npm
registry (a daily update check, disable with `NO_UPDATE_NOTIFIER=1`); the browser login page additionally
loads SRI-pinned scripts from jsdelivr and gstatic.
