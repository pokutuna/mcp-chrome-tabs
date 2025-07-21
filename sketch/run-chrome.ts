import { getChromeTabList, getPageContent, openURL } from "../src/chrome";

console.log(await getChromeTabList());
console.log(await getPageContent());
console.log(await getPageContent({ windowIndex: 1, tabIndex: 1 }));
console.log(await openURL("https://pokutuna.com"));
