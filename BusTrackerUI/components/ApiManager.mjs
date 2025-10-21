import { appUtils } from "@components/utils.mjs";

export class ApiManager {
  constructor(options) {
    this.options = options;
    this.apiBase = "/api"; // default API base path;
  }

  async fetchSessionCreate() {
    const baseUrl = "/Session/Create";
    const urlParams = "";
    return this.#apiFetch(baseUrl, urlParams, {
      timeout: 10 * 1000,
      dataType: "session",
    });
  }

  async fetchBusLocation(vehicleRef) {
    const baseUrl = "/BusLocation/Get";
    const urlParams = `vehicleRef=${encodeURIComponent(vehicleRef)}`;

    return this.#apiFetch(baseUrl, urlParams, {
      dataType: "bus location",
    });
  }

  async fetchArrivals(naptanId) {
    const baseUrl = "/BusStop/GetArrivals";
    const urlParams = `naptanId=${encodeURIComponent(naptanId)}`;
    return this.#apiFetch(baseUrl, urlParams, {
      dataType: "arrivals",
    });
  }

  async fetchBuses(searchCriteria) {
    const baseUrl = "/BusLocation/Get";
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

    return this.#apiFetch(baseUrl, urlParams, {
      dataType: "buses",
    });
  }

  async fetchStops(bounds) {
    const baseUrl = "/BusStop/GetByBoundingBox";
    let urlParams = `north=${bounds.north}&east=${bounds.east}&south=${bounds.south}&west=${bounds.west}`;

    return this.#apiFetch(baseUrl, urlParams, {
      dataType: "stops",
    });
  }

  async fetchOperatorLines() {
    const baseUrl = "/OperatorLines/Get";
    const urlParams = "";

    return this.#apiFetch(baseUrl, urlParams, {
      dataType: "operator lines",
    });
  }

  async #apiFetch(baseUrl, urlParams, fetchOptions = {}) {
    const finalUrl =
      this.apiBase + baseUrl + (urlParams ? `?${urlParams}` : "");

    const { timeout = 5000, method = "GET", ...otherOptions } = fetchOptions;
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
