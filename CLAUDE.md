# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building and Testing

- `npm run build` - Compile TypeScript to JavaScript in `dist/` directory
- `npm run test` - Run unit tests with Vitest
- `npm test` - Alias for `npm run test`
- `npm run test:watch` - Run tests in watch mode
- `npm run test:e2e` - Run end-to-end tests with Playwright

### Development

- `npm run dev` - Run the CLI directly from source using tsx
- `npm run start` - Run the compiled version from dist/
- `npm run inspector` - Open MCP inspector for debugging

### Code Quality

- `npm run lint` - Check code formatting with Prettier
- `npm run lint:fix` - Fix code formatting issues

## Architecture

This is an MCP (Model Context Protocol) server that provides access to browser tabs on macOS using JXA (JavaScript for Automation) over Apple Events.

### Core Components

- **src/mcp.ts** - Main MCP server implementation with tools and resources
- **src/browser/** - Browser-specific implementations
  - **browser.ts** - Common browser interface and types
  - **chrome.ts** - Chrome implementation
  - **safari.ts** - Safari implementation (experimental)
  - **arc.ts** - Arc implementation (experimental)
  - **osascript.ts** - JXA execution utilities (timeout, retry, error hints)
- **src/view.ts** - Content formatting and display utilities
- **src/util.ts** - General utility functions
- **src/cli.ts** - Command-line interface entry point
- **src/cli-options.ts** - Command-line argument parsing

### Key Features

The server provides three MCP tools:

1. `list_tabs` - List all browser tabs with IDs and metadata
2. `read_tab_content` - Extract readable content from tabs using Defuddle
3. `open_in_new_tab` - Open new URLs in browser

Resources:

- `tab://current` - Active tab content
- `tab://{windowId}/{tabId}` - Specific tab content

CLI commands (read-only, no MCP client needed):

- `list` - List open tabs as `[INDEX] ID TITLE DOMAIN`
- `read <ID | INDEX | --active>` - Read a tab's content

### macOS Requirements

This project is macOS-only and requires:

- "Allow JavaScript from Apple Events" enabled in Chrome
- Automation permission for the browser (System Settings > Privacy & Security > Automation)
- Node.js 22 or newer

### Testing Structure

- **tests/*.test.ts** - Unit tests for individual modules (JXA is replaced with a mocked `Application`)
- **tests/integration/** - E2E tests using Playwright (Chrome only; Safari and Arc are checked by hand)
- Custom Chrome profile in `tests/integration/chrome-profile/` for isolated testing

### Configuration Options

Options apply only to the commands listed; passing one elsewhere is an error.

**List Options**
- `--include-url` - Show the full URL instead of the domain

**Read Options**
- `--active` - Read the active tab (`read` needs an ID, an INDEX, or `--active`)
- `--offset` - Start reading at this character offset (default: 0)

**Content Options** (`read` and the MCP server)
- `--max-content-chars` - Maximum content characters per single read (default: 20000)
- `--extraction-timeout` - Timeout for content extraction worker in milliseconds (default: 20000)

**MCP Server Options**
- `--check-interval` - Tab change notification interval in ms (default: 0 disabled, set to 3000 for 3 seconds)

**Common Options** (all commands)
- `--exclude-hosts` - Comma-separated domains to exclude from access. Hosts in `MCP_CHROME_TABS_EXCLUDE_HOSTS` are excluded as well
- `--application-name` - Target browser application (default: "Google Chrome")
- `--experimental-browser` - Browser implementation to use: "chrome", "safari", or "arc" (default: "chrome")
- `--help` - Show help message with all available options
- `--version` - Show the package version
