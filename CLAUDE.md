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

This is an MCP (Model Context Protocol) server that provides access to browser tabs on macOS using AppleScript automation.

### Core Components

- **src/mcp.ts** - Main MCP server implementation with tools and resources
- **src/browser/** - Browser-specific implementations
  - **browser.ts** - Common browser interface and types
  - **chrome.ts** - Chrome-specific AppleScript automation
  - **safari.ts** - Safari-specific implementation (experimental)
  - **osascript.ts** - AppleScript execution utilities
- **src/view.ts** - Content formatting and display utilities
- **src/util.ts** - General utility functions
- **src/cli.ts** - Command-line interface entry point

### Key Features

The server provides three MCP tools:

1. `list_tabs` - List all browser tabs with IDs and metadata
2. `read_tab_content` - Extract readable content from tabs using Mozilla Readability
3. `open_in_new_tab` - Open new URLs in browser

Resources:

- `tab://current` - Active tab content
- `tab://{windowId}/{tabId}` - Specific tab content

### macOS Requirements

This project is macOS-only and requires:

- "Allow JavaScript from Apple Events" enabled in Chrome
- AppleScript permissions for browser automation
- Node.js 20 or newer

### Testing Structure

- **tests/unit/** - Unit tests for individual modules
- **tests/integration/** - E2E tests using Playwright
- Custom Chrome profile in `tests/integration/chrome-profile/` for isolated testing

### Configuration Options

Command-line options:

- `--application-name` - Target browser application (default: "Google Chrome")
- `--exclude-hosts` - Comma-separated domains to exclude from access
- `--check-interval` - Tab change notification interval in ms (default: 3000)
- `--experimental-browser` - Browser implementation to use: "chrome", "safari", or "arc" (default: "chrome")
- `--max-content-chars` - Maximum content characters per single read (default: 20000)
- `--extraction-timeout` - Timeout for content extraction worker in milliseconds (default: 10000)
- `--help` - Show help message with all available options
