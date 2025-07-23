export type TabRef = {
    windowId: string;
    tabId: string;
};
export type ChromeTab = TabRef & {
    title: string;
    url: string;
};
export type PageContent = {
    title: string;
    url: string;
    content: string;
};
export declare function getChromeTabList(applicationName: string): Promise<ChromeTab[]>;
export declare function getPageContent(applicationName: string, tab?: TabRef | null): Promise<PageContent>;
export declare function openURL(applicationName: string, url: string): Promise<void>;
