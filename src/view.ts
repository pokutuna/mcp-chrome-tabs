import type { Tab, TabRef, TabContent } from "./browser/browser.js";

export function formatTabRef(tab: Tab): string {
  return `ID:${tab.windowId}:${tab.tabId}`;
}

export function parseTabRef(tabRef: string): TabRef | null {
  const match = tabRef.match(/^ID:([^:]+):([^:]+)$/);
  if (!match) return null;
  const windowId = match[1];
  const tabId = match[2];
  return { windowId, tabId };
}

function getDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.port ? `${u.hostname}:${u.port}` : u.hostname;
  } catch {
    return url;
  }
}

export function formatTabName(tab: { title: string; url: string }): string {
  return `${tab.title} (${getDomain(tab.url)})`;
}

export function formatList(tabs: Tab[], includeUrl: boolean = false): string {
  const list = tabs.map((tab) => formatListItem(tab, includeUrl)).join("\n");
  const header = `### Current Tabs (${tabs.length} tabs exists)\n`;
  return header + list;
}

export function formatListItem(tab: Tab, includeUrl: boolean = false): string {
  if (includeUrl) {
    return `- ${formatTabRef(tab)} [${tab.title}](${tab.url})`;
  } else {
    return `- ${formatTabRef(tab)} ${formatTabName(tab)}`;
  }
}

// CJK, emoji and other wide glyphs occupy two terminal cells but count as one
// or two UTF-16 units, so column padding has to measure display width.
function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f)) continue; // ZWJ, VS
    width +=
      /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}|\p{Extended_Pictographic}|[\u3000-\u303f\uff00-\uff60\uffe0-\uffe6]/u.test(
        char
      )
        ? 2
        : 1;
  }
  return width;
}

// Cut text to fit in width terminal cells, marking the cut with an ellipsis
function truncateToWidth(text: string, width: number): string {
  if (displayWidth(text) <= width) return text;
  let out = "";
  let used = 0;
  for (const char of text) {
    const w = displayWidth(char);
    if (used + w > width - 1) break;
    out += char;
    used += w;
  }
  return out + "…";
}

function padCell(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - displayWidth(text)));
}

// Page-controlled text such as a title can carry escape sequences that a
// terminal would run as commands (e.g. OSC 52 writes the clipboard). Show
// C0/C1 controls as \xNN instead; tab and newline stay for readable content.
const terminalControls = /[\x00-\x08\x0b-\x1f\x7f-\x9f]/g;

export function escapeForTerminal(text: string): string {
  return text.replace(
    terminalControls,
    (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`
  );
}

// A table cell must stay on one line, so whitespace controls become spaces
function tableCell(text: string): string {
  return escapeForTerminal(text.replace(/[\t\n\r]+/g, " "));
}

// Long titles would wrap and break the columns, so they are cut to this width
const maxTitleWidth = 60;

// Index is ephemeral: it numbers the rows of this one listing and shifts as
// windows are reordered or tabs open and close. ID is the durable reference,
// so both are always shown and `read` takes either.
export function formatListForCli(
  tabs: Tab[],
  includeUrl: boolean = false
): string {
  if (tabs.length === 0) return "No open tabs.";

  const rows = tabs.map((tab, i) => ({
    index: `[${i + 1}]`,
    id: formatTabRef(tab),
    title: truncateToWidth(tableCell(tab.title), maxTitleWidth),
    locus: tableCell(includeUrl ? tab.url : getDomain(tab.url)),
  }));

  const widest = (key: "index" | "id" | "title") =>
    Math.max(...rows.map((r) => displayWidth(r[key])));
  const [wIndex, wId, wTitle] = [
    widest("index"),
    widest("id"),
    widest("title"),
  ];

  return rows
    .map(
      (r) =>
        `${" ".repeat(wIndex - displayWidth(r.index))}${r.index}  ` +
        `${padCell(r.id, wId)}  ${padCell(r.title, wTitle)}  ${r.locus}`
    )
    .join("\n");
}

type FrontMatter = { key: string; value: string | number | boolean };

// How a paginated read names its start position, in the reader's own terms
export type Pagination = {
  key: string;
  nextRead: (start: number) => string;
};

export const toolPagination: Pagination = {
  key: "startIndex",
  nextRead: (start) => `Read with startIndex of ${start}`,
};

export const cliPagination: Pagination = {
  key: "offset",
  nextRead: (start) => `Read with --offset=${start}`,
};

export function formatTabContent(
  tab: TabContent,
  startIndex: number = 0,
  maxContentChars?: number,
  pagination: Pagination = toolPagination
): string {
  const frontMatters: FrontMatter[] = [
    { key: "url", value: tab.url },
    { key: "title", value: tab.title },
  ];
  let content = tab.content;

  if (startIndex > 0) {
    content = content.slice(startIndex);
    frontMatters.push({ key: pagination.key, value: startIndex });
  }
  const truncation =
    maxContentChars !== undefined && content.length > maxContentChars;
  if (truncation) {
    content = content.slice(0, maxContentChars);
    const nextStart = startIndex + maxContentChars;
    content += `\n\n<ERROR>Content truncated. ${pagination.nextRead(nextStart)} to get more content.</ERROR>`;
    frontMatters.push({ key: "truncated", value: truncation });
  }

  const frontMatterText = frontMatters
    .map(({ key, value }) => `${key}: ${value}`)
    .join("\n");

  return ["---", frontMatterText, "---", content].join("\n");
}

export const uriTemplate = "tab://{windowId}/{tabId}";

export function formatUri(ref: TabRef): string {
  return `tab://${ref.windowId}/${ref.tabId}`;
}
