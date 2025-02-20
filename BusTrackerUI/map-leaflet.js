import { appConstant } from "./globals.js";
import { appUtils } from "./utils.js";
import { BusStop } from "./busStop.js";

export let mapObj = {
    mapElement: null,
    map: null,
    markerMe: null,
    busLayerGroup: null,
    stopLayerGroup: null,
    trackerLayerGroup: null,
    annotationLayerGroup: null,
    arrrivalPopups: [],
    accuracyCircle: null,
    currentViewMode: appConstant.viewMode.search, // default initial mode...
    loading: true,
    props: {
        zoom: appConstant.defaultZoom,
        center: {
            lat: 54.87676318480376,
            lng: -3.1485196166071217
        },
        zoomControl: false,
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false,
        minZoom: 6,
        maxZoom: 17,
        maxBounds: 
        [
                [appConstant.mapBounds.north, appConstant.mapBounds.west],
                [appConstant.mapBounds.south, appConstant.mapBounds.east]
        ],
    },
    initiate: async function (session) {

        appUtils.log('mapObj.initiate - start');

        this.session = session;

        await appUtils.loadResource('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
        await appUtils.loadResource('https://unpkg.com/leaflet-polylinedecorator@1.6.0/dist/leaflet.polylineDecorator.js');
        await appUtils.loadResource('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');

        appUtils.log('mapObj.initiate - end');
    },
    create: async function (mapID, center) {

        appUtils.log('mapObj.create - start');

        const thisObj = this;

        this.mapElement = document.getElementById(mapID);

        this.props = {
            ...this.props,
            center: center,
        };

        // initialize Leaflet
        this.map = L.map(mapID, this.props);

        // add the OpenStreetMap tiles
        L.tileLayer('https://tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey={apikey}',
            {
            attribution: '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            apikey: this.session.thunderforestMapKey,
            maxZoom: 22
            })
            .addTo(this.map);

        //L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        //    {
        //        maxZoom: 19,
        //        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        //    })
        //    .addTo(this.map);

        //L.tileLayer('https://localhost:8443/map/{z}/{x}/{y}.png?apikey={apikey}',
        //    {
        //        maxZoom: 19,
        //        apikey: this.session.busTrackerMapKey,
        //        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        //    })
        //    .addTo(this.map);

        L.control.zoom(
            {
                position: 'bottomright'
            })
            .addTo(this.map);

        // show the scale bar on the lower left corner
        L.control.scale(
            {
                imperial: true,
                metric: true
            })
            .addTo(this.map);

        this.stopLayerGroup = L.layerGroup()
            .addTo(this.map);

        this.busLayerGroup = L.layerGroup()
            .addTo(this.map);

        this.trackerLayerGroup = L.layerGroup()
            .addTo(this.map);

        this.annotationLayerGroup = L.layerGroup()
            .addTo(this.map);

        // create event listeners...
        //this.map.on('click', (e) => {
        //    L.popup(e.latlng, {
        //        content: `You clicked the map at ${e.latlng.toString()}`
        //    })
        //        .openOn(mapObj.map);
        //});   

        // on moveend trigger a map-move event on the map object...
        this.map.on('moveend', function (e) {
                if (thisObj.currentViewMode == appConstant.viewMode.search) {
                    $(document).trigger('map-move');
                }

            //L.DomEvent.preventDefault(e);
        });

        appUtils.log('mapObj.create - end');

        //this.map.whenReady(function (e) {
        //    if (thisObj.loading) {
        //        thisObj.loading = false;
        //        $(document).trigger('ready');
        //    }
        //});

        return this.map;
    },
    addCurrentLocation: function (currentLocation) {

        const toolTip = (currentLocation.position.accuracy > 10 ? `This is an estimate of your location within ${Math.floor(currentLocation.position.accuracy)} metres.` : "Your location.");
        const icon = new L.DivIcon({
            className: 'bt marker-me-anchor',
            iconSize: null,
            html: '<div class="bt marker-me"></div>',
        //    html: '<div class="bt marker-me"><i class="white crosshairs icon"></i></div>',
        });

        if (!this.markerMe) {
            this.markerMe = L.marker(currentLocation.center,
                {
                    interactive: false,
                })
                .setIcon(icon)
                .bindTooltip(toolTip)
                .addTo(this.map);
        } else {

            this.markerMe.setLatLng(currentLocation.center);
            this.markerMe.setTooltipContent(toolTip);
        }

        if (!this.accuracyCircle) {
            const color = appUtils.getCssVar('--app-color-2');
            this.accuracyCircle = L.circle(currentLocation.center,
                {
                    radius: currentLocation.position.accuracy,
                    className: 'bt accuracy-circle',
                    interactive: false,
                })
                .addTo(this.map);
        } else {
            this.accuracyCircle.setLatLng(currentLocation.center);
            this.accuracyCircle.setRadius(currentLocation.position.accuracy);  //metres..
        }
    },
    clear: function (all = false) {

        this.busLayerGroup.clearLayers();

        this.trackerLayerGroup.clearLayers();

        this.annotationLayerGroup.clearLayers();

        if (all) {
            this.clearStopMarkers;
        }

    },
    clearStopMarkers: function () {
        this.stopLayerGroup.clearLayers();
    },
    clearArrivalsPopup: function () {
        for (let i = 0; i < this.arrrivalPopups.length; i++) {
            this.arrrivalPopups[i].close();
            this.arrrivalPopups[i].remove();
        }
        this.arrrivalPopups = [];
    },
    addVehicles: async function (vehicles) {

        let info;

        // store this (mapObj) locally so it can be used in jQuery $.each call back...
        const thisObj = this;

        // add markers for each vehicle...
        $.each(vehicles, function (index, vehicle) {

            // A request from H...
            const favourite = (vehicle.extendedAttributes.favourite == true) ? 'favourite' : '';
            // aged infers recorded at time > 1 hour....
            const aged = (vehicle.extendedAttributes.aged == true) ? 'aged' : '';

            const searchCriteria = {
                lineRef: vehicle.MonitoredVehicleJourney.LineRef,
                operatorRef: vehicle.MonitoredVehicleJourney.OperatorRef,
                currentMapBounds: false,
                resizeAfterSearch: true,
            };

            const position = {
                lat: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Latitude),
                lng: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Longitude),
            }

            const icon = new L.DivIcon({
                className: 'bt marker-anchor',
                iconSize: null,
                html: `<div class="bt marker-vehicle ${(vehicles.length > appConstant.vehicleSmallThreshold) ? 'small' : ''} bus-direction-${vehicle.extendedAttributes.directionCode} ${ favourite} ${aged}" 
                style="--dir: ${Number(vehicle.MonitoredVehicleJourney.Bearing)}"
                title="${vehicle.MonitoredVehicleJourney.VehicleRef} (${vehicle.extendedAttributes.operatorName} - ${vehicle.MonitoredVehicleJourney.PublishedLineName})">
                    <div class="route">
                        ${appUtils.stringTrim(vehicle.MonitoredVehicleJourney.PublishedLineName, 3)}
                    </div>
                </div>`,
            });

            const marker = L.marker(position)
                .setIcon(icon)
                .addTo(thisObj.busLayerGroup);

            marker.vehicle = vehicle;
            marker.position = position;

            const content = `
            <div class="bt info">
                <div class="details">
                    <div class="route bus-direction-${vehicle.extendedAttributes.directionCode} ${favourite} ${aged}">
                        ${appUtils.stringTrim(vehicle.MonitoredVehicleJourney.PublishedLineName, 3)}
                    </div>
                    <div class="properties">
                        <div class="vehicleRef">Operator: ${vehicle.extendedAttributes.operatorName}</div>
                        <div class="vehicleRef">Vehicle Reference: ${vehicle.MonitoredVehicleJourney.VehicleRef}</div>
                        <div class="vehicleRef">Destination: ${vehicle.MonitoredVehicleJourney.DestinationName}</div>
                        <div class="vehicleRef">Origin: ${vehicle.MonitoredVehicleJourney.OriginName}</div>
                        <div class="vehicleRef">Direction: ${vehicle.MonitoredVehicleJourney.DirectionRef}</div>
                        <div class="vehicleRef">Bearing: ${vehicle.MonitoredVehicleJourney.Bearing}</div>
                        <div class="vehicleRef">Recorded: ${appConstant.shortEnGBFormatter.format(new Date(vehicle.RecordedAtTime))}</div>
                                    <div class="ui icon buttons" style="display: unset">
                    <div class="ui route-link mini button" data='${JSON.stringify(searchCriteria)}'><i class="bus icon"></i></div>
                    <div class="ui favourite-link mini button" data='${vehicle.MonitoredVehicleJourney.VehicleRef}'><i class="heart outline icon"></i></div>
                    <div class="ui track-link mini button" data='${vehicle.MonitoredVehicleJourney.VehicleRef}'><i class="eye icon"></i></div>
                </div>
                    </div>            
                </div>
            </div>
            `;

            // create event listeners...
            marker.on('click', (e) => {

                if (info) {
                    info.remove();
                    info = null;
                }

                const infoDetail = new L.DivIcon({
                    className: 'bt info-anchor',
                    iconSize: null,
                    html: content,
                });

                info = L.marker(position)
                    .setIcon(infoDetail)
                    .addTo(thisObj.busLayerGroup);

                info.on('click', (e) => {
                });

                $(info.getElement())
                    .on('click', '.route-link', (e) => {
                        $(document).trigger('search-route', JSON.parse(e.currentTarget.attributes.data.value));
                    })
                    .on('click', '.favourite-link', (e) => {
                        $(document).trigger('add-favourite', e.currentTarget.attributes.data.value);
                    })
                    .on('click', '.track-link', (e) => {
                        $(document).trigger('track-vehicle', e.currentTarget.attributes.data.value);
                    })
                    .on('click', (e) => {
                        info.remove();
                        info = null;
                        //e.preventDefault();
                        e.stopPropagation();
                    })
                    ;                
            });  
        });
    },
    addStops: function (stops) {

        this.clearStopMarkers();

        let info;

        // store this (mapObj) locally so it can be used in jQuery $.each call back...
        const thisObj = this;

        // add markers for each vehicle...
        $.each(stops, async function (index, stop) {

            const stopMarker = L.circle(stop.position,
                {
                    radius: 10,
                    stroke: true,
                    color: "#7a4bf1",
                    opacity: 0.8,
                    weight: 2,
                    fillColor: "#7a4bf1",
                    fillOpacity: 0.15,
                })
                .bindTooltip(`${stop.commonName}, ${stop.indicator}`)
                .addTo(thisObj.stopLayerGroup);

            stopMarker.on('click', async (e) => {
                // centre on clicked stop...
                thisObj.flyTo(this.position, thisObj.props.zoom);

                $(document).trigger('show-bus-stop-arrivals', stop);
            });

            // create event listeners...
        //    stopMarker.on('click', async (e) => {

        //        const popup = L.popup({
        //            interactive: true,
        //            closeOnClick: false,
        //            closeButton: false,
        //            className: 'bt arrival popup',
        //            minWidth: 200,
        //        })
        //            .setLatLng(stop.position);

        //        const busStop = new BusStop(stop);

        //        reloadContent(true);

        //        L.DomEvent.stopPropagation(e);

        //        async function reloadContent(firstTime = false) {

        //            if (firstTime || popup.isOpen()) {

        //                let arrivals = [];

        //                try {
        //                    arrivals = await busStop.arrivals();
        //                }
        //                catch {
        //                    null;
        //                }

        //                let content = `
        //                <div class="box">
        //                    <div class="row">
        //                        ${busStop.stop.standardIndicator ? `<div class="indicator" title='${busStop.stop.naptanId}'>${busStop.stop.standardIndicator}</div>` : ''}
        //                        <div class="destination">${busStop.stop.commonName}${!busStop.stop.standardIndicator ? ', ' + busStop.stop.indicator: ''}<br> </div>
        //                    </div>
        //                </div>`;
        //                if (arrivals.length > 0) {
        //                    content += `
        //                    <div class="row content">
        //                        <table class="ui very basic unstackable striped very compact table">
        //                            <thead>
        //                                <tr>
        //                                    <th class="center aligned one wide">Live</th>
        //                                    <th class="center aligned three wide">Mins</th>
        //                                    <th class="center aligned three wide">Route</th>
        //                                    <th class="four wide">Destination</th>
        //                                    <th class="one wide">Source</th>
        //                                </tr>
        //                            </thead>
        //                        <tbody>
        //                    </div>`;
        //                    arrivals.forEach((b, index) => {
        //                        content += `<tr>
        //                            <td class="center aligned one wide">${(b.liveData == true ? 'Live' : 'Schd.')}</td>
        //                            <td class="center aligned three wide">${(b.minutes < 1 ? 'Due' : b.minutes)}</td>
        //                            <td class="center aligned  three wide">${b.lineName}</td>
        //                            <td class="four wide">${b.destinationName}</td>
        //                            <td class="one wide">${b.src}</td>
        //                        </tr>`;
        //                    });
        //                    content += '</tbody></table>';
        //                }
        //                else {
        //                    content += `
        //                    <div class="row content" >
        //                        <div> Sorry, there is no arrival data available for this stop.</div>
        //                    </div>`;
        //                }

        //                content += `
        //                </div>`;

        //                if (busStop.stop.atcoAreaCode == '490') {
        //                    content += `
        //                    <div class="row right">
        //                        <div><a href="https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service" target="_blank">Powered by TfL Open Data</a></div>
        //                    </div>`;
        //                }

        //                popup.setContent(content);

        //                if (firstTime) {
        //                    popup
        //                        .openOn(thisObj.map);
        //                    // need to use this to create a click listener on the popup...
        //                    L.DomEvent.addListener(popup.getElement(), 'click', (e) => {
        //                        if (e.target.tagName != 'A') {
        //                            popup.close();
        //                        }
        //                    });

        //                    thisObj.arrrivalPopups.push(popup);
        //                }

        //                // automated refresh....
        //                setTimeout(reloadContent, appConstant.refreshStopArrivalsSecs * 1000);
        //            }
        //        }

        //    });
        });
    },
    addTrackedVehicle: async function (vehicle) {

        // do not add a marker if has not moved...
        const trackerMarkers = this.trackerLayerGroup.getLayers();
        if (trackerMarkers.length > 0) {
            if (JSON.stringify(trackerMarkers[trackerMarkers.length - 1].vehicle.MonitoredVehicleJourney.VehicleLocation) === JSON.stringify(vehicle.MonitoredVehicleJourney.VehicleLocation)) {
                return;
            }
        }

        const position = {
            lat: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Latitude),
            lng: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Longitude)
        };

        const timeTag = new L.DivIcon({
            className: 'bt time-anchor',
            iconSize: null,
            html: `<div class="bt time">${appConstant.timeENGFormatter.format(new Date(vehicle.RecordedAtTime))}</div>`,
        });

        const marker = L.marker(position, {
            title: vehicle.MonitoredVehicleJourney.VehicleRef + '-' + vehicle.MonitoredVehicleJourney.DestinationName,
        })
            .setIcon(timeTag)
            .addTo(this.trackerLayerGroup);

        marker.vehicle = vehicle;
        marker.position = position;

        // Draw a polyline between the last timeTag and the latest...
        if (trackerMarkers.length > 0) {

            let prevPoint =
            {
                timestamp: trackerMarkers[trackerMarkers.length - 1].vehicle.RecordedAtTime,
                lat: Number(trackerMarkers[trackerMarkers.length - 1].vehicle.MonitoredVehicleJourney.VehicleLocation.Latitude),
                lng: Number(trackerMarkers[trackerMarkers.length - 1].vehicle.MonitoredVehicleJourney.VehicleLocation.Longitude)
            };

            let currentPoint = {
                timestamp: vehicle.RecordedAtTime,
                lat: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Latitude),
                lng: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Longitude)
            };

            // Connecting line and arrow...
            const polyline = L.polyline([
                prevPoint,
                currentPoint
            ],
                {
                    className: 'bt line',
                })
                .addTo(this.annotationLayerGroup);

            const polylineDecorator = L.polylineDecorator(polyline, {
                patterns: [{
                    offset: '65%',
                    repeat: 0,
                    symbol: L.Symbol.arrowHead({
                        pixelSize: 10,
                        pathOptions: {
                            className: 'bt line',
                        }
                    })
                }]
            }).addTo(this.annotationLayerGroup);

            // Speed marker...
            const velocity = appUtils.velocityBetweenPoints(prevPoint, currentPoint);

            let speedMarkerPos = {
                lat: prevPoint.lat + ((currentPoint.lat - prevPoint.lat) / 2),
                lng: prevPoint.lng + ((currentPoint.lng - prevPoint.lng) / 2)
            };

            const speedTag = new L.DivIcon({
                className: 'bt speed-anchor',
                iconSize: null,
                html: `<div class="bt speed">${Math.floor(velocity.speedMph).toString()} mph</div>`,
            });

            const speedMarker = L.marker(speedMarkerPos, {
                title: 'Point to point speed',
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

        this.map.flyTo(position, (trackerMarkers.length > 1) ? this.getZoom() : appConstant.defaultZoom);

    },
    fitAllVehicles: async function () {

        const mapBounds = new L.LatLngBounds();
        this.busLayerGroup.eachLayer((m) => {
            mapBounds.extend(m.position);
        });

        this.map.flyToBounds(mapBounds, { duration: 3 });
    },
    getCenter: function () {
        return this.map.getCenter();
    },
    //setCenter: function (latLng) {
    //    this.map.panTo(latLng);
    //},
    getZoom: function () {
        return this.map.getZoom();
    },
    getBounds: function () {
        const bounds = this.map.getBounds();
        return {
            ...bounds,
            north: bounds.getNorth(),
            east: bounds.getEast(),
            south: bounds.getSouth(),
            west: bounds.getWest(),
        };            
    },
    flyTo: function (center, zoom = appConstant.defaultZoom) {

        this.props.center = center;
        this.props.zoom = zoom;

        this.map.flyTo(this.props.center, this.props.zoom, { duration: 1 });
    }
}
