# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `list` and `read` commands for reading tabs from the command line without an MCP client. See "Who Can Read Your Tabs" in the README for how they relate to MCP tool approval and `--exclude-hosts`
- Hints for common osascript failures, such as missing Automation permission, an application that cannot be found, a closed tab, or a timeout. The original error message and code are kept
- A note on stderr when the MCP server is started by hand from a terminal
- `MCP_CHROME_TABS_EXCLUDE_HOSTS` environment variable, excluded in addition to `--exclude-hosts`, so that the MCP server and command line runs can share the same exclusions

### Changed

- **Breaking**: Require Node.js 22 or newer (Node.js 20 reached end-of-life)
- Errors from osascript no longer include the whole script that was run
- Safari and Arc are driven by JXA instead of AppleScript, like Chrome
- Safari: a tab opened by `open_in_new_tab` becomes the current tab, as in Chrome
- `list_tabs` orders windows by ID (creation order) instead of front to back, so the order no longer changes when the user switches windows
- Reading tabs reports a browser that is not running instead of launching it; `open_in_new_tab` still launches it
- Numeric options that are not integers are rejected instead of falling back to the default

### Fixed

- Control the user's Chrome rather than another Chrome process started later, such as a headless Chrome launched by Playwright MCP (Chrome is now driven by JXA instead of AppleScript)
- Refuse excluded hosts before running JavaScript in the page

## [0.8.3] - 2026-07-16

### Added

- `--version` CLI option to show the package version (#124)

### Changed

- Update defuddle from 0.15.0 to 0.19.1 (extraction results may differ slightly for some pages)
- Update zod from 4.3.6 to 4.4.3

## [0.8.2] - 2026-04-10

### Fixed

- Use Node.js 24 in publish workflow for npm trusted publishing support
- Add `--provenance` flag to npm publish
- Remove `npm install -g npm@latest` from publish workflow

## [0.8.0] - 2026-04-10

### Changed

- Update defuddle from 0.12.0 to 0.15.0 (#122)
  - jsdom is no longer used; content extraction may be faster on some sites
  - Extraction results may differ slightly for some pages
- Update @modelcontextprotocol/sdk from 1.27.1 to 1.29.0 (#121)
- Update dev dependencies (@playwright/test 1.59.1, vitest 4.1.2) (#123)

### Removed

- Remove jsdom dependency (no longer needed with defuddle 0.15.0)

## [0.7.2] - 2026-03-18

### Changed

- Update dependencies (defuddle 0.12.0, @modelcontextprotocol/sdk 1.27.1, zod 4.3.6)

## [0.7.1] - 2025-12-24

### Added

- Claude Code plugin support (#94)

### Changed

- Update dependencies

### Documentation

- Add AppleScript permission explanation and troubleshooting section (#83)

## [0.7.0] - 2025-10-17

### Added

- Worker thread for Defuddle content extraction to prevent blocking (#56)
- `--extraction-timeout` CLI option to configure content extraction timeout

### Changed

- Resource subscription is now disabled by default (`--check-interval=0`) (#62)

### Fixed

- Handle empty string content correctly in worker thread

## [0.6.0] - 2025-09-08

### Added

- Return tab ID from `open_in_new_tab` tool (#34)
- Demo animation in README

### Changed

- Migrate to NPM Trusted Publishing with OIDC (#37)

## [0.5.0] - 2025-08-12

### Added

- Arc browser support via `--experimental-browser=arc` (#20)

## [0.4.0] - 2025-08-04

### Added

- Content pagination with `--max-content-chars` option (#17)
- `includeUrl` option to `list_tabs` tool (#11)
- URL in front matter of `formatTabContent` (#12)

## [0.3.0] - 2025-08-01

### Added

- E2E tests with Playwright (#6)
- MIT License

### Changed

- Replace @mozilla/readability with defuddle for content extraction (#7)

## [0.2.0] - 2025-07-29

### Added

- Safari browser support (experimental) via `--experimental-browser=safari` (#4)
- Prettier configuration for code formatting (#5)
- CLAUDE.md documentation

### Fixed

- Replace deprecated actions/create-release with gh release create

## [0.1.4] - 2025-07-28

### Fixed

- npm publish provenance configuration

## [0.1.3] - 2025-07-28

### Fixed

- Add `--access public` to npm publish

## [0.1.2] - 2025-07-28

### Added

- Initial release
- `list_tabs` tool to list browser tabs
- `read_tab_content` tool to extract readable content from tabs
- `open_in_new_tab` tool to open URLs in browser
- Chrome browser support via AppleScript automation

[Unreleased]: https://github.com/pokutuna/mcp-chrome-tabs/compare/v0.8.3...HEAD
[0.8.3]: https://github.com/pokutuna/mcp-chrome-tabs/compare/v0.8.2...v0.8.3
[0.8.2]: https://github.com/pokutuna/mcp-chrome-tabs/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/pokutuna/mcp-chrome-tabs/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/pokutuna/mcp-chrome-tabs/compare/v0.7.2...v0.8.0
[0.7.2]: https://github.com/pokutuna/mcp-chrome-tabs/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/pokutuna/mcp-chrome-tabs/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/pokutuna/mcp-chrome-tabs/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/pokutuna/mcp-chrome-tabs/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/pokutuna/mcp-chrome-tabs/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/pokutuna/mcp-chrome-tabs/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/pokutuna/mcp-chrome-tabs/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/pokutuna/mcp-chrome-tabs/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/pokutuna/mcp-chrome-tabs/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/pokutuna/mcp-chrome-tabs/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/pokutuna/mcp-chrome-tabs/releases/tag/v0.1.2
