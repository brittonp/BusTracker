import "./style.css";
import { APP_CONSTANTS } from "@components/app-constants.mjs";
import { appUtils } from "@components/app-utils.mjs";
import { operatorRoutes } from "@components/operator-routes.mjs";
import { searchHistoryManager } from "@components/search-history-manager.mjs";
import { userOptionsManager } from "@components/user-options-manager.mjs";
import { SessionManager } from "@components/session-manager.mjs";
import { Ident } from "@components/ident.mjs";
import { currentLocation } from "@components/current-location.mjs";
import { MasterDetailPanel } from "@components/master-detail.mjs";
import { BusStop } from "@components/bus-stop.mjs";
import { mapManager } from "@components/map-manager.mjs";
import { ApiManager } from "@components/api-manager.mjs";
import { Config } from "./Config.mjs";
import { MessagePanel } from "@components/message-panel.mjs";

let vehicles = [];
const defaultSearchCriteria = {
  lineRef: null,
  operatorRef: null,
  currentMapBounds: true,
  resizeAfterSearch: false,
  lat: null,
  lng: null,
  zoom: APP_CONSTANTS.defaultZoom,
};
let searchCriteria;
let busTracker;
let refreshTimer;
let busStopArrivalTimer;
const config = {};

// Intialize configuration, API manager, session manager, user options manager, message panels...
const webAppConfigManager = new Config();
const apiManager = new ApiManager({});
const sessionManager = new SessionManager(apiManager);
const appMessage = new MessagePanel();
const systemMessage = new MessagePanel({
  className: "system",
  closeAction: true,
  actions: [
    {
      className: "hide",
      label: "Close and do not show again",
      action: function () {
        userOptionsManager.set("hideSystemMessage", true);
      },
    },
  ],
});

//Wait for the page to load before initializing the app
window.addEventListener("load", async (event) => {
  const startTime = new Date();
  appUtils.log(`initiate: start`);

  //initViewPort();
  const mapPane = document.getElementById("map-pane");
  mapPane.container = new MasterDetailPanel({
    content: mapPane,
    detailClass: "content pane",
  });

  const ident = new Ident("Bus Tracker loading...");

  $(document).on("session", (e, counter) => {
    ident.setText(e.detail.counter);
  });

  $(".page.dimmer.ident").append(ident.content);
  $(".page.dimmer.ident")
    .dimmer({
      closable: false,
    })
    .dimmer("show");

  try {
    // load application configuration from sources and merge...
    const appConfig = await webAppConfigManager.loadConfig();

    // override apiBase if provided in config...
    apiManager.apiBaseUrl = appConfig.apiBaseUrl || apiManager.apiBaseUrl;
    const apiConfig = await sessionManager.init();
    Object.assign(config, appConfig, apiConfig);

    console.log("Merged Configuration Data:", config);
  } catch (error) {
    appUtils.log(`Error initiating: ${error.message}`);
    window.location.href = "offline.html";
    return;
  }

  await Promise.all([
    mapManager.initiate(config),
    operatorRoutes.get(apiManager),
    userOptionsManager.init(),
  ]);

  await initView();

  // bit ugly but need to ensure splash is removed before showing app
  $(".page.dimmer.ident").dimmer("hide").dimmer("destroy");

  // config start message, this value is set in the api config...
  if (config?.startMessage && userOptionsManager.hideSystemMessage != true)
    systemMessage.display(config.startMessage);

  // been playing about with when this gets fired...
  $(document).trigger("ready");

  const endTime = new Date();
  appUtils.log(`initiate: complete after ${(endTime - startTime) / 1000}secs`);
});
// consider switching from JQuery to standard JavaScript and also removing dependency on Semantic/Fomantic
async function initView() {
  $(document)
    .on("show-location", (e, cl) => {
      mapManager.addCurrentLocation(currentLocation);
    })
    .on("ready", async (e) => {
      // initialise the searchCriteria (base from defaults, plus query string, if provided)...
      if (location.search) {
        searchCriteria = {
          ...defaultSearchCriteria,
          ...appUtils.queryStringToJSON(location.search),
        };

        // initiate search on search criteria...
        $(".menu-btn.refresh").trigger("click");
      } else {
        $(".menu-btn.here").trigger("click");
      }

      addStops();
    })
    .on("search-route", (e, sc) => {
      searchCriteria = sc;
      busController();
    })
    .on("track-vehicle", (e, vehicleRef) => {
      mapManager.currentViewMode = APP_CONSTANTS.viewMode.track;
      trackBus(vehicleRef, true, 0);
    })
    .on("add-favourite", (e, vehicleRef) => {
      userOptionsManager.set("favouriteBus", vehicleRef);
    })
    .on("map-move", async (e) => {
      if (mapManager.currentViewMode == APP_CONSTANTS.viewMode.search) {
        if (searchCriteria.resizeAfterSearch) {
          searchCriteria.resizeAfterSearch = false;
        } else {
          let mapcenter = mapManager.getCenter();
          searchCriteria = {
            ...searchCriteria,
            lat: mapcenter.lat,
            lng: mapcenter.lng,
            zoom: mapManager.getZoom(),
          };
          await busController();
        }

        addStops();
      }
      e.preventDefault();
    })
    .on("show-bus-stop-arrivals", async (e, stop) => {
      displayStopArrivals(stop);
    })
    .on("detail-hidden", (e) => {
      if (busStopArrivalTimer) {
        clearTimeout(busStopArrivalTimer);
      }
    });

  // Set environment glyph..
  $(".env-glyph").addClass(
    APP_CONSTANTS.envMap[config.environment] || APP_CONSTANTS.envMap.Other
  );

  // disable data dependent buttons...
  $(".dataDependent").addClass("disabled");

  $("#search")
    .search({
      source: operatorRoutes.list,
      maxResults: 0,
      searchFields: ["title"],
      minCharacters: 2,
      selectFirstResult: true,
      fullTextSearch: "all",
      showNoResults: true,
      onSelect: function (result, response) {
        searchCriteria = {
          ...defaultSearchCriteria,
          lineRef: result.lineRef,
          operatorRef: result.operatorRef,
          currentMapBounds: false,
          resizeAfterSearch: true,
        };

        $(this.parentElement).removeClass("open");
        mapManager.clearArrivalsPopup();
        busController();
      },
    })
    .on("click", ".clear", function (e) {
      const input = $(e.delegateTarget).find("input");
      const clearIcon = $(e.delegateTarget).find("i.clear");
      input.val("");
      input.focus();
      clearIcon.addClass("hidden");
      e.preventDefault();
    })
    .on("keyup", "input", function (e) {
      const clearIcon = $(e.delegateTarget).find("i.clear");
      if ($(e.target).val() == "") {
        clearIcon.addClass("hidden");
      } else {
        clearIcon.removeClass("hidden");
      }
      e.preventDefault();
    });

  $(".ui.checkbox").checkbox();

  $(".menu-btn.operators").on("click", "#searchMenu", (e) => {
    const panel = $(e.delegateTarget).find(".search.panel");
    panel.toggleClass("open");
    e.preventDefault();
  });

  $(".menu-btn.here").on("click", (e) => {
    let mapCentre = mapManager.getCenter();
    searchCriteria = {
      ...defaultSearchCriteria,
      lat: mapCentre.lat,
      lng: mapCentre.lng,
      zoom: mapManager.getZoom(),
    };
    mapManager.clearArrivalsPopup();
    busController();
    e.preventDefault();
  });

  $(".menu-btn.me").on("click", async (e) => {
    await currentLocation.get();
    if (currentLocation.canTrack) {
      // if location is known we shall recenter the map on that...
      searchCriteria = {
        ...defaultSearchCriteria,
        lat: currentLocation.position.lat,
        lng: currentLocation.position.lng,
      };
      mapManager.clearArrivalsPopup();
      // on completion of flyTo (map-move) the search will be executed...
      mapManager.flyTo(currentLocation.center);
    }
    e.preventDefault();
  });

  $(".menu-btn.refresh").on("click", (e) => {
    busController();
    e.preventDefault();
  });

  $(".menu-btn.main")
    .on("click", "#viewOptions", (e) => {
      $("#optionsMenu").popup("hide");

      $("#optFavouriteBus > input").val(userOptionsManager.favouriteBus);

      $("#optHideInactiveVehicles").checkbox(
        `set ${userOptionsManager.hideAged ? "checked" : "unchecked"}`
      );

      $("#optMaxMarkersToDisplay").slider(
        "set value",
        userOptionsManager.maxMarkers,
        false
      );

      $("#optTrackerRefreshPeriod").slider(
        "set value",
        userOptionsManager.refreshPeriod,
        false
      );

      $("#optHideSystemMessage").checkbox(
        `set ${userOptionsManager.hideSystemMessage ? "checked" : "unchecked"}`
      );

      $("#options")
        .modal({
          closable: false,
        })
        .modal("show");
    })
    .on("click", "#viewJson", (e) => {
      $("#optionsMenu").popup("hide");

      $("#json")
        .modal({
          closable: false,
        })
        .modal("show");
    });

  // Share...
  $(".menu-btn.share").on("click", async (e) => {
    try {
      await navigator.share({
        title: "BusTracker",
        url: `${window.location.origin}?${$.param(searchCriteria)}`,
      });
      console.log("Data was shared successfully");
    } catch (err) {
      console.error("Share failed:", err.message);
    }

    e.preventDefault();
  });

  $("#infoTracking").on("click", (e) => {
    let v = $(e.currentTarget).data("vehicleActivity");
    let vehicleDetails = [
      {
        title: "Operator",
        data: v.operatorName,
      },
      {
        title: "Route",
        data: v.publishedLineName,
      },
      {
        title: "Origin",
        data: v.originName,
      },
      {
        title: "Aimed Origin Departure Time",
        data: v.originAimedDepartureTime,
        formatter: (data) => {
          return data
            ? APP_CONSTANTS.shortEnGBFormatter.format(new Date(data))
            : null;
        },
      },
      {
        title: "Destination",
        data: v.destinationName,
      },
      {
        title: "Aimed Destination Arrival Time",
        data: v.destinationAimedArrivalTime,
        formatter: (data) => {
          return data
            ? APP_CONSTANTS.shortEnGBFormatter.format(new Date(data))
            : null;
        },
      },
    ];

    let html = "";
    let stripe = true;
    vehicleDetails.forEach((v) => {
      html = html + `<div class="${stripe ? " stripe1 " : ""}row">`;
      html = html + `<div class="six wide label column">${v.title}</div>`;
      html =
        html +
        `<div class="ten wide column">${
          !v.data ? "Not provided" : v.formatter ? v.formatter(v.data) : v.data
        }</div>`;
      html = html + `</div>`;
      stripe = !stripe;
    });

    $("#trackedBusInfo .content .grid").html(html);

    $("#trackedBusInfo")
      .modal({
        title: "Tracked Bus Information",
        class: "tiny",
        closeIcon: true,
      })
      .modal("show");

    e.preventDefault();
  });

  $("#stopTracking").on("click", (e) => {
    clearTimeout(busTracker);
    $(".search.panel").show();
    $(".menu-btn.search").show();
    $(".track.panel").hide();
    // enable data dependent buttons...
    $(".menu-btn").removeClass("disabled");
    $(".menu-btn.refresh").trigger("click");
    e.preventDefault();
  });

  // this is for the appMessage with link to open Options dialog...
  $("body").on("click", ".link.options", (e) => {
    $("#viewOptions").trigger("click");
  });

  $("#optFavouriteBus").on("blur", "input", (e) => {
    userOptionsManager.set(
      "favouriteBus",
      $(e.currentTarget).val().toUpperCase()
    );
  });

  $("#optHideInactiveVehicles").checkbox({
    onChecked: () => {
      userOptionsManager.set("hideAged", true);
    },
    onUnchecked: () => {
      userOptionsManager.set("hideAged", false);
    },
  });

  $("#optMaxMarkersToDisplay").slider({
    min: APP_CONSTANTS.minBusDisplay,
    max: APP_CONSTANTS.maxBusDisplay,
    step:
      APP_CONSTANTS.maxBusDisplay - APP_CONSTANTS.minBusDisplay > 500
        ? 100
        : 50,
    onChange: (val) => userOptionsManager.set("maxMarkers", val),
  });

  $("#optTrackerRefreshPeriod").slider({
    min: 10,
    max: 40,
    step: 5,
    onChange: (val) => userOptionsManager.set("refreshPeriod", val),
  });

  $("#optHideSystemMessage").checkbox({
    onChecked: () => {
      userOptionsManager.set("hideSystemMessage", true);
    },
    onUnchecked: () => {
      userOptionsManager.set("hideSystemMessage", false);
    },
  });

  // Bind search button to form...
  $("#closeOptionsForm").on("click", (e) => {
    $("#options").modal("hide");
  });

  $(".search-history")
    .on("load", (e) => {
      const list = $(e.currentTarget).find(".list");
      list.empty();

      let recentSearches = searchHistoryManager.get();

      if (recentSearches.length > 0) {
        recentSearches.forEach((s) => {
          list.append(
            `<div class="link item" data='${JSON.stringify(s)}'>${
              s.title
            }</div>`
          );
        });
      } else {
        list.append("<div >No previous searches</div>");
      }
      return true;
    })
    .on("click", ".item", (e) => {
      searchCriteria = JSON.parse(e.currentTarget.attributes.data.value);

      // not ideal...
      let title = operatorRoutes.list.find(
        (e) =>
          e.operatorRef == searchCriteria.operatorRef &&
          e.lineRef == searchCriteria.lineRef
      ).title;
      $("#search").search("set value", title);
      $("#search input").trigger("keyup"); // force display of clear button...

      // force hide of popup (some times hangs around)...
      $("#searchHistory").popup("hide");

      mapManager.clearArrivalsPopup();
      busController();
      //e.preventDefault();
    })
    .on("click", ".clear", (e) => {
      searchHistoryManager.removeAll();

      // force hide of popup (some times hangs around)...
      $("#searchHistory").popup("hide");

      //e.preventDefault();
    });

  $(".menu .browse").popup({
    inline: true,
    on: "click",
    hoverable: true,
    position: "bottom left",
    prefer: "adjacent",
    delay: {
      show: 300,
      hide: 300,
    },
    onShow: (e) => {
      // reload the search history of this is being called from searchHistoryManager...
      if (e.id == "searchHistory") {
        $(".search-history").trigger("load");
      }
      return true;
    },
  });

  await initMap();
}

async function trackBus(vehicleRef, firstTime, counter) {
  counter =
    counter ==
    parseInt(userOptionsManager.refreshPeriod / APP_CONSTANTS.refreshCounter)
      ? 1
      : counter + 1;
  $("#trackerCounter .counter").html(
    userOptionsManager.refreshPeriod -
      (counter - 1) * APP_CONSTANTS.refreshCounter
  );

  // on the first and then every userOptionsManager.refreshPeriod call perform refresh,
  // on all other calls update the counter...
  if (counter > 1) {
    // schedule next callback...
    busTracker = setTimeout(
      trackBus,
      APP_CONSTANTS.refreshCounter * 1000,
      vehicleRef,
      false,
      counter
    );
    return;
  }

  $("#map")
    .dimmer({
      displayLoader: true,
      loaderVariation: "slow orange medium elastic",
      loaderText: "Retrieving data, please wait...",
      closable: false,
    })
    .dimmer("show");

  if (firstTime) {
    mapManager.clear(true);

    $(".search.panel").hide();
    $(".menu-btn.search").hide();
    $(".track").show();
    // clear any existing timer...
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
  }

  try {
    const trackedVehicles = await apiManager.fetchBusLocation(vehicleRef);

    $("#jsonText").text(JSON.stringify(vehicles, null, 2));

    if (trackedVehicles.length > 0) {
      var vehicle = trackedVehicles[0];

      // enrich data...
      vehicle.extendedAttributes = enrichVehicleAttributes(vehicle);

      $("#infoTracking").data("vehicleActivity", vehicle);

      let title = `${vehicle.vehicleRef} (${vehicle.operatorName} - ${vehicle.publishedLineName})`;
      $("#trackedVehicle").html(title);

      mapManager.addTrackedVehicle(vehicle);

      // schedule next callback...
      busTracker = setTimeout(
        trackBus,
        APP_CONSTANTS.refreshCounter * 1000,
        vehicleRef,
        false,
        counter
      );
    } else {
      appMessage.display("Tracked vehicle cannot be located.");
      //$('.dataDependent').addClass('disabled');
    }
  } catch (e) {
    appMessage.display(e.message);
    return false;
  } finally {
    $("#map").dimmer("hide");
  }
}

async function busController(counter = 0) {
  // clear any existing timer...
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  if (!searchCriteria) {
    return false;
  }

  // on the first and then every userOptionsManager.refreshPeriod call perform refresh,
  // on all other calls update the counter...
  if (counter > 0) {
    counter = counter - 1;
  } else {
    counter = userOptionsManager.refreshPeriod;
    if (!(await getBuses())) {
      return false;
    }
  }

  $("#refreshCounter .counter").html(counter);

  // schedule next callback...
  refreshTimer = setTimeout(
    busController,
    APP_CONSTANTS.refreshCounter * 1000,
    counter
  );
}

async function getBuses() {
  // clear map...
  mapManager.clear();
  appMessage.hide();

  mapManager.currentViewMode = APP_CONSTANTS.viewMode.search;

  // if the criteria is based on the maps central postion then add this to the query...
  if (searchCriteria.currentMapBounds == true) {
    searchCriteria.bounds = mapManager.getBounds();
  }

  // add search criteria to cookie, (not including boundingBox only searches)...
  if (searchCriteria.resizeAfterSearch && searchCriteria.operatorRef) {
    searchHistoryManager.add(searchCriteria, operatorRoutes);
  }

  appUtils.log(`searchCriteria: ${JSON.stringify(searchCriteria)}`);

  vehicles = await apiManager.fetchBuses(searchCriteria);

  $("#jsonText").text(JSON.stringify(vehicles, null, 2));

  if (vehicles.length > 0) {
    vehicles = vehicles.map((v) => {
      const extendedAttributes = enrichVehicleAttributes(v);
      return {
        ...v,
        extendedAttributes,
      };
    });

    if (userOptionsManager.hideAged) {
      vehicles = vehicles.filter((v) => v.aged == false);
    }

    // Display a message when no vehicles to be displayed...
    if (vehicles.length < 1) {
      appMessage.display(
        `<p>There are no active buses to display.<br>To see inactive buses click <a class="link options">here</a> and unselect the <strong>Hide inactive buses</strong> option.</p>`
      );
    } else {
      // limit number of markers loaded onto the map...
      if (vehicles.length > userOptionsManager.maxMarkers) {
        appMessage.display(
          `<p>There are ${vehicles.length} buses identified, only ${userOptionsManager.maxMarkers} are shown.<br>Either zoom in on an area to see all buses, or click <a class="link options">here</a> to adjust the maximum number of buses displayed.</p>`
        );
        vehicles = vehicles.filter((v, i) => i < userOptionsManager.maxMarkers);
      }

      // add vehicles to the map, then resizeAfterSearch/reposition the map as appropriate...
      mapManager
        .addVehicles(vehicles)
        .then(() => {
          if (searchCriteria.resizeAfterSearch && vehicles.length > 0) {
            // resizeAfterSearch/reposition map to show all markers...
            mapManager.fitAllVehicles();
          }
        })
        .catch((e) => {
          console.error(`Critical failure: ${e.message}`);
          displayError(`Oops, a problem occurred displaying the buses.`);
        });

      $(".menu-btn.refresh i").addClass("loading");
      // enable data dependent buttons...
      $(".dataDependent").removeClass("disabled");
    }
  } else {
    vehicles = null;
    appMessage.display(
      "No buses matching your criteria are appearing here. Either zoom out or change your criteria."
    );
    $(".dataDependent").addClass("disabled");
  }

  // reset search criteria...
  searchCriteria.currentMapBounds = true;
  searchCriteria.bounds = null;

  return true;
}

async function addStops() {
  // restrict when bus stops are displayed...
  if (mapManager.getZoom() < APP_CONSTANTS.minBusStopZoom) {
    mapManager.clearStopMarkers();
    mapManager.clearArrivalsPopup();
    return;
  }

  const bounds = mapManager.getBounds();
  const busStops = await apiManager.fetchStops(bounds);

  if (busStops.length > 0) {
    mapManager.addStops(busStops);
  }

  return false;
}

async function displayStopArrivals(stop) {
  const busStop = new BusStop(stop, apiManager);

  await reloadContent(true);

  async function reloadContent(firstTime = false) {
    // cancel any exisiting arrival refreshes (for a previously selected bus stop)...
    if (busStopArrivalTimer) {
      clearTimeout(busStopArrivalTimer);
    }

    let arrivals = [];

    try {
      arrivals = await busStop.arrivals();
    } catch {
      null;
    }

    let content = `
        <div class="pane row">
            ${
              busStop.stop.standardIndicator
                ? `<div class="indicator" title='${busStop.stop.naptanId}'>${busStop.stop.standardIndicator}</div>`
                : ""
            }
            <div class="destination">${busStop.stop.commonName}${
      !busStop.stop.standardIndicator ? ", " + busStop.stop.indicator : ""
    }<br> </div>
        </div>`;
    if (arrivals.length > 0) {
      content += `
            <div class="pane row">
                <table class="ui very basic unstackable striped very compact table">
                    <thead>
                        <tr>
                            <th class="center aligned one wide">Live</th>
                            <th class="center aligned three wide">Mins</th>
                            <th class="center aligned three wide">Route</th>
                            <th class="four wide">Destination</th>
                            <th class="one wide">Source</th>
                        </tr>
                    </thead>
                <tbody>
            </div>`;
      arrivals.forEach((b, index) => {
        content += `<tr>
                    <td class="center aligned one wide">${
                      b.liveData == true ? "Live" : "Schd."
                    }</td>
                    <td class="center aligned three wide">${
                      b.minutes < 1 ? "Due" : b.minutes
                    }</td>
                    <td class="center aligned  three wide">${b.lineName}</td>
                    <td class="four wide">${b.destinationName}</td>
                    <td class="one wide">${b.src}</td>
                </tr>`;
      });
      content += "</tbody></table>";
    } else {
      content += `
            <div class="pane row" >
                <div> Sorry, there is no arrival data available for this stop.</div>
            </div>`;
    }

    content += `
        </div>`;

    if (busStop.stop.atcoAreaCode == "490") {
      content += `
            <div class="pane row">
                <div><a href="https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service" target="_blank">Powered by TfL Open Data</a></div>
            </div>`;
    }

    // refresh detail pane...
    document.getElementById("map-pane").container.detail.setContent(content);

    // automated refresh....
    busStopArrivalTimer = setTimeout(
      reloadContent,
      APP_CONSTANTS.refreshStopArrivalsSecs * 1000
    );
  }
}

function enrichVehicleAttributes(v) {
  // A request from H...
  const favourite =
    v.vehicleRef == userOptionsManager.favouriteBus ? true : false;
  const extendedAttributes = {
    favourite: favourite,
  };

  return extendedAttributes;
}

async function initMap() {
  await currentLocation.get();
  if (!currentLocation.canTrack) {
    $(".menu-btn.me").addClass("disabled");
  }

  await mapManager.create("map", currentLocation.center);

  // show the current location, if known...
  if (currentLocation.canTrack) {
    await currentLocation.set();
  }
}

function displayError(content, autoHide = false) {
  var modal = $.modal({
    /*title: title,*/
    class: "tiny",
    closeIcon: !autoHide,
    content: content,
  }).modal("show");

  if (autoHide) {
    modal.delay(1500).queue(function () {
      $(this).modal("hide").dequeue();
    });
  }
}

// overwrite the search logic to control the list order of matching operators and routes (need to also replicate the message function too, not sure why)...
$.fn.search.settings.templates = {
  message: function (message, type, header) {
    var html = "";
    if (message !== undefined && type !== undefined) {
      html += "" + '<div class="message ' + type + '">';
      if (header) {
        html += "" + '<div class="header">' + header + "</div>";
      }
      html += ' <div class="description">' + message + "</div>";
      html += "</div>";
    }

    return html;
  },
  standard: function (response) {
    // Your own sorting logic here
    var sortedResults = response.results.sort((a, b) => {
      if (a.operatorName == b.operatorName) {
        a.linePrefix = a.lineName.match(/^[A-Z]+/);
        a.lineNumber = parseInt(
          a.lineName.replace(/^[A-Z]+/, "").replace(/[A-Z]+$/, "")
        );
        if (isNaN(a.lineNumber)) a.lineNumber = 0;
        a.lineSuffix = a.lineName.match(/[A-Z]+$/);

        b.linePrefix = b.lineName.match(/^[A-Z]+/);
        b.lineNumber = parseInt(
          b.lineName.replace(/^[A-Z]+/, "").replace(/[A-Z]+$/, "")
        );
        if (isNaN(b.lineNumber)) b.lineNumber = 0;
        b.lineSuffix = b.lineName.match(/[A-Z]+$/);

        if (a.lineNumber == b.lineNumber) {
          return a.linePrefix < b.linePrefix ? -1 : 1;
        }

        return a.lineNumber < b.lineNumber ? -1 : 1;
      }
      return a.operatorName < b.operatorName ? -1 : 1;
    });

    // Create the DOM as as it normally should be
    return $.map(sortedResults, function (item) {
      return $("<div>")
        .append(
          $("<a>")
            .addClass("result")
            .append(
              $("<div>")
                .addClass("content")
                .append($("<div>").addClass("title").text(item.title))
            )
        )
        .html();
    });
  },
};
