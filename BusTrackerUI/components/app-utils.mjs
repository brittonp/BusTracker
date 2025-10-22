import { APP_CONSTANTS } from "@components/app-constants.mjs";

export const appUtils = {
  velocityBetweenPoints(point1, point2) {
    const dMetres = this.distanceBetweenPoints(point1, point2);
    const dMiles = dMetres * 0.000621371;
    const tHours =
      (new Date(point2.timestamp) - new Date(point1.timestamp)) /
      (1000 * 60 * 60);
    const speedMph = dMiles / tHours;
    const speedKph = dMetres / (tHours * 1000);

    return {
      distanceMetres: dMetres,
      distanceMiles: dMiles,
      timeHours: tHours,
      speedMph: speedMph,
      speedKph: speedKph,
    };
  },
  distanceBetweenPoints(point1, point2) {
    const lat1 = point1.lat;
    const lon1 = point1.lng;
    const lat2 = point2.lat;
    const lon2 = point2.lng;

    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // in metres

    return d;
  },
  log(msg) {
    console.log(
      `${APP_CONSTANTS.shortEnGBFormatter.format(new Date())}: ${msg}`
    );
  },
  queryStringToJSON(qs) {
    var pairs = qs.slice(1).split("&");

    var result = {};
    pairs.forEach(function (pair) {
      pair = pair.split("=");
      result[pair[0]] = decodeURIComponent(pair[1] || "");
    });

    return JSON.parse(JSON.stringify(result));
  },
  stringTrim(s, max) {
    return s;
    //return (s.length > max ? s.substring(0, max-1) + String.fromCharCode(0x2026) : s);
  },
  getCssVar(property) {
    const r = document.querySelector(":root");

    return getComputedStyle(r).getPropertyValue(property);
  },
  async sleep(delay) {
    return new Promise((resolve) => setTimeout(resolve, delay));
  },
};
