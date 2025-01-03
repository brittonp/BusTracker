import { appConstant } from "./globals.js";
import { appUtils } from "./utils.js";

export let session = {

    init: async function initiateSession() {

        appUtils.log(`initiateSession: start`);
        //const MAX_NB_RETRY = 5;
        //const RETRY_DELAY_MS = 5000;
        let counter = 0;

        //const response = await fetch('/services/Session/Create', { timeout: 30 * 1000 });
        //if (!response.ok) {
        //    throw new Error(`Failed to create session. Error: ${response.status}`);
        //}

        while (counter < appConstant.maxServiceRetry) {
            try {

                const response = await fetch('/services/Session/Create',
                    {
                        timeout: appConstant.timeoutService,
                        method: "GET"
                    }
                );

                const data = await response.json();

                session = { ...this, ...data };

                appUtils.log(`initiateSession: complete`);
                return true;
            }
            catch (err) {

                //$(document).trigger('session', counter);
                document.dispatchEvent(new CustomEvent('session', {
                    detail: { counter: counter },
                }));
                await appUtils.sleep(appConstant.delayServiceRetry);
            }
            finally {
                counter++;
            }
        }
        throw new Error(`Failed to create session.`);

    }
}