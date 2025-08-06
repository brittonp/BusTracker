//import { appConstant } from "./globals.js";
//import { appUtils } from "./utils.js";

//export let session = {

//    init: async function initiateSession() {

//        appUtils.log(`initiateSession: start`);
//        let counter = 0;

//        while (counter < appConstant.maxServiceRetry) {
//            try {

//                const data = await fetchWithTimeout("/services/Session/Create", appConstant.timeoutService)

//                session = { ...this, ...data };

//                appUtils.log(`initiateSession: complete`);
//                return true;
//            }
//            catch (err) {

//                document.dispatchEvent(new CustomEvent('session', {
//                    detail: { counter: counter },
//                }));
//                await appUtils.sleep(appConstant.delayServiceRetry);
//            }
//            finally {
//                counter++;
//            }
//        }
//        throw new Error(`Failed to create session.`);

//        async function fetchWithTimeout(url, timeout = 1000) {
//            const controller = new AbortController();
//            const signal = controller.signal;

//            // Set timeout to abort the request
//            const timeoutId = setTimeout(() => controller.abort(), timeout);

//            try {
//                const response = await fetch(url, {
//                    method: "GET",
//                    signal // Attach the abort signal to fetch
//                });

//                clearTimeout(timeoutId); // Clear timeout if request completes in time
//                return await response.json(); // Adjust as needed (text(), blob(), etc.)
//            } catch (error) {
//                if (error.name === "AbortError") {
//                    console.error("Request timed out");
//                    throw new Error("Request timed out");
//                }
//                throw error; // Handle other errors (e.g., network errors)
//            }
//        }
//    }
//}

import { appConstant } from "./globals.js";
import { appUtils } from "./utils.js";

export class SessionManager {
    constructor() {
        this.session = {};
    }

    /**
     * Initializes a session by making requests to the server.
     * Implements retry logic if session creation fails.
     * @returns {Promise<boolean>} Returns true if session is successfully created
     * @throws {Error} If session creation fails after maximum retries
     */
    async init() {
        appUtils.log(`initiateSession: start`);
        let counter = 0;

        while (counter < appConstant.maxServiceRetry) {
            try {
                const data = await this.#fetchWithTimeout("/services/Session/Create", appConstant.timeoutService);

                this.session = { ...this.session, ...data };

                appUtils.log(`initiateSession: complete`);
                return true;
            } catch (error) {
                if (error.name === "AbortError") {
                    document.dispatchEvent(new CustomEvent('session', {
                        detail: { counter: counter },
                    }));
                    await appUtils.sleep(appConstant.delayServiceRetry);
                } else {
                    throw error;
                }
            } finally {
                counter++;
            }
        }
        throw new Error(`Failed to create session after ${appConstant.maxServiceRetry} attempts.`);
    }

    /**
     * Fetches data from the specified URL with a timeout.
     * @param {string} url - The URL to fetch from
     * @param {number} timeout - Maximum time in milliseconds before aborting the request
     * @returns {Promise<Object>} The parsed JSON response
     * @throws {Error} If request times out, returns non-OK status, or response is not JSON
     */
    async #fetchWithTimeout(url, timeout = 1000) {
        const controller = new AbortController();
        const signal = controller.signal;

        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
            method: "GET",
            signal,
        });

        clearTimeout(timeoutId);

        // Check the response is ok (distinct from a timeout issue)
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}-${response.statusText}`);
        }
        // Check if the response is JSON
        const contentType = response.headers.get("content-type");
        if (contentType && !contentType.includes("application/json")) {
            throw new Error("Response is not JSON");
        }

        return await response.json();
    }
}