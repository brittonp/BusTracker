import { log, appConstant } from "./globals.js";

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
    add: async function add(search, operators) {

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
            .filter((r, index, self) => {
                return index === self.findIndex(r1 => r1.operatorRef === r.operatorRef && r1.lineRef === r.lineRef);
            })
            .map((r, index, self) => {

                const operator = operators.find((operator) => operator.operatorRef == r.operatorRef);
                const operatorName = (operator) ? operator.operatorName : '';

                const routeObj = operator.routes.find((route) => route.lineRef == r.lineRef);
                const route = (r.lineRef && routeObj) ? routeObj.route : 'All Routes';
                const display = `${operatorName} - ${route}`;

                return {
                    ...r,
                    operatorName: operatorName,
                    route: route,
                    //searched: r.searched,
                    display: display
                }
            })
            .sort((a, b) => {
                var a1 = new Date(a.searched);
                var b1 = new Date(b.searched);
                if (a1 == b1) return 0;
                return a1 < b1 ? 1 : -1;
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