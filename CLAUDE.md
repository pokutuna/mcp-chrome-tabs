# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that provides browser tab access through AppleScript on macOS. The server enables AI assistants to read content from Chrome/Safari tabs, list open tabs, and open new URLs in the browser.

## Development Commands

### Building and Running
```bash
npm run build          # Compile TypeScript to dist/
npm run dev            # Run development server with tsx
npm start              # Run compiled version from dist/
```

### Testing
```bash
npm run test           # Run tests with vitest in watch mode
npm run test:run       # Run tests once and exit
```

### MCP Testing
```bash
npm run inspector      # Launch MCP inspector for testing tools/resources
```

## Architecture

### Core Components

- **src/mcp.ts**: Main MCP server implementation with tools and resources registration
- **src/chrome.ts**: AppleScript integration for browser automation (tab listing, content extraction, URL opening)
- **src/view.ts**: Data formatting and presentation layer (markdown conversion, URI templates)
- **src/cli.ts**: Command-line interface and server startup
- **src/types.d.ts**: TypeScript declarations for external modules

### Key Design Patterns

1. **AppleScript Integration**: Uses `osascript` via Node.js `execFile` to communicate with Chrome/Safari
2. **Content Processing Pipeline**: HTML → Readability (Mozilla) → Turndown (HTML to Markdown)
3. **Resource Templates**: Dynamic MCP resources for individual tabs using `tab://{windowId}/{tabId}` URI scheme
4. **Error Handling**: Retry mechanisms with exponential backoff for AppleScript execution
5. **Host Filtering**: Configurable domain exclusion for privacy/security

### Dependencies

- **@modelcontextprotocol/sdk**: MCP server framework
- **@mozilla/readability**: Content extraction from HTML
- **jsdom**: DOM parsing for Readability
- **turndown**: HTML to Markdown conversion
- **zod**: Schema validation for tool inputs

## Configuration Options

Command-line arguments:
- `--application-name`: Target browser (default: "Google Chrome")
- `--exclude-hosts`: Comma-separated domains to exclude
- `--check-interval`: Tab change notification interval in ms (default: 3000)

## Security Considerations

- Uses AppleScript which requires "Allow JavaScript from Apple Events" permission in Chrome
- Implements host exclusion to prevent access to sensitive domains
- Content is processed through Mozilla Readability for safety
- No direct file system access or shell command execution

## Testing Strategy

Tests are located in `tests/` and use Vitest. Focus on:
- MCP tool registration and schema validation
- Data formatting and URI parsing
- Error handling for AppleScript failures

## Coding Standards

- **Language**: Write all comments and commit messages in English
- **Comments**: Follow the established pattern of inline documentation for complex AppleScript logic

## Browser Requirements

**macOS only** - Requires AppleScript support. Must enable "Allow JavaScript from Apple Events" in Chrome:
- English: View > Developer > Allow JavaScript from Apple Events
- Japanese: 表示 > 開発/管理 > Apple Events からのJavaScript を許可