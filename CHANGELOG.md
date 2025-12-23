# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/pokutuna/mcp-chrome-tabs/compare/v0.7.1...HEAD
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
