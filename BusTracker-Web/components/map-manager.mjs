import { APP_CONSTANTS } from "@components/app-constants.mjs";
import { appUtils } from "@components/app-utils.mjs";
import L from "leaflet";
import "leaflet-polylinedecorator";
import "leaflet/dist/leaflet.css";

export class MapManager {
  constructor() {
    // Instance properties
    this.mapElement = null;
    this.map = null;
    this.markerMe = null;
    this.busLayerGroup = null;
    this.stopLayerGroup = null;
    this.trackerLayerGroup = null;
    this.annotationLayerGroup = null;
    this.arrrivalPopups = [];
    this.accuracyCircle = null;
    this.currentViewMode = APP_CONSTANTS.viewMode.search;
    this.loading = true;

    this.props = {
      zoom: APP_CONSTANTS.defaultZoom,
      center: { lat: 54.87676318480376, lng: -3.1485196166071217 },
      zoomControl: false,
      mapTypeControl: false,
      scaleControl: false,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: false,
      minZoom: 6,
      maxZoom: 17,
      maxBounds: [
        [APP_CONSTANTS.mapBounds.north, APP_CONSTANTS.mapBounds.west],
        [APP_CONSTANTS.mapBounds.south, APP_CONSTANTS.mapBounds.east],
      ],
    };
  }

  async initiate(config) {
    this.config = config;
  }

  async create(mapID, center) {
    appUtils.log("MapManager.create - start");

    this.mapElement = document.getElementById(mapID);
    this.props = { ...this.props, center };

    // Initialize Leaflet
    this.map = L.map(mapID, this.props);

    // Add tiles
    L.tileLayer(
      "https://tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey={apikey}",
      {
        attribution:
          '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        apikey: this.config.thunderforestMapKey,
        maxZoom: 22,
      }
    ).addTo(this.map);

    L.control.zoom({ position: "bottomright" }).addTo(this.map);
    L.control.scale({ imperial: true, metric: true }).addTo(this.map);

    this.stopLayerGroup = L.layerGroup().addTo(this.map);
    this.busLayerGroup = L.layerGroup().addTo(this.map);
    this.trackerLayerGroup = L.layerGroup().addTo(this.map);
    this.annotationLayerGroup = L.layerGroup().addTo(this.map);

    this.map.on("moveend", (e) => {
      if (this.currentViewMode === APP_CONSTANTS.viewMode.search) {
        $(document).trigger("map-move");
      }
    });

    appUtils.log("MapManager.create - end");

    return this.map;
  }

  addCurrentLocation(currentLocation) {
    const toolTip =
      currentLocation.position.accuracy > 10
        ? `This is an estimate of your location within ${Math.floor(
            currentLocation.position.accuracy
          )} metres.`
        : "Your location.";

    const icon = new L.DivIcon({
      className: "marker-me-anchor",
      iconSize: null,
      html: '<div class="marker-me"></div>',
    });

    if (!this.markerMe) {
      this.markerMe = L.marker(currentLocation.center, { interactive: false })
        .setIcon(icon)
        .bindTooltip(toolTip)
        .addTo(this.map);
    } else {
      this.markerMe.setLatLng(currentLocation.center);
      this.markerMe.setTooltipContent(toolTip);
    }

    if (!this.accuracyCircle) {
      const color = appUtils.getCssVar("--app-color-2");
      this.accuracyCircle = L.circle(currentLocation.center, {
        radius: currentLocation.position.accuracy,
        className: "accuracy-circle",
        interactive: false,
      }).addTo(this.map);
    } else {
      this.accuracyCircle.setLatLng(currentLocation.center);
      this.accuracyCircle.setRadius(currentLocation.position.accuracy);
    }
  }

  clear(all = false) {
    this.busLayerGroup.clearLayers();
    this.trackerLayerGroup.clearLayers();
    this.annotationLayerGroup.clearLayers();
    if (all) this.clearStopMarkers();
  }

  clearStopMarkers() {
    this.stopLayerGroup.clearLayers();
  }

  clearArrivalsPopup() {
    for (const popup of this.arrrivalPopups) {
      popup.close();
      popup.remove();
    }
    this.arrrivalPopups = [];
  }

  async addVehicles(vehicles) {
    let info;

    // add markers for each vehicle...
    vehicles.forEach(async (vehicle, index) => {
      // A request from H...
      const favourite =
        vehicle.extendedAttributes.favourite == true ? "favourite" : "";
      // aged infers recorded at time > 1 hour....
      const aged = vehicle.aged == true ? "aged" : "";

      const searchCriteria = {
        lineRef: vehicle.lineRef, // vehicle.MonitoredVehicleJourney.LineRef,
        operatorRef: vehicle.operatorRef, // vehicle.MonitoredVehicleJourney.OperatorRef,
        currentMapBounds: false,
        resizeAfterSearch: true,
      };

      const position = {
        lat: Number(vehicle.latitude),
        lng: Number(vehicle.longitude),
      };

      const icon = new L.DivIcon({
        className: "marker-anchor",
        iconSize: null,
        html: `<div class="marker-vehicle ${
          vehicles.length > APP_CONSTANTS.vehicleSmallThreshold ? "small" : ""
        } bus-direction-${vehicle.directionCode} ${favourite} ${aged}"
                style="--dir: ${Number(vehicle.bearing)}"
                title="${vehicle.vehicleRef} (${
          vehicle.extendedAttributes.operatorName
        } - ${vehicle.publishedLineName})">
                    <div class="route">
                        ${appUtils.stringTrim(vehicle.publishedLineName, 3)}
                    </div>
                </div>`,
      });

      const marker = L.marker(position).setIcon(icon).addTo(this.busLayerGroup);

      marker.vehicle = vehicle;
      marker.position = position;

      const content = `
            <div class="info">
                <div class="details">
                    <div class="route bus-direction-${
                      vehicle.directionCode
                    } ${favourite} ${aged}">
                        ${appUtils.stringTrim(vehicle.publishedLineName, 3)}
                    </div>
                    <div class="properties">
                        <div class="vehicleRef">Operator: ${
                          vehicle.operatorName
                        }</div>
                        <div class="vehicleRef">Vehicle Reference: ${
                          vehicle.vehicleRef
                        }</div>
                        <div class="vehicleRef">Destination: ${
                          vehicle.destinationName
                        }</div>
                        <div class="vehicleRef">Origin: ${
                          vehicle.originName
                        }</div>
                        <div class="vehicleRef">Direction: ${
                          vehicle.directionRef
                        }</div>
                        <div class="vehicleRef">Bearing: ${
                          vehicle.bearing
                        }</div>
                        <div class="vehicleRef">Recorded: ${APP_CONSTANTS.shortEnGBFormatter.format(
                          new Date(vehicle.timestamp)
                        )}</div>
                                    <div class="ui icon buttons" style="display: unset">
                    <div class="ui route-link mini button" data='${JSON.stringify(
                      searchCriteria
                    )}'><i class="bus icon"></i></div>
                    <div class="ui favourite-link mini button" data='${
                      vehicle.vehicleRef
                    }'><i class="heart outline icon"></i></div>
                    <div class="ui track-link mini button" data='${
                      vehicle.vehicleRef
                    }'><i class="eye icon"></i></div>
                </div>
                    </div>
                </div>
            </div>
            `;

      // create event listeners...
      marker.on("click", (e) => {
        if (info) {
          info.remove();
          info = null;
        }

        const infoDetail = new L.DivIcon({
          className: "info-anchor",
          iconSize: null,
          html: content,
        });

        info = L.marker(position).setIcon(infoDetail).addTo(this.busLayerGroup);

        info.on("click", (e) => {});

        $(info.getElement())
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
            info.remove();
            info = null;
            //e.preventDefault();
            e.stopPropagation();
          });
      });
    });
  }

  addStops(stops) {
    this.clearStopMarkers();

    let info;

    // add markers for each vehicle...
    stops.forEach(async (stop, index) => {
      const stopMarker = L.circle(stop.position, {
        radius: 10,
        stroke: true,
        color: "#7a4bf1",
        opacity: 0.8,
        weight: 2,
        fillColor: "#7a4bf1",
        fillOpacity: 0.15,
      })
        .bindTooltip(`${stop.commonName}, ${stop.indicator}`)
        .addTo(this.stopLayerGroup);

      stopMarker.on("click", async (e) => {
        this.flyTo(stop.position, this.props.zoom);
        $(document).trigger("show-bus-stop-arrivals", stop);
      });
    });
  }

  async addTrackedVehicle(vehicle) {
    const position = {
      lat: Number(vehicle.latitude),
      lng: Number(vehicle.longitude),
    };

    // do not add a marker if has not moved...
    const trackerMarkers = this.trackerLayerGroup.getLayers();
    if (trackerMarkers.length > 0) {
      if (
        JSON.stringify(trackerMarkers[trackerMarkers.length - 1].position) ===
        JSON.stringify(position)
      ) {
        return;
      }
    }

    const timeTag = new L.DivIcon({
      className: "time-anchor",
      iconSize: null,
      html: `<div class="time">${APP_CONSTANTS.timeENGFormatter.format(
        new Date(vehicle.timestamp)
      )}</div>`,
    });

    const marker = L.marker(position, {
      title: vehicle.vehicleRef + "-" + vehicle.destinationName,
    })
      .setIcon(timeTag)
      .addTo(this.trackerLayerGroup);

    marker.vehicle = vehicle;
    marker.position = position;

    // Draw a polyline between the last timeTag and the latest...
    if (trackerMarkers.length > 0) {
      let prevPoint = {
        timestamp: trackerMarkers[trackerMarkers.length - 1].vehicle.timestamp,
        lat: Number(trackerMarkers[trackerMarkers.length - 1].vehicle.latitude),
        lng: Number(
          trackerMarkers[trackerMarkers.length - 1].vehicle.longitude
        ),
      };

      let currentPoint = {
        timestamp: vehicle.timestamp,
        lat: Number(vehicle.latitude),
        lng: Number(vehicle.longitude),
      };

      // Connecting line and arrow...
      const polyline = L.polyline([prevPoint, currentPoint], {
        className: "line",
      }).addTo(this.annotationLayerGroup);

      const polylineDecorator = L.polylineDecorator(polyline, {
        patterns: [
          {
            offset: "65%",
            repeat: 0,
            symbol: L.Symbol.arrowHead({
              pixelSize: 10,
              pathOptions: {
                className: "line",
              },
            }),
          },
        ],
      }).addTo(this.annotationLayerGroup);

      // Speed marker...
      const velocity = appUtils.velocityBetweenPoints(prevPoint, currentPoint);

      let speedMarkerPos = {
        lat: prevPoint.lat + (currentPoint.lat - prevPoint.lat) / 2,
        lng: prevPoint.lng + (currentPoint.lng - prevPoint.lng) / 2,
      };

      const speedTag = new L.DivIcon({
        className: "speed-anchor",
        iconSize: null,
        html: `<div class="speed">${Math.floor(
          velocity.speedMph
        ).toString()} mph</div>`,
      });

      const speedMarker = L.marker(speedMarkerPos, {
        title: "Point to point speed",
      })
        .setIcon(speedTag)
        .addTo(this.annotationLayerGroup);
    }

    // get the last 3 points, to use as the mapBounds limit...
    //const markerBounds = this.markers.filter((el, i, arr) => (i > arr.length - 4 ? el : false));
    //const mapBounds = new L.LatLngBounds();
    //markerBounds.forEach((m) => {
    //    mapBounds.extend(m.position);
    //});
    //this.map.flyToBounds(mapBounds, { duration: 1 });

    this.map.flyTo(
      position,
      trackerMarkers.length > 1 ? this.getZoom() : APP_CONSTANTS.defaultZoom
    );
  }

  async fitAllVehicles() {
    const mapBounds = new L.LatLngBounds();
    this.busLayerGroup.eachLayer((m) => {
      mapBounds.extend(m.position);
    });

    this.map.flyToBounds(mapBounds, { duration: 3 });
  }

  getCenter() {
    return this.map.getCenter();
  }

  getZoom() {
    return this.map.getZoom();
  }

  getBounds() {
    const bounds = this.map.getBounds();
    return {
      ...bounds,
      north: bounds.getNorth(),
      east: bounds.getEast(),
      south: bounds.getSouth(),
      west: bounds.getWest(),
    };
  }

  flyTo(center, zoom = APP_CONSTANTS.defaultZoom) {
    this.props.center = center;
    this.props.zoom = zoom;
    this.map.flyTo(this.props.center, this.props.zoom, { duration: 1 });
  }
}

// Export singleton instance
export const mapManager = new MapManager();
