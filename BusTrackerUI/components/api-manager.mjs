import { APP_CONSTANTS } from "@components/app-constants.mjs";
import { appUtils } from "@components/app-utils.mjs";

export class ApiManager {
  constructor(options) {
    this.options = options;
    this.apiBaseUrl = "/api"; // default API base path;
  }

  async fetchSessionCreate() {
    const url = "/Session/Create";
    const urlParams = "";
    return this.#apiFetch(url, urlParams, {
      timeout: 2 * 1000,
      dataType: "session",
    });
  }

  async fetchBusLocation(vehicleRef) {
    const url = "/BusLocation/Get";
    const urlParams = `vehicleRef=${encodeURIComponent(vehicleRef)}`;

    return this.#apiFetch(url, urlParams, {
      dataType: "bus location",
    });
  }

  async fetchArrivals(naptanId) {
    const url = "/BusStop/GetArrivals";
    const urlParams = `naptanId=${encodeURIComponent(naptanId)}`;
    return this.#apiFetch(url, urlParams, {
      dataType: "arrivals",
    });
  }

  async fetchBuses(searchCriteria) {
    const url = "/BusLocation/Get";
    let urlParams = "";

    if (searchCriteria.operatorRef) {
      urlParams = `${urlParams}&operatorRef=${searchCriteria.operatorRef}`;
    }

    if (searchCriteria.lineRef) {
      urlParams = `${urlParams}&lineRef=${searchCriteria.lineRef}`;
    }

    if (searchCriteria.currentMapBounds == true) {
      urlParams = `${urlParams}&boundingBox=${searchCriteria.bounds.west},${searchCriteria.bounds.south},${searchCriteria.bounds.east},${searchCriteria.bounds.north}`;
    }

    return this.#apiFetch(url, urlParams, {
      dataType: "buses",
    });
  }

  async fetchStops(bounds) {
    const url = "/BusStop/GetByBoundingBox";
    let urlParams = `north=${bounds.north}&east=${bounds.east}&south=${bounds.south}&west=${bounds.west}`;

    return this.#apiFetch(url, urlParams, {
      dataType: "stops",
    });
  }

  async fetchOperatorLines() {
    const url = "/OperatorLines/Get";
    const urlParams = "";

    return this.#apiFetch(url, urlParams, {
      dataType: "operator lines",
    });
  }

  async #apiFetch(url, urlParams, fetchOptions = {}) {
    const finalUrl = this.apiBaseUrl + url + (urlParams ? `?${urlParams}` : "");

    const {
      timeout = APP_CONSTANTS.timeoutService,
      method = "GET",
      ...otherOptions
    } = fetchOptions;
    const controller = new AbortController();
    const signal = controller.signal;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(finalUrl, {
        method: method,
        ...otherOptions,
        signal: signal,
      });

      if (!response.ok) {
        throw new Error(
          `Error encountered when requesting ${fetchOptions.dataType}: ${response.status}-${response.statusText}.`
        );
      }

      appUtils.log(`API Fetch successful for ${fetchOptions.dataType} data.`);

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
