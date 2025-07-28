# @pokutuna/mcp-chrome-tabs

[![npm version](https://badge.fury.io/js/@pokutuna%2Fmcp-chrome-tabs.svg)](https://badge.fury.io/js/@pokutuna%2Fmcp-chrome-tabs)

Model Context Protocol (MCP) server that provides direct access to your browser's open tabs content. No additional fetching or authentication required - simply access what you're already viewing.

## Key Features

- **Direct browser tab access** - No web scraping needed, reads content from already open tabs
- **Content optimized for AI** - Automatic readability processing and markdown conversion to reduce token usage
- **Active tab shortcut** - Instant access to currently focused tab without specifying IDs
- **MCP listChanged notifications** - Follows MCP protocol to notify tab changes (support is limited in most clients)

## Requirements

> [!IMPORTANT]  
> **macOS only** - This MCP server uses AppleScript and only works on macOS.

- **Node.js** 20 or newer
- **MCP Client** such as Claude Desktop, Claude Code, or any MCP-compatible client
- **macOS** only (uses AppleScript for browser automation)

## Getting Started

First, enable "Allow JavaScript from Apple Events" in Chrome:
- (en) **View** > **Developer** > **Allow JavaScript from Apple Events**
- (ja) **表示** > **開発 / 管理** > **Apple Events からのJavaScript を許可**

Standard config works in most MCP clients (e.g., `.claude.json`, `.mcp.json`):

```json
{
  "mcpServers": {
    "chrome-tabs": {
      "command": "npx",
      "args": ["-y", "@pokutuna/mcp-chrome-tabs@latest"],
    }
  }
}
```

Or for Claude Code:
```bash
claude mcp add -s user chrome-tabs -- npx -y @pokutuna/mcp-chrome-tabs@latest
```

### Command Line Options

The server accepts optional command line arguments for configuration:

- `--application-name` - Application name to control (default: "Google Chrome")
- `--exclude-hosts` - Comma-separated list of domains to exclude from tab listing and content access
- `--check-interval` - Interval in milliseconds to check for tab changes and notify clients (default: 3000, set to 0 to disable)

#### Experimental Safari Support

Limited Safari support is available. Note that Safari lacks unique tab IDs, making it sensitive to tab order changes during execution:

```bash
npx @pokutuna/mcp-chrome-tabs --application-name=Safari --experimental-browser=safari
```

## MCP Features

### Tools

<details>
<summary><code>list_tabs</code></summary>

List all open tabs in the user's browser with their titles, URLs, and tab references.

- Returns: Markdown formatted list of tabs with tab IDs for reference

</details>

<details>
<summary><code>read_tab_content</code></summary>

Get readable content from a tab in the user's browser.

- `id` (optional): Tab reference from `list_tabs` output (e.g., `ID:12345:67890`)
- If `id` is omitted, uses the currently active tab
- Returns: Clean, readable content extracted using Mozilla Readability

</details>

<details>
<summary><code>open_in_new_tab</code></summary>

Open a URL in a new tab to present content or enable user interaction with webpages.

- `url` (required): URL to open in the browser

</details>

### Resources

<details>
<summary><code>tab://current</code></summary>

Resource representing the content of the currently active tab.

- **URI**: `tab://current`
- **MIME type**: `text/markdown`
- **Content**: Real-time content of the active browser tab

</details>

<details>
<summary><code>tab://{windowId}/{tabId}</code></summary>

Resource template for accessing specific tabs.

- **URI pattern**: `tab://{windowId}/{tabId}`
- **MIME type**: `text/markdown`
- **Content**: Content of the specified tab
- Resources are dynamically generated based on currently open tabs

</details>
