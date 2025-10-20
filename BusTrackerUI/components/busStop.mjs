import { appConstant } from "@components/globals.mjs";
import { appUtils } from "@components/utils.mjs";

export class BusStop {
  #prevTimestamp = null;
  #timestamp = null;
  stop;
  #prevArrivals = [];
  #standardiseIndicator(val) {
    let returnVal = val;

    const filters = [
      {
        find: [
          "northeastbound",
          "north east",
          "north east bound",
          "ne bound",
          "ne-bound",
        ],
        replaceWith: "->NE",
      },
      {
        find: [
          "southeastbound",
          "south east",
          "south east bound",
          "se bound",
          "se-bound",
        ],
        replaceWith: "->SE",
      },
      {
        find: [
          "northwestbound",
          "north west",
          "north west bound",
          "nw bound",
          "nw-bound",
        ],
        replaceWith: "->NW",
      },
      {
        find: [
          "southwestbound",
          "south west",
          "south west bound",
          "sw bound",
          "sw-bound",
        ],
        replaceWith: "->SW",
      },
      {
        find: ["northbound", "north", "north bound", "n bound", "n-bound"],
        replaceWith: "->N",
      },
      {
        find: ["eastbound", "east", "east bound", "e bound", "e-bound"],
        replaceWith: "->E",
      },
      {
        find: ["southbound", "south", "south bound", "s bound", "s-bound"],
        replaceWith: "->S",
      },
      {
        find: ["westbound", "west", "west bound", "w bound", "w-bound"],
        replaceWith: "->W",
      },
      { find: ["stop ", "stand ", "bay "], replaceWith: "" },
    ];

    filters.forEach((f) => {
      f.find.forEach((fd) => {
        returnVal = returnVal.replace(new RegExp(fd, "i"), f.replaceWith);
      });
    });

    if (returnVal != val || returnVal.substring(0, 2) == "->") {
      returnVal = returnVal.trim();
    } else {
      returnVal = null;
    }

    return returnVal;
  }

  constructor(stop) {
    this.stop = {
      ...stop,
      standardIndicator: this.#standardiseIndicator(stop.indicator),
    };
  }

  async arrivals() {
    this.#prevTimestamp = this.#timestamp;

    const response = await fetch(
      `/api/BusStop/GetArrivals?naptanId=${this.stop.naptanId}`,
      {
        timeout: appConstant.timeoutService,
        method: "GET",
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to get Bus Stop arrivals. Error: ${response.status}`
      );
    }

    const data = await response.json();

    let arrivals = data
      .map((b) => {
        return {
          ...b,
          minutes: Math.floor(b.timeToStation / 60),
        };
      })
      .sort((a, b) => {
        var a1 = a.minutes;
        var b1 = b.minutes;
        if (a1 == b1) return 0;
        return a1 > b1 ? 1 : -1;
      })
      .filter((b, i) => i < appConstant.maxBusArrivals);

    // because the response returns from an array of servers, in which there is observed data latency,
    // only return the new arrival data if the timestamp is more recent than than the previous, else return the previous again...
    if (arrivals.length > 0) {
      this.#timestamp = appConstant.shortEnGBFormatter.format(
        Math.max(...arrivals.map((b) => b.timestamp).map(Date.parse))
      );
    }

    if (this.#timestamp < this.#prevTimestamp) {
      arrivals = [...this.#prevArrivals];
    } else {
      this.#prevArrivals = [...arrivals];
    }

    return arrivals;
  }
}
