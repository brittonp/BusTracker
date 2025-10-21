import { appConstant } from "@components/globals.mjs";

export const appUtils = {
  velocityBetweenPoints: function (point1, point2) {
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
  distanceBetweenPoints: function (point1, point2) {
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
  log: function log(msg) {
    console.log(`${appConstant.shortEnGBFormatter.format(new Date())}: ${msg}`);
  },
  queryStringToJSON: function (qs) {
    var pairs = qs.slice(1).split("&");

    var result = {};
    pairs.forEach(function (pair) {
      pair = pair.split("=");
      result[pair[0]] = decodeURIComponent(pair[1] || "");
    });

    return JSON.parse(JSON.stringify(result));
  },
  stringTrim: function (s, max) {
    return s;
    //return (s.length > max ? s.substring(0, max-1) + String.fromCharCode(0x2026) : s);
  },
  loadResource: function (src) {
    return new Promise(async (resolve, reject) => {
      if (src.trim().substr(-3).toLowerCase() === ".js") {
        let script = document.createElement("script");

        script.type = "text/javascript";
        script.async = true;
        script.src = src;
        script.addEventListener("load", (ev) => {
          console.log(`Script loaded: ${src}`);
          resolve({ status: true });
        });

        script.addEventListener("error", (ev) => {
          reject({
            status: false,
            message: `Failed to load the script: ${src}`,
          });
        });
        document.head.appendChild(script);
        //script.setAttribute('src', url);
      } else {
        let link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.onload = () => {
          resolve();
          console.log(`Link loaded: ${src}`);
        };
        link.href = src;
        document.head.appendChild(link);
      }
    });
  },
  BTMessage: function (options = null) {
    let actions = "";

    const defaultOptions = {
      className: "app",
      innerHtml: null,
      actions: null,
      closeAction: false,
    };

    options = {
      ...defaultOptions,
      ...options,
    };

    const el = document.createElement("div");

    // default close button handler...
    if (options.closeAction) {
      $(el).on("click", ".close.button", (e) => {
        this.hide();
      });
    }

    // build actions...
    if (options.actions) {
      options.actions.forEach((a) => {
        actions += `<div class="ui ${a.className} button">${a.label}</div>`;

        $(el).on("click", `.ui.${a.className}.button`, (e) => {
          a.action();
          this.hide();
        });
      });
    }

    el.className = `${options.className} shadow screen-message hidden`;
    el.innerHTML = `<div class="box">
            <div class="center row">
                <div class="message-content">
                    ${options.innerHtml}
                </div>
            </div>
            <div class="right row">
                <div class="actions">
                    ${
                      options.closeAction
                        ? '<div class="ui close button">Close</div>'
                        : ""
                    }
                    ${actions}
                </div>                
            </div>
        </div>`;

    document.body.appendChild(el);

    this.display = function (content) {
      $(el).find(".message-content").html(content);
      $(el).removeClass("hidden");

      if (!options.closeAction) {
        setTimeout(() => {
          this.hide();
        }, 5000);
      }
    };
    this.hide = function () {
      $(el).addClass("hidden");
    };
  },
  getCssVar: function (property) {
    const r = document.querySelector(":root");

    return getComputedStyle(r).getPropertyValue(property);
  },

  sleep: async function (delay) {
    return new Promise((resolve) => setTimeout(resolve, delay));
  },
};
