import "./style.css";
import { appConstant } from "@components/globals.mjs";
import { appUtils } from "@components/utils.mjs";
import { operatorRoutes } from "@components/operator-routes.mjs";
import { searchHistory } from "@components/search-history.mjs";
import { userOptions } from "@components/user-options.mjs";
import { SessionManager } from "@components/SessionManager.mjs";
import { Ident } from "@components/ident.mjs";
import { currentLocation } from "@components/current-location.mjs";
import { MasterDetailPanel } from "@components/master-detail.mjs";
import { BusStop } from "@components/busStop.mjs";
import { mapObj } from "@components/map-leaflet.mjs";
import { ApiManager } from "@components/ApiManager.mjs";
import { Config } from "./Config.mjs";

//let mapObj;
let vehicles = [];
const defaultSearchCriteria = {
  lineRef: null,
  operatorRef: null,
  currentMapBounds: true,
  resizeAfterSearch: false,
  lat: null,
  lng: null,
  zoom: appConstant.defaultZoom,
};
let searchCriteria;
let extendedAttributes;
let busTracker;
let refreshTimer;
let busStopArrivalTimer;

let config = {};

// Use Config class to load configuration
const webAppConfigManager = new Config();
const apiManager = new ApiManager({});
const sessionManager = new SessionManager(apiManager);

const appMessage = new appUtils.BTMessage();
const systemMessage = new appUtils.BTMessage({
  className: "system",
  closeAction: true,
  actions: [
    {
      className: "hide",
      label: "Close and do not show again",
      action: function () {
        userOptions.set("hideSystemMessage", true);
      },
    },
  ],
});

//Wait for the page to load before initializing the app
window.addEventListener("load", async (event) => {
  // asynch call to initiate page...
  initiate();
});

async function initiate() {
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

  const startTime = new Date();
  appUtils.log(`initiate: start`);

  // Initiate service worker...
  // if (!navigator.serviceWorker.controller) {
  //   navigator.serviceWorker.register("/sw.js").then(function (reg) {
  //     appUtils.log(
  //       "Service worker has been registered for scope: " + reg.scope
  //     );
  //   });
  // }

  try {
    // load application configuration from sources and merge...
    const appConfig = await webAppConfigManager.loadConfig();
    // override apiBase if provided in config...
    apiManager.apiBaseUrl = appConfig.apiBaseUrl || apiManager.apiBaseUrl;
    const apiConfig = await sessionManager.init();
    config = { ...appConfig, ...apiConfig };
    console.log("Merged Configuration Data:", config);
  } catch (error) {
    appUtils.log(`Error initiating: ${error.message}`);
    alert(`Error initiating: ${error.message}`);
    window.location.href = "offline.html";
    return;
  }

  await Promise.all([
    mapObj.initiate(config),
    operatorRoutes.get(apiManager),
    userOptions.init(),
  ]);

  await initView();
  $(".page.dimmer.ident").dimmer("hide").dimmer("destroy");

  // config start message, this value is set in the api config...
  if (
    config &&
    config.startMessage != null &&
    userOptions.hideSystemMessage != true
  )
    systemMessage.display(config.startMessage);

  // been playing about with when this gets fired...
  $(document).trigger("ready");

  const endTime = new Date();
  appUtils.log(`initiate: complete after ${(endTime - startTime) / 1000}secs`);
}

// consider switching from JQuery to standard JavaScript and also removing dependency on Semantic/Fomantic
async function initView() {
  $(document)
    .on("show-location", (e, cl) => {
      mapObj.addCurrentLocation(currentLocation);
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
      mapObj.currentViewMode = appConstant.viewMode.track;
      trackBus(vehicleRef, true, 0);
    })
    .on("add-favourite", (e, vehicleRef) => {
      userOptions.set("favouriteBus", vehicleRef);
    })
    .on("map-move", async (e) => {
      if (mapObj.currentViewMode == appConstant.viewMode.search) {
        if (searchCriteria.resizeAfterSearch) {
          searchCriteria.resizeAfterSearch = false;
        } else {
          let mapcenter = mapObj.getCenter();
          searchCriteria = {
            ...searchCriteria,
            lat: mapcenter.lat,
            lng: mapcenter.lng,
            zoom: mapObj.getZoom(),
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
    appConstant.envMap[config.environment] || appConstant.envMap.Other
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
        mapObj.clearArrivalsPopup();
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
    let mapCentre = mapObj.getCenter();
    searchCriteria = {
      ...defaultSearchCriteria,
      lat: mapCentre.lat,
      lng: mapCentre.lng,
      zoom: mapObj.getZoom(),
    };
    mapObj.clearArrivalsPopup();
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
      mapObj.clearArrivalsPopup();
      // on completion of flyTo (map-move) the search will be executed...
      mapObj.flyTo(currentLocation.center);
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

      $("#optFavouriteBus > input").val(userOptions.favouriteBus);

      $("#optHideInactiveVehicles").checkbox(
        `set ${userOptions.hideAged ? "checked" : "unchecked"}`
      );

      $("#optMaxMarkersToDisplay").slider(
        "set value",
        userOptions.maxMarkers,
        false
      );

      $("#optTrackerRefreshPeriod").slider(
        "set value",
        userOptions.refreshPeriod,
        false
      );

      $("#optHideSystemMessage").checkbox(
        `set ${userOptions.hideSystemMessage ? "checked" : "unchecked"}`
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
            ? appConstant.shortEnGBFormatter.format(new Date(data))
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
            ? appConstant.shortEnGBFormatter.format(new Date(data))
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
    userOptions.set("favouriteBus", $(e.currentTarget).val().toUpperCase());
  });

  $("#optHideInactiveVehicles").checkbox({
    onChecked: () => {
      userOptions.set("hideAged", true);
    },
    onUnchecked: () => {
      userOptions.set("hideAged", false);
    },
  });

  $("#optMaxMarkersToDisplay").slider({
    min: appConstant.minBusDisplay,
    max: appConstant.maxBusDisplay,
    step:
      appConstant.maxBusDisplay - appConstant.minBusDisplay > 500 ? 100 : 50,
    onChange: (val) => userOptions.set("maxMarkers", val),
  });

  $("#optTrackerRefreshPeriod").slider({
    min: 10,
    max: 40,
    step: 5,
    onChange: (val) => userOptions.set("refreshPeriod", val),
  });

  $("#optHideSystemMessage").checkbox({
    onChecked: () => {
      userOptions.set("hideSystemMessage", true);
    },
    onUnchecked: () => {
      userOptions.set("hideSystemMessage", false);
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

      let recentSearches = searchHistory.get();

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

      mapObj.clearArrivalsPopup();
      busController();
      //e.preventDefault();
    })
    .on("click", ".clear", (e) => {
      searchHistory.removeAll();

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
      // reload the search history of this is being called from searchHistory...
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
    counter == parseInt(userOptions.refreshPeriod / appConstant.refreshCounter)
      ? 1
      : counter + 1;
  $("#trackerCounter .counter").html(
    userOptions.refreshPeriod - (counter - 1) * appConstant.refreshCounter
  );

  // on the first and then every userOptions.refreshPeriod call perform refresh,
  // on all other calls update the counter...
  if (counter > 1) {
    // schedule next callback...
    busTracker = setTimeout(
      trackBus,
      appConstant.refreshCounter * 1000,
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
    mapObj.clear(true);

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

      mapObj.addTrackedVehicle(vehicle);

      // schedule next callback...
      busTracker = setTimeout(
        trackBus,
        appConstant.refreshCounter * 1000,
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

  // on the first and then every userOptions.refreshPeriod call perform refresh,
  // on all other calls update the counter...
  if (counter > 0) {
    counter = counter - 1;
  } else {
    counter = userOptions.refreshPeriod;
    if (!(await getBuses())) {
      return false;
    }
  }

  $("#refreshCounter .counter").html(counter);

  // schedule next callback...
  refreshTimer = setTimeout(
    busController,
    appConstant.refreshCounter * 1000,
    counter
  );
}

async function getBuses() {
  // clear map...
  mapObj.clear();
  appMessage.hide();

  mapObj.currentViewMode = appConstant.viewMode.search;

  // if the criteria is based on the maps central postion then add this to the query...
  if (searchCriteria.currentMapBounds == true) {
    searchCriteria.bounds = mapObj.getBounds();
  }

  // add search criteria to cookie, (not including boundingBox only searches)...
  if (searchCriteria.resizeAfterSearch && searchCriteria.operatorRef) {
    searchHistory.add(searchCriteria, operatorRoutes);
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

    if (userOptions.hideAged) {
      vehicles = vehicles.filter((v) => v.aged == false);
    }

    // Display a message when no vehicles to be displayed...
    if (vehicles.length < 1) {
      appMessage.display(
        `<p>There are no active buses to display.<br>To see inactive buses click <a class="link options">here</a> and unselect the <strong>Hide inactive buses</strong> option.</p>`
      );
    } else {
      // limit number of markers loaded onto the map...
      if (vehicles.length > userOptions.maxMarkers) {
        appMessage.display(
          `<p>There are ${vehicles.length} buses identified, only ${userOptions.maxMarkers} are shown.<br>Either zoom in on an area to see all buses, or click <a class="link options">here</a> to adjust the maximum number of buses displayed.</p>`
        );
        vehicles = vehicles.filter((v, i) => i < userOptions.maxMarkers);
      }

      // add vehicles to the map, then resizeAfterSearch/reposition the map as appropriate...
      mapObj
        .addVehicles(vehicles)
        .then(() => {
          if (searchCriteria.resizeAfterSearch && vehicles.length > 0) {
            // resizeAfterSearch/reposition map to show all markers...
            mapObj.fitAllVehicles();
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
  if (mapObj.getZoom() < appConstant.minBusStopZoom) {
    mapObj.clearStopMarkers();
    mapObj.clearArrivalsPopup();
    return;
  }

  const bounds = mapObj.getBounds();
  const busStops = await apiManager.fetchStops(bounds);

  if (busStops.length > 0) {
    mapObj.addStops(busStops);
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
      appConstant.refreshStopArrivalsSecs * 1000
    );
  }
}

function enrichVehicleAttributes(v) {
  // A request from H...
  const favourite = v.vehicleRef == userOptions.favouriteBus ? true : false;
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

  await mapObj.create("map", currentLocation.center);

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
