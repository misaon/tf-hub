# Changelog

All notable changes are documented here. This file is maintained by
[changelogen](https://github.com/unjs/changelogen) from
[Conventional Commits](https://www.conventionalcommits.org).

## v0.2.1

[compare changes](https://github.com/misaon/tf-hub/compare/v0.2.0...v0.2.1)

### 🚀 Enhancements

- **mcp:** Migrate to the MCP TypeScript SDK v2 ([760b485](https://github.com/misaon/tf-hub/commit/760b485))
- **absences:** Request an exception from the weekly home office limit ([096c8ad](https://github.com/misaon/tf-hub/commit/096c8ad))

### ❤️ Contributors

- Ondřej Misák ([@misaon](https://github.com/misaon))

## v0.2.0

[compare changes](https://github.com/misaon/tf-hub/compare/v0.1.3...v0.2.0)

### 🚀 Enhancements

- **projects:** ⚠️  Sync with the latest Hub API ([4c6b9a7](https://github.com/misaon/tf-hub/commit/4c6b9a7))
- ⚠️  Lean, agent-ready output for MCP tools and the CLI ([e9edc9d](https://github.com/misaon/tf-hub/commit/e9edc9d))

#### ⚠️ Breaking Changes

- **projects:** ⚠️  Sync with the latest Hub API ([4c6b9a7](https://github.com/misaon/tf-hub/commit/4c6b9a7))
- ⚠️  Lean, agent-ready output for MCP tools and the CLI ([e9edc9d](https://github.com/misaon/tf-hub/commit/e9edc9d))

### ❤️ Contributors

- Ondřej Misák <email@ondrejmisak.cz>

## v0.1.3

[compare changes](https://github.com/misaon/tf-hub/compare/v0.1.2...v0.1.3)

### 🚀 Enhancements

- Plain-text rendering and bulk colleague bios ([dcc660e](https://github.com/misaon/tf-hub/commit/dcc660e))

### 🩹 Fixes

- **game:** Send the unpadded month format the Hub expects ([443cfc7](https://github.com/misaon/tf-hub/commit/443cfc7))

### 📖 Documentation

- Add the data-not-answers principle ([b132577](https://github.com/misaon/tf-hub/commit/b132577))

### ❤️ Contributors

- Ondřej Misák ([@misaon](https://github.com/misaon))

## v0.1.2

[compare changes](https://github.com/misaon/tf-hub/compare/v0.1.1...v0.1.2)

### 🚀 Enhancements

- Agent-friendly absence and identity outputs ([1f0e972](https://github.com/misaon/tf-hub/commit/1f0e972))
- Extend --mine to goals and document worklog minutes ([340b640](https://github.com/misaon/tf-hub/commit/340b640))
- **auth:** Serve the browser login with h3 ([943c1d3](https://github.com/misaon/tf-hub/commit/943c1d3))
- **cli:** Headline summaries in help tables ([629de94](https://github.com/misaon/tf-hub/commit/629de94))

### 🔥 Performance

- Minify the bundle and speed up update checks ([55df5ee](https://github.com/misaon/tf-hub/commit/55df5ee))

### 🩹 Fixes

- Harden error paths and adopt dependabot ([379efaf](https://github.com/misaon/tf-hub/commit/379efaf))

### 💅 Refactors

- Unify domain idioms and deduplicate shared logic ([e22e22d](https://github.com/misaon/tf-hub/commit/e22e22d))

### 📖 Documentation

- Read the license badge from npm ([9723c3a](https://github.com/misaon/tf-hub/commit/9723c3a))

### 🏡 Chore

- Switch dependency updates back to renovate ([6141f34](https://github.com/misaon/tf-hub/commit/6141f34))

### ✅ Tests

- Smoke every operation through its CLI command ([b900601](https://github.com/misaon/tf-hub/commit/b900601))

### 🎨 Styles

- Format the oxfmt configuration ([cc8615b](https://github.com/misaon/tf-hub/commit/cc8615b))

### 🤖 CI

- Exclude the generated changelog from format checks ([dcbfc95](https://github.com/misaon/tf-hub/commit/dcbfc95))
- Create the github release with gh instead of changelogen ([a1c2c8b](https://github.com/misaon/tf-hub/commit/a1c2c8b))
- Reproducible bun, full release gate and explicit coverage thresholds ([f9315c8](https://github.com/misaon/tf-hub/commit/f9315c8))

### ❤️ Contributors

- Ondřej Misák ([@misaon](https://github.com/misaon))

## v0.1.1


### 🚀 Enhancements

- Google sign-in with sessions stored in the os keychain ([a901c84](https://github.com/misaon/tf-hub/commit/a901c84))
- Authenticated api client with zod schemas generated from openapi ([e6bf41a](https://github.com/misaon/tf-hub/commit/e6bf41a))
- Operation model bridging zod schemas to citty commands and mcp tools ([8fc2ace](https://github.com/misaon/tf-hub/commit/8fc2ace))
- Hub domains as grouped cli commands and mcp tools ([958dfc3](https://github.com/misaon/tf-hub/commit/958dfc3))
- Node-ready npm bundle and standalone release binaries ([f368982](https://github.com/misaon/tf-hub/commit/f368982))
- Store credentials in an owner-only file ([30eb370](https://github.com/misaon/tf-hub/commit/30eb370))

### 📖 Documentation

- Readme, agent guide and security policy ([deecd9d](https://github.com/misaon/tf-hub/commit/deecd9d))
- Distribution and credential storage notes ([0758137](https://github.com/misaon/tf-hub/commit/0758137))

### 🏡 Chore

- Scaffold project tooling and configuration ([e364473](https://github.com/misaon/tf-hub/commit/e364473))

### ✅ Tests

- Behavior-focused suite with an in-memory keychain preload ([1d33adf](https://github.com/misaon/tf-hub/commit/1d33adf))

### 🤖 CI

- Quality gates, workflow audit and release pipeline ([fd416e9](https://github.com/misaon/tf-hub/commit/fd416e9))
- Publish without provenance while the repository is private ([1745663](https://github.com/misaon/tf-hub/commit/1745663))

### ❤️ Contributors

- Ondřej Misák ([@misaon](https://github.com/misaon))

