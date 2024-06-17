import { log, appConstant } from "./globals.js";

export let session = {

    init: async function initiateSession() {

        log(`initiateSession: start`);
        const response = await fetch('/services/Session/Create', { timeout: 30 * 1000 });
        if (!response.ok) {
            throw new Error(`Failed to create session. Error: ${response.status}`);
        }
        const data = await response.json();

        session = { ...this, ...data };

        log(`initiateSession: complete`);
        return true;
    }
}