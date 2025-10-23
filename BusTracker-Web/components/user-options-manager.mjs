// userOptionsManager.js
import { APP_CONSTANTS } from "@components/app-constants.mjs";

class UserOptionsManager {
  // Define default options as a static property
  static DEFAULT_OPTIONS = Object.freeze({
    localStorage: APP_CONSTANTS.userOptionsLocalStorage,
    hideAged: true,
    favouriteBus: "",
    maxMarkers: 200,
    refreshPeriod: 15, // seconds
    hideSystemMessage: false,
  });
  constructor() {
    // Initialize instance properties with default values
    Object.assign(this, UserOptionsManager.DEFAULT_OPTIONS);
  }

  // Initialize options from storage
  async init() {
    try {
      const localStorageData = await this.#loadFromLocalStorage();
      if (localStorageData) {
        this.#mergeOptions(localStorageData);
      }
    } catch (error) {
      console.warn("Failed to load user options:", error);
    } finally {
      await this.#saveOptions();
    }
  }

  // Set a specific option
  set(prop, value) {
    if (prop in UserOptionsManager.DEFAULT_OPTIONS) {
      if (this.#isValidValue(prop, value)) {
        this[prop] = value;
        this.#saveOptions();
      } else {
        console.warn(`Invalid value type for option ${prop}`);
      }
    } else {
      console.warn(`Attempted to set invalid option: ${prop}`);
    }
  }

  // Get a specific option
  get(prop) {
    if (prop in UserOptionsManager.DEFAULT_OPTIONS) {
      return this[prop];
    }
    console.warn(`Attempted to get invalid option: ${prop}`);
    return undefined;
  }

  // Reset to default options
  reset() {
    Object.assign(this, UserOptionsManager.DEFAULT_OPTIONS);
    this.#saveOptions();
  }

  // Private helper methods
  #mergeOptions(options) {
    for (const key of Object.keys(UserOptionsManager.DEFAULT_OPTIONS)) {
      if (key in options) {
        const value = options[key];
        if (this.#isValidValue(key, value)) {
          this[key] = value;
        }
      }
    }
  }

  #isValidValue(key, value) {
    return typeof value === typeof UserOptionsManager.DEFAULT_OPTIONS[key];
  }

  async #saveOptions() {
    const optionsToSave = {
      hideAged: this.hideAged,
      favouriteBus: this.favouriteBus,
      maxMarkers: this.maxMarkers,
      refreshPeriod: this.refreshPeriod,
      hideSystemMessage: this.hideSystemMessage,
    };

    try {
      await this.#saveToLocalStorage(optionsToSave);
    } catch (error) {
      console.error("Failed to save user options:", error);
    }
  }

  async #loadFromLocalStorage() {
    try {
      if ("localStorage" in window) {
        const saved = localStorage.getItem(this.localStorage);
        if (saved) {
          return JSON.parse(saved);
        }
      }
      return null;
    } catch (error) {
      console.warn("Failed to load from localStorage:", error);
      return null;
    }
  }

  async #saveToLocalStorage(data) {
    if ("localStorage" in window) {
      localStorage.setItem(this.localStorage, JSON.stringify(data));
    }
  }

  #clearLocalStorage() {
    if ("localStorage" in window) {
      localStorage.removeItem(this.localStorage);
    }
  }
}

// Export singleton instance
export const userOptionsManager = new UserOptionsManager();
