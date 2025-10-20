// Config.mjs 
export class Config {
    constructor() {
        null;
    }

    //Configure fetch to get config from api/config
    async loadConfig() {
        try {
            let response;
            // Detect if running locally without API function
            if (window.location.hostname === "localhost") {
                response = await fetch("/config.json");
            } else {
                response = await fetch("/api/config");
            }

            if (!response.ok) {
                throw new Error(`Failed to load config: ${response.status}`);
            }

            const config = await response.json();
            return config
        } catch (err) {
            throw new Error(`Failed to load config: ${err}`);  
        }
    } 
}