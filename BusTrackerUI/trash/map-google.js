import { APP_CONSTANTS } from "@components/app-constants.mjs";
import { appUtils } from "@components/app-utils.mjs";

export let mapObj = {
  mapElement: null,
  map: null,
  markerMe: null,
  markers: [],
  paths: [],
  speedMarkers: [],
  accuracyCircle: null,
  currentViewMode: APP_CONSTANTS.viewMode.search, // default initial mode...
  loading: true,
  props: {
    zoom: APP_CONSTANTS.defaultZoom,
    center: {
      lat: 54.87676318480376,
      lng: -3.1485196166071217,
    },
    mapId: "DEMO_MAP_ID",
    zoomControl: true,
    mapTypeControl: false,
    scaleControl: true,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: false,
    clickableIcons: false,
    minZoom: 6,
    maxZoom: 17,
    restriction: {
      latLngBounds: APP_CONSTANTS.mapBounds,
      strictBounds: false,
    },
  },
  initiate: async function (session) {
    this.session = session;

    try {
      ((g) => {
        var h,
          a,
          k,
          p = "The Google Maps JavaScript API",
          c = "google",
          l = "importLibrary",
          q = "__ib__",
          m = document,
          b = window;
        b = b[c] || (b[c] = {});
        var d = b.maps || (b.maps = {}),
          r = new Set(),
          e = new URLSearchParams(),
          u = () =>
            h ||
            (h = new Promise(async (f, n) => {
              await (a = m.createElement("script"));
              e.set("libraries", [...r] + "");
              for (k in g)
                e.set(
                  k.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()),
                  g[k]
                );
              e.set("callback", c + ".maps." + q);
              a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
              d[q] = f;
              a.onerror = () => (h = n(Error(p + " could not load.")));
              a.nonce = m.querySelector("script[nonce]")?.nonce || "";
              m.head.append(a);
            }));
        d[l]
          ? console.warn(p + " only loads once. Ignoring:", g)
          : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)));
      })({ key: session.googleMapKey, v: "weekly" });

      return true;
    } catch (err) {
      return false;
    }
  },
  create: async function (mapID, center) {
    appUtils.log("mapObj.create - start");

    this.mapElement = document.getElementById(mapID);

    this.props = {
      ...this.props,
      center: center,
    };

    // Request needed libraries.
    //@ts-ignore
    const { Map } = await google.maps.importLibrary("maps");

    this.map = await new Map(this.mapElement, this.props);

    // create event listeners...
    //this.map.addListener('click', (e) => {
    //    new google.maps.InfoWindow({
    //        content: `You clicked the map at ${e.latLng.toString()}`,
    //        position: e.latLng,
    //        map: mapObj.map,
    //    });
    //});

    this.map.addListener("dragend", () => {
      if (this.currentViewMode == APP_CONSTANTS.viewMode.search) {
        $(document).trigger("map-move");
      }
    });

    this.map.addListener("zoom_changed", () => {
      if (this.currentViewMode == APP_CONSTANTS.viewMode.search) {
        $(document).trigger("map-move");
      }
    });

    // used to check when map has been intialised the first time (only) and is ready to start being used...
    this.map.addListener("bounds_changed", () => {
      if (this.loading == true) {
        this.loading = false;
        $(document).trigger("ready");
      }
    });

    appUtils.log("mapObj.create - end");

    return this.map;
  },
  addCurrentLocation: async function (currentLocation) {
    const toolTip =
      currentLocation.position.accuracy > 10
        ? `This is an estimate of your location within ${Math.floor(
            currentLocation.position.accuracy
          )} metres.`
        : "Your location.";

    // add markers for current location...
    if (!this.markerMe) {
      // Request needed libraries.
      const { AdvancedMarkerElement, PinElement } =
        await google.maps.importLibrary("marker");
      const meSmallTag = document.createElement("div");
      meSmallTag.className = "bt marker-me-anchor";
      meSmallTag.innerHTML = `<div class="bt marker-me"></div>`;
      //meSmallTag.innerHTML = `<div class="bt marker-me"><i class="white crosshairs icon"></i></div>`;

      this.markerMe = new google.maps.marker.AdvancedMarkerElement({
        map: this.map,
        position: currentLocation.center,
        content: meSmallTag,
        title: toolTip,
      });

      this.markerMe.content.style.transform = "translateY(50%)";
    } else {
      this.markerMe.position = currentLocation.center;
      this.markerMe.title = toolTip;
    }

    if (!this.accuracyCircle) {
      this.accuracyCircle = new google.maps.Circle({
        strokeColor: "#8160d4",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#8160d4",
        fillOpacity: 0.15,
        map: this.map,
        center: currentLocation.center,
        radius: currentLocation.position.accuracy, //metres..
        clickable: false,
      });
    } else {
      this.accuracyCircle.setCenter(currentLocation.center);
      this.accuracyCircle.setRadius(currentLocation.position.accuracy); //metres..
    }
  },
  clear: function () {
    // delete existing markers...
    for (let i = 0; i < this.markers.length; i++) {
      this.markers[i].setMap(null);
    }
    this.markers = [];

    // delete paths...
    for (let i = 0; i < this.paths.length; i++) {
      this.paths[i].setMap(null);
    }
    this.paths = [];

    // delete speedMarkers...
    for (let i = 0; i < this.speedMarkers.length; i++) {
      this.speedMarkers[i].setMap(null);
    }
    this.speedMarkers = [];
  },
  addVehicles: async function (vehicles) {
    let info;

    // add markers for each vehicle...
    const thisObj = this;
    $.each(vehicles, function (index, vehicle) {
      // A request from H...
      const favourite =
        vehicle.extendedAttributes.favourite == true ? "favourite" : "";
      // aged infers recorded at time > 1 hour....
      const aged = vehicle.aged == true ? "aged" : "";

      const searchCriteria = {
        lineRef: vehicle.MonitoredVehicleJourney.LineRef,
        operatorRef: vehicle.MonitoredVehicleJourney.OperatorRef,
        currentMapBounds: false,
        resizeAfterSearch: true,
      };

      const position = {
        lat: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Latitude),
        lng: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Longitude),
      };

      const tag = document.createElement("div");
      tag.className = "bt marker-anchor";
      tag.innerHTML = `<div class="bt marker-vehicle ${
        vehicles.length > APP_CONSTANTS.vehicleSmallThreshold ? "small" : ""
      } bus-direction-${vehicle.directionCode} ${favourite} ${aged}" 
                style="--dir: ${Number(
                  vehicle.MonitoredVehicleJourney.Bearing
                )}"
                title="${vehicle.MonitoredVehicleJourney.VehicleRef} (${
        vehicle.extendedAttributes.operatorName
      } - ${vehicle.MonitoredVehicleJourney.PublishedLineName})">
                    <div class="route">
                        ${appUtils.stringTrim(
                          vehicle.MonitoredVehicleJourney.PublishedLineName,
                          3
                        )}
                    </div>
                </div>`;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: thisObj.map,
        position: position,
        content: tag,
        title:
          vehicle.MonitoredVehicleJourney.VehicleRef +
          "-" +
          vehicle.MonitoredVehicleJourney.DestinationName,
      });

      // important to vertically align marker on the center of the position...
      marker.content.style.transform = "translateY(50%)";

      marker.vehicle = vehicle;
      marker.position = position;

      // detail marker...
      const content = `
            <div class="bt info">
                <div class="details">
                    <div class="route bus-direction-${
                      vehicle.directionCode
                    } ${favourite} ${aged}">
                        ${appUtils.stringTrim(
                          vehicle.MonitoredVehicleJourney.PublishedLineName,
                          3
                        )}
                    </div>
                    <div class="properties">
                        <div class="vehicleRef">Operator: ${
                          vehicle.extendedAttributes.operatorName
                        }</div>
                        <div class="vehicleRef">Vehicle Reference: ${
                          vehicle.MonitoredVehicleJourney.VehicleRef
                        }</div>
                        <div class="vehicleRef">Destination: ${
                          vehicle.MonitoredVehicleJourney.DestinationName
                        }</div>
                        <div class="vehicleRef">Origin: ${
                          vehicle.MonitoredVehicleJourney.OriginName
                        }</div>
                        <div class="vehicleRef">Direction: ${
                          vehicle.MonitoredVehicleJourney.DirectionRef
                        }</div>
                        <div class="vehicleRef">Bearing: ${
                          vehicle.MonitoredVehicleJourney.Bearing
                        }</div>
                        <div class="vehicleRef">Recorded: ${APP_CONSTANTS.shortEnGBFormatter.format(
                          new Date(vehicle.RecordedAtTime)
                        )}</div>
                                    <div class="ui icon buttons" style="display: unset">
                    <div class="ui route-link mini button" data='${JSON.stringify(
                      searchCriteria
                    )}'><i class="bus icon"></i></div>
                    <div class="ui favourite-link mini button" data='${
                      vehicle.MonitoredVehicleJourney.VehicleRef
                    }'><i class="heart outline icon"></i></div>
                    <div class="ui track-link mini button" data='${
                      vehicle.MonitoredVehicleJourney.VehicleRef
                    }'><i class="eye icon"></i></div>
                </div>
                    </div>            
                </div>
            </div>
            `;

      const detail = document.createElement("div");
      detail.className = "bt info-anchor";
      detail.innerHTML = content;

      marker.addListener("click", (e) => {
        // add markers for detail...
        if (info) {
          info.setMap(null);
          info = null;
        }
        info = new google.maps.marker.AdvancedMarkerElement({
          map: thisObj.map,
          position: position,
          content: detail,
        });

        info.zIndex = 1;

        // Need this empty handler to enable events DOM events to function (no idea why)...
        info.addListener("click", (e) => {});

        $(info.element)
          .on("click", ".route-link", (e) => {
            $(document).trigger(
              "search-route",
              JSON.parse(e.currentTarget.attributes.data.value)
            );
          })
          .on("click", ".favourite-link", (e) => {
            $(document).trigger(
              "add-favourite",
              e.currentTarget.attributes.data.value
            );
          })
          .on("click", ".track-link", (e) => {
            $(document).trigger(
              "track-vehicle",
              e.currentTarget.attributes.data.value
            );
          })
          .on("click", (e) => {
            info.setMap(null);
          });

        thisObj.markers.push(info);
      });

      //Add marker to tracking array (for use in removing them)...
      thisObj.markers.push(marker);
    });
  },
  addStops: async function (stops) {
    null;
  },
  addTrackedVehicle: async function (vehicle) {
    // do not add a marker if has not moved...
    if (this.markers.length > 0) {
      if (
        JSON.stringify(
          this.markers[this.markers.length - 1].vehicle.MonitoredVehicleJourney
            .VehicleLocation
        ) === JSON.stringify(vehicle.MonitoredVehicleJourney.VehicleLocation)
      ) {
        return;
      }
    }

    const position = {
      lat: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Latitude),
      lng: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Longitude),
    };

    const timeTag = document.createElement("div");
    timeTag.className = "bt time-anchor";
    timeTag.innerHTML = `<div class="bt time">${APP_CONSTANTS.timeENGFormatter.format(
      new Date(vehicle.RecordedAtTime)
    )}</div>`;

    // add markers for timeTag...
    let marker = new google.maps.marker.AdvancedMarkerElement({
      map: this.map,
      position: position,
      content: timeTag,
      title:
        vehicle.MonitoredVehicleJourney.VehicleRef +
        "-" +
        vehicle.MonitoredVehicleJourney.DestinationName,
    });

    marker.vehicle = vehicle;
    marker.position = position;

    //Add marker to tracking array (for use in removing them)...
    this.markers.push(marker);

    // Draw a polyline between the last timeTag and the latest...
    if (this.markers.length > 1) {
      const lineSymbol = {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      };

      let prevPoint = {
        timestamp: this.markers[this.markers.length - 2].vehicle.RecordedAtTime,
        lat: Number(
          this.markers[this.markers.length - 2].vehicle.MonitoredVehicleJourney
            .VehicleLocation.Latitude
        ),
        lng: Number(
          this.markers[this.markers.length - 2].vehicle.MonitoredVehicleJourney
            .VehicleLocation.Longitude
        ),
      };

      let currentPoint = {
        timestamp: this.markers[this.markers.length - 1].vehicle.RecordedAtTime,
        lat: Number(
          this.markers[this.markers.length - 1].vehicle.MonitoredVehicleJourney
            .VehicleLocation.Latitude
        ),
        lng: Number(
          this.markers[this.markers.length - 1].vehicle.MonitoredVehicleJourney
            .VehicleLocation.Longitude
        ),
      };

      const velocity = appUtils.velocityBetweenPoints(prevPoint, currentPoint);

      const path = new google.maps.Polyline({
        path: [prevPoint, currentPoint],
        geodesic: true,
        strokeColor: window
          .getComputedStyle(document.body)
          .getPropertyValue("--tracker-line-colour"),
        strokeWeight: window
          .getComputedStyle(document.body)
          .getPropertyValue("--tracker-line-weight"),
        strokeOpacity: window
          .getComputedStyle(document.body)
          .getPropertyValue("--tracker-line-opacity"),
        icons: [
          {
            icon: lineSymbol,
            offset: "65%",
          },
        ],
        map: this.map,
      });

      let speedMarkerPos = {
        lat: prevPoint.lat + (currentPoint.lat - prevPoint.lat) / 2,
        lng: prevPoint.lng + (currentPoint.lng - prevPoint.lng) / 2,
      };
      const speedTag = document.createElement("div");
      speedTag.className = "bt speed-anchor";
      speedTag.innerHTML = `<div class="bt speed">${Math.floor(
        velocity.speedMph
      ).toString()} mph</div>`;

      let speedMarker = new google.maps.marker.AdvancedMarkerElement({
        map: this.map,
        position: speedMarkerPos,
        content: speedTag,
        title: "Point to point speed",
      });

      // add path to array of paths (for use in removing them)...
      this.paths.push(path);
      this.speedMarkers.push(speedMarker);
    }

    // get the last 3 points, to use as the mapBounds limit...
    //const markerBounds = this.markers.filter((el, i, arr) => (i > arr.length - 4 ? el : false));
    //const mapBounds = new google.maps.LatLngBounds();
    //markerBounds.forEach((m) => {
    //    mapBounds.extend(m.position);
    //});
    //this.map.fitBounds(mapBounds);

    this.flyTo(
      position,
      this.markers.length > 1 ? this.getZoom() : APP_CONSTANTS.defaultZoom
    );
  },
  fitAllVehicles: function () {
    const mapBounds = new google.maps.LatLngBounds();
    this.markers.forEach((m) => {
      mapBounds.extend(m.position);
    });
    this.map.fitBounds(mapBounds);
  },
  getCenter: function () {
    appUtils.log("getCenter");
    const centre = this.map.getCenter();
    return {
      lat: centre.lat(),
      lng: centre.lng(),
    };
  },
  getZoom: function () {
    return this.map.getZoom();
  },
  getBounds: function () {
    const bounds = this.map.getBounds();
    return {
      ...bounds,
      north: bounds.getNorthEast().lat(),
      east: bounds.getNorthEast().lng(),
      south: bounds.getSouthWest().lat(),
      west: bounds.getSouthWest().lng(),
    };
  },
  flyTo: function (center, zoom = APP_CONSTANTS.defaultZoom) {
    this.props.center = center;
    this.props.zoom = zoom;

    this.map.panTo(this.props.center);
    this.map.setZoom(this.props.zoom);
  },
};
