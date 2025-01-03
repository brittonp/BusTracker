import { appConstant } from "./globals.js";
import { appUtils } from "./utils.js";

export let userOptions = {
    cookieName: appConstant.userOptionsCookieName,
    cookieExpiry: appConstant.cookieExpiry,
    hideAged: true,
    favouriteBus: '',
    maxMarkers: 200,
    refreshPeriod: 15,  // seconds...
    hideSystemMessage: false,
    init: async function init() {

        // Get user options...
        try {
            let options = JSON.parse(Cookies.get(this.cookieName));
            userOptions = { ...this, ...options };
        }
        catch (e) {
            // just take default properties...
        }

        Cookies.set(this.cookieName, JSON.stringify(userOptions), { expires: this.cookieExpiry });

        //throw new Error('test error');
    },
    set: function set(prop, val) {
        this[prop] = val;
        Cookies.set(this.cookieName, JSON.stringify(userOptions), { expires: this.cookieExpiry });
    }

}