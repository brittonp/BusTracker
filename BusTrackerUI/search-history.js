import { appConstant } from "./globals.js";
import { appUtils } from "./utils.js";

export const searchHistory = {
    eventTargetClass: '#searchHistory', // '.anpr.plate.history.panel',
    cookieName: appConstant.userSearchesCookieName,
    cookieExpiry: appConstant.cookieExpiry,
    get: function get() {
        let history = [];

        var cookie = Cookies.get(this.cookieName);
        if (cookie) {
            history = JSON.parse(cookie);
        }

        return history;
    },
    add: async function add(search, operatorRoutes) {

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
                return index < appConstant.maxSearchHistory;
            });

        Cookies.set(this.cookieName, JSON.stringify(history), { expires: this.cookieExpiry });

        $(this.eventTargetClass).trigger('load');

        return history;
    },
    removeAll: async function removeAll() {
        Cookies.remove(this.cookieName);
        $(this.eventTargetClass).trigger('load');
    }
}