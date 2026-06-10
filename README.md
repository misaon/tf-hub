# tf-hub

<!-- automd:badges color="yellow" license name="@misaon/tf-hub" -->

[![npm version](https://img.shields.io/npm/v/@misaon/tf-hub?color=yellow)](https://npmjs.com/package/@misaon/tf-hub)
[![npm downloads](https://img.shields.io/npm/dm/@misaon/tf-hub?color=yellow)](https://npm.chart.dev/@misaon/tf-hub)
[![license](https://img.shields.io/github/license/misaon/tf-hub?color=yellow)](https://github.com/misaon/tf-hub/blob/main/LICENSE)

<!-- /automd -->

[![ci](https://github.com/misaon/tf-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/misaon/tf-hub/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/misaon/tf-hub/graph/badge.svg)](https://codecov.io/gh/misaon/tf-hub)

The company intranet in your terminal — and in your AI tools.

> [!WARNING]
> tf-hub is in **beta**. Commands and MCP tool names may still change between minor versions.

tf-hub talks to the TF Hub API: the place where our worklogs, absences, documents, projects and The Game live.
Everything the web app can do, you can do here — list your documents, request a vacation, log work, donate
bonus XP. And because every command doubles as an MCP tool, your AI agent can do it for you.

## Install

**Via npm** — Node ≥ 20 is all you need; the install is about two megabytes:

```sh
npm install -g @misaon/tf-hub
```

**Direct download** — grab the build for your platform from the
[latest release](https://github.com/misaon/tf-hub/releases/latest), make it executable and put it on your `PATH`:

```sh
curl -fsSL -o tf-hub https://github.com/misaon/tf-hub/releases/latest/download/tf-hub-darwin-arm64
chmod +x tf-hub && mv tf-hub /usr/local/bin/
```

Builds are published for macOS (arm64, x64), Linux (x64, arm64) and Windows (x64), with a `SHA256SUMS`
file next to them. macOS quarantines binaries downloaded through a browser — either use `curl` as above,
or clear the flag with `xattr -d com.apple.quarantine tf-hub`.

## Usage

Sign in once; the session is stored locally and refreshes itself:

```sh
tf-hub login
```

Commands are grouped by domain — `tf-hub <domain> <action>`:

```sh
tf-hub me                       # your profile
tf-hub colleagues list          # company directory
tf-hub documents list --mine    # your documents
tf-hub game show 2026-5         # The Game leaderboard for a month
tf-hub absences create --type HOLIDAY --date-from 2026-07-01 --date-to 2026-07-04 \
  --hours 32 --general-description "Vacation"
tf-hub worklogs create --description "API work" --time-spent 90 \
  --started 2026-06-10 --cost-category-id 3
```

Run `tf-hub --help` for the full list of domains, `tf-hub <domain> --help` for its actions, and add `--json`
to any data command for machine-readable output.

## MCP

The same operations are available as MCP tools over stdio. Sign in first, then register the server with your
AI client — for Claude Code:

```sh
claude mcp add tf-hub -- tf-hub mcp-server
```

Tools carry read-only/destructive annotations, so well-behaved clients auto-approve reads and ask before
deletes. If your client caps the number of tools, narrow the surface:

```sh
tf-hub mcp-server --toolsets worklogs,absences,me   # only some domains
tf-hub mcp-server --read-only                       # no writes at all
```

## Security

- Session tokens live in `~/.config/tf-hub/credentials.json` with owner-only permissions — the same
  storage model npm, gcloud and docker use.
- The browser login page pins all third-party scripts with Subresource Integrity hashes.
- No telemetry. Outbound traffic is limited to the TF Hub API, Google's token endpoint (session
  refresh) and the npm registry (a daily update check you can disable with `NO_UPDATE_NOTIFIER=1`).

## Development

```sh
bun install
bun run dev -- whoami   # run locally with args
bun test                # tests
bun run typecheck       # types
bun run lint            # oxlint (quality gate)
bun run fmt             # oxfmt
bun run knip            # unused exports, files and dependencies
bun run build           # bundle to dist/index.mjs
bun run generate        # refresh the OpenAPI spec and regenerate Zod schemas
```

Architecture notes and conventions live in [`AGENTS.md`](./AGENTS.md).

## License

[MIT](./LICENSE) © Ondřej Misák
