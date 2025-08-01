import { chromeBrowser } from "../src/browser/chrome";

const tabs = await chromeBrowser.getTabList("Google Chrome");
console.log(tabs);

const { content, ...rest } = await chromeBrowser.getPageContent(
  "Google Chrome",
  null
);
console.log(rest);
console.log(content);
