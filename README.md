@pokutuna/mcp-chrome-tabs
===

Model Context Protocol (MCP) server for extracting readable content from Chrome tabs using AppleScript and Mozilla Readability.

## Features

- **List Chrome tabs** - Get all open tabs across windows
- **Extract page content** - Get clean, readable text from any tab using Readability
- **Open URLs** - Open new tabs in Chrome
- **Active tab support** - Work with currently active tab when no specific tab is specified

## Usage

> [!WARNING]
> This project is currently under development. The distribution method is subject to change.

## Requirements

- macOS with Chrome installed (using AppleScript)
- Enable "Allow JavaScript from Apple Events" in Chrome:
  - **View** > **Developer** > **Allow JavaScript from Apple Events**

## Tools

### `chrome_list_tabs`
Lists all open Chrome tabs in Markdown format.

### `chrome_read_tab_content` 
Extracts readable content from a tab.
- `tabId`: Optional tab ID in format `id:1:2` (window:tab)
- If omitted, uses currently active tab

### `chrome_open_url`
Opens a URL in a new Chrome tab.
- `url`: URL to open

## For Claude Code

```bash
$ claude mcp add -s user chrome-tabs -- npx -y github:pokutuna/mcp-chrome-tabs
```
