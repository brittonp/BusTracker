import { appConstant } from "./globals.js";
class SearchHistoryManager {
    // Define default options as a static property
    static DEFAULT_OPTIONS = Object.freeze({
        localStorage: appConstant.userSearchesLocalStorage,
        maxSearchHistory: appConstant.maxSearchHistory
    });
    constructor() {
        // Initialize instance properties with default values
        Object.assign(this, SearchHistoryManager.DEFAULT_OPTIONS);
    }

    // Get array of search history...
    get() {
        try {
            if ('localStorage' in window) {
                const saved = localStorage.getItem(this.localStorage);
                if (saved) {
                    return JSON.parse(saved);
                }
            }
            return [];
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
            return [];
        }
    }

    // Set a specific option
    async add(search, operatorRoutes) {

        let history = this.get();

        search.searched = new Date().getTime();
        history.push(search);

        // remove duplicates and enrich...
        history = history
            .sort((a, b) => {
                var a1 = new Date(a.searched);
                var b1 = new Date(b.searched);
                if (a1 == b1) return 0;
                return a1 < b1 ? 1 : -1;
            })
            .filter((item, index, self) => {
                return index === self.findIndex(r => r.operatorRef === item.operatorRef && r.lineRef === item.lineRef);
            })
            .map((item, index, self) => {

                const operator = operatorRoutes.list.find((o) => o.operatorRef == item.operatorRef);

                if (item.lineRef) {
                    const route = operatorRoutes.list.find((r) => r.operatorRef == item.operatorRef && r.lineRef == item.lineRef);

                    return {
                        ...item,
                        currentMapBounds: false,
                        operatorName: operator.operatorName,
                        route: route.lineRef,
                        //searched: r.searched,
                        title: route.title
                    }
                } else {
                    return {
                        ...item,
                        currentMapBounds: false,
                        operatorName: operator.operatorName,
                        route: 'All Routes',
                        //searched: r.searched,
                        title: operator.title
                    }

                }
            })
            .sort((a, b) => {
                var a1 = new Date(a.searched);
                var b1 = new Date(b.searched);
                if (a1 == b1) return 0;
                return a1 < b1 ? 1 : -1;
            })
            .filter((item, index, self) => {
                return index < this.maxSearchHistory;
            });

        if ('localStorage' in window) {
            localStorage.setItem(this.localStorage, JSON.stringify(history));
        }

        return history;
    }

    async removeAll() {
        if ('localStorage' in window) {
            localStorage.removeItem(this.localStorage);
        }
    }
}

// Export singleton instance
export const searchHistory = new SearchHistoryManager();

