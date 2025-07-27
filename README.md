# @pokutuna/mcp-chrome-tabs

> [!NOTE]
> **macOS only** - This MCP server uses AppleScript and only works on macOS.

Model Context Protocol (MCP) server that provides direct access to your browser's open tabs content. No additional fetching or authentication required - simply access what you're already viewing.

## Features

- **Access browser tabs** - Direct access to content from tabs currently open in your browser
- **Active tab shortcut** - Quick reference to currently active tab without specifying tab ID
- **URL opening** - Open AI-provided URLs directly in new browser tabs
- **Tools & Resources** - Dual interface supporting both MCP tools and resources with automatic refresh notifications when tab collection changes

## Installation

> [!IMPORTANT]
> **Requirements**: Enable "Allow JavaScript from Apple Events" in Chrome
> - (en) **View** > **Developer** > **Allow JavaScript from Apple Events**
> - (ja) **表示** > **開発 / 管理** > **Apple Events からのJavaScript を許可**

### Manual Configuration
Add to your MCP configuration file (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "chrome-tabs": {
      "command": "npx",
      "args": ["-y", "@pokutuna/mcp-chrome-tabs"]
    }
  }
}
```

### For Claude Code
```bash
claude mcp add -s user chrome-tabs -- npx -y @pokutuna/mcp-chrome-tabs
```

### Command Line Options
The server accepts optional command line arguments for configuration:

- `--application-name` - Application name to control (default: "Google Chrome")
- `--exclude-hosts` - Comma-separated list of domains to exclude from tab listing and content access
- `--check-interval` - Interval in milliseconds to check for tab changes and notify clients (default: 3000, set to 0 to disable)


## Tools

### `list_tabs`
List all open tabs in the user's browser with their titles, URLs, and tab references.
- Returns: Markdown formatted list of tabs with tab IDs for reference

### `read_tab_content`
Get readable content from a tab in the user's browser.
- `id` (optional): Tab reference from `list_tabs` output (e.g., `ID:12345:67890`)
- If `id` is omitted, uses the currently active tab
- Returns: Clean, readable content extracted using Mozilla Readability

### `open_in_new_tab`
Open a URL in a new tab to present content or enable user interaction with webpages.
- `url` (required): URL to open in the browser

## Resources

### `tab://current`
Resource representing the content of the currently active tab.
- **URI**: `tab://current`
- **MIME type**: `text/markdown`
- **Content**: Real-time content of the active browser tab

### `tab://{windowId}/{tabId}`
Resource template for accessing specific tabs.
- **URI pattern**: `tab://{windowId}/{tabId}`
- **MIME type**: `text/markdown`
- **Content**: Content of the specified tab
- Resources are dynamically generated based on currently open tabs
