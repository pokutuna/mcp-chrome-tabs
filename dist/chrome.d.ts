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
export declare function getChromeTabList(): Promise<ChromeTab[]>;
export declare function getPageContent(tab?: TabRef | null): Promise<PageContent>;
export declare function openURL(url: string): Promise<void>;
