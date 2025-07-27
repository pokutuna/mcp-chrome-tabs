export type TabRef = {
    windowId: string;
    tabId: string;
};
export type Tab = TabRef & {
    title: string;
    url: string;
};
export type TabContent = {
    title: string;
    url: string;
    content: string;
};
export declare function getChromeTabList(applicationName: string): Promise<Tab[]>;
export declare function getPageContent(applicationName: string, tab?: TabRef | null): Promise<TabContent>;
export declare function openURL(applicationName: string, url: string): Promise<void>;
