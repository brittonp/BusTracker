import { appConstant } from "@components/globals.mjs";

// Define interfaces for better type safety
interface UserOptions {
    cookieName: string;
    cookieExpiry: number;
    hideAged: boolean;
    favouriteBus: string;
    maxMarkers: number;
    refreshPeriod: number;
    hideSystemMessage: boolean;
}

interface UserOptionsManager extends UserOptions {
    init: () => Promise<void>;
    set: <K extends keyof UserOptions>(prop: K, value: UserOptions[K]) => void;
    get: <K extends keyof UserOptions>(prop: K) => UserOptions[K];
    reset: () => void;
}

// Create a class for better encapsulation and maintainability
class UserOptionsManagerImpl implements UserOptionsManager {
    private static readonly DEFAULT_OPTIONS: UserOptions = {
        cookieName: appConstant.userOptionsCookieName,
        cookieExpiry: appConstant.cookieExpiry,
        hideAged: true,
        favouriteBus: '',
        maxMarkers: 200,
        refreshPeriod: 15, // seconds
        hideSystemMessage: false,
    };

    // Define properties
    public cookieName: string;
    public cookieExpiry: number;
    public hideAged: boolean;
    public favouriteBus: string;
    public maxMarkers: number;
    public refreshPeriod: number;
    public hideSystemMessage: boolean;

    constructor() {
        // Initialize with default values
        Object.assign(this, UserOptionsManagerImpl.DEFAULT_OPTIONS);
    }

    // Initialize options from cookies
    public async init(): Promise<void> {
        try {
            const savedOptions = Cookies.get(this.cookieName);
            if (savedOptions) {
                const parsedOptions = JSON.parse(savedOptions);
                // Validate and merge options
                this.mergeOptions(parsedOptions);
            }
        } catch (error) {
            console.warn('Failed to load user options from cookies:', error);
            // Continue with default options
        } finally {
            // Always save current options to cookies
            this.saveToCookies();
        }
    }

    // Set a specific option
    public set<K extends keyof UserOptions>(prop: K, value: UserOptions[K]): void {
        if (prop in this) {
            (this as any)[prop] = value;
            this.saveToCookies();
        } else {
            console.warn(`Attempted to set invalid option: ${String(prop)}`);
        }
    }

    // Get a specific option
    public get<K extends keyof UserOptions>(prop: K): UserOptions[K] {
        return this[prop];
    }

    // Reset to default options
    public reset(): void {
        Object.assign(this, UserOptionsManagerImpl.DEFAULT_OPTIONS);
        this.saveToCookies();
    }

    // Private helper methods
    private mergeOptions(options: Partial<UserOptions>): void {
        // Only merge valid properties
        for (const key of Object.keys(UserOptionsManagerImpl.DEFAULT_OPTIONS) as Array<keyof UserOptions>) {
            if (key in options) {
                const value = options[key];
                if (this.isValidValue(key, value)) {
                    (this as any)[key] = value;
                }
            }
        }
    }

    private isValidValue<K extends keyof UserOptions>(key: K, value: any): boolean {
        // Add type validation
        const defaultValue = UserOptionsManagerImpl.DEFAULT_OPTIONS[key];
        return typeof value === typeof defaultValue;
    }

    private saveToCookies(): void {
        try {
            const optionsToSave: Partial<UserOptions> = {
                hideAged: this.hideAged,
                favouriteBus: this.favouriteBus,
                maxMarkers: this.maxMarkers,
                refreshPeriod: this.refreshPeriod,
                hideSystemMessage: this.hideSystemMessage,
            };
            Cookies.set(this.cookieName, JSON.stringify(optionsToSave), {
                expires: this.cookieExpiry,
                secure: true,
                sameSite: 'strict',
            });
        } catch (error) {
            console.error('Failed to save user options to cookies:', error);
        }
    }
}

// Export singleton instance
export const userOptions = new UserOptionsManagerImpl();