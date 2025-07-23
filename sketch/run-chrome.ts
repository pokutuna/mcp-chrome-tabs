import { getChromeTabList, getPageContent, openURL } from "../src/chrome";

const tabs = await getChromeTabList();
console.log(tabs);
console.log(await getPageContent());

const { windowId, tabId } = tabs[9];
console.log(await getPageContent({ windowId, tabId }));
// console.log(await openURL("https://pokutuna.com"));
