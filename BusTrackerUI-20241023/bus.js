import { log, appConstant, queryStringToJSON } from "./globals.js";
import { operatorRoutes } from "./operator-routes.js";
import { searchHistory } from "./search-history.js";
import { userOptions } from "./user-options.js";
import { session } from "./session.js";
import { Ident } from "./ident.js";


const defaultZoom = 6;

const mapProps = {
    zoom: defaultZoom,
    center: {
        lat: 54.87676318480376,
        lng: -3.1485196166071217
    },
    mapId: "DEMO_MAP_ID",
    zoomControl: true,
    mapTypeControl: false,
    scaleControl: true,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: false,
};

let vehicles = [];
const defaultSearchCriteria = {
    lineRef: null,
    operatorRef: null,
    showAll: true,
    initialRender: false,
    lat: null,
    lng: null,
    zoom: defaultZoom
};
let searchCriteria;
let markers = [];
let paths = [];
let speedMarkers = []
let map, trackerInfoWindow;
let extendedAttributes;

var boundingBox = {
    north: null,
    south: null,
    east: null,
    west: null
};
let mapBoundingBox;
let accuracyCircle;
let busTracker;
let refreshTimer;

let currentViewMode;
let currentLocation = {
    get: async function get() {

        try {
            const position = await getGeoLocation();
            currentLocation = {
                ...currentLocation,
                position: position,
                canTrack: !(position.code == 1)
            };
            return position;
        } catch (err) {
            log(err.message);
            currentLocation = {
                ...currentLocation,
                canTrack: false
            };
            return err;
        }

        function getGeoLocation() {
            return new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    position => resolve(position.coords),
                    error => reject(error)
                )
            });
        }
    },
    add: async function add() {

        await currentLocation.get();
        if (!(currentLocation.canTrack)) return false;

        // Request needed libraries.
        const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker",);
        const meSmallTag = document.createElement("div");
        meSmallTag.className = "location-small-tag";
        meSmallTag.innerHTML = `<i class="white crosshairs icon"></i>`;

        // add markers for current location...
        const markerMe = new google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: {
                lat: currentLocation.position.latitude,
                lng: currentLocation.position.longitude,
            },
            content: meSmallTag,
            title: (currentLocation.accuracy > 10 ? `This is an estimate of your location within ${Math.floor(currentLocation.accuracy)} metres.` : "Your location.")
        });
        markerMe.content.style.transform = 'translateY(50%)';

        const accuracyCircle = new google.maps.Circle({
            strokeColor: "#8160d4",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#8160d4",
            fillOpacity: 0.05,
            map: map,
            center: {
                lat: currentLocation.position.latitude,
                lng: currentLocation.position.longitude,
            },
            radius: currentLocation.position.accuracy,  //metres..
        });

        currentLocation = {
            ...currentLocation,
            markerMe: markerMe,
            accuracyCircle: accuracyCircle 
        };

        setTimeout(currentLocation.update, 5 * 1000);

        return markerMe;
    },
    update: async function move() {

        await currentLocation.get();
        if (!(currentLocation.canTrack)) return false;
        
        currentLocation.markerMe.position = {
            lat: currentLocation.position.latitude,
            lng: currentLocation.position.longitude,
        };

        // important to ensure the marker is anchored on centre....
        currentLocation.markerMe.content.style.transform = 'translateY(50%)';

        currentLocation.accuracyCircle.setCenter({
            lat: currentLocation.position.latitude,
            lng: currentLocation.position.longitude,
        });
        currentLocation.accuracyCircle.setRadius(currentLocation.position.accuracy);  //metres..

        //console.info('Current Location', currentLocation);
        setTimeout(currentLocation.update, 5 * 1000);
    },
}

// Document Ready function...
$(() => {
    // asynch call to initiate page...
    initiate();

});

async function initiate() {

    const ident = new Ident();

    $('.page.dimmer.ident .ident').append(ident.content);
    $('.page.dimmer.ident')
        .dimmer({
            closable: false,
        })
        .dimmer('show');

    const startTime = new Date();
    log(`initiate: start`);

    // Initiate service worker...
    if (!navigator.serviceWorker.controller) {
        navigator.serviceWorker.register("/sw.js").then(function (reg) {
            log("Service worker has been registered for scope: " + reg.scope);
        });
    }

    try {

        await session.init();

        await Promise.all([
            initiateMapApi(),
            operatorRoutes.get(),
            userOptions.init()
        ]);

        await initView();

        // initialise the searchCriteria (base from defaults, plus query string, if provided)...
        if (location.search) {

            searchCriteria =
            {
                ...defaultSearchCriteria,
                ...queryStringToJSON(location.search)
            }

            // initiate search on search criteria...
            $('.bt-menu-btn.refresh').trigger('click');

        } else {

            searchCriteria =
            {
                ...defaultSearchCriteria
            }

            // initiate search on all buses about current position...
            $('.bt-menu-btn.here').trigger('click');

        }
        console.log(searchCriteria);

        const endTime = new Date();
        log(`initiate: complete after ${(endTime - startTime) / 1000}secs`);

    } catch (error) {
        log(`Error initiating: ${error.message}`);
        alert(`Error initiating: ${error.message}`);
        window.location.href = "offline.html";
    } finally {

        $('.page.dimmer.ident')
            .dimmer('hide')
            .dimmer('destroy');

        // session start message, this value is set in the services config...
        if (session.startMessage != null)
            displaySystemMessage(session.startMessage);
    }
}
async function initiateMapApi() {

    try {
        (g => {
            var h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window;
            b = b[c] || (b[c] = {}); var d = b.maps || (b.maps = {}), r = new Set, e = new URLSearchParams, u = () => h || (h = new Promise(async (f, n) => { await (a = m.createElement("script")); e.set("libraries", [...r] + ""); for (k in g) e.set(k.replace(/[A-Z]/g, t => "_" + t[0].toLowerCase()), g[k]); e.set("callback", c + ".maps." + q); a.src = `https://maps.${c}apis.com/maps/api/js?` + e; d[q] = f; a.onerror = () => h = n(Error(p + " could not load.")); a.nonce = m.querySelector("script[nonce]")?.nonce || ""; m.head.append(a) })); d[l] ? console.warn(p + " only loads once. Ignoring:", g) : d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n))
        })
            ({ key: session.googleMapKey, v: "weekly" });

        return true;

    } catch (err) {
        return false;
    }
}
async function initView() { 

    // Set environment glyph..
    $('.env-glyph').addClass(appConstant.envMap[session.environment] || appConstant.envMap.Other);

    await initMap();

    // disable data dependent buttons...
    $('.dataDependent').addClass('disabled');

    $('#search')
        .search({
            source: operatorRoutes.flat,
            maxResults: 0,
            searchFields: ['title'],
            minCharacters: 2,
            selectFirstResult: true,
            fullTextSearch: 'all',
            showNoResults: true,
            onSelect: (result, response) => {
                searchCriteria = {
                    ...defaultSearchCriteria,
                    lineRef: result.lineRef,
                    operatorRef: result.operatorRef,
                    showAll: false,
                    initialRender: true,
                };
                getBuses();
            },
        })
        .on('click', '.clear', function (e) {
            let input = $(e.delegateTarget).find('input');
            let clearIcon = $(e.delegateTarget).find('i.clear');
            input.val('');
            input.focus();
            clearIcon.addClass('hidden');
            e.preventDefault();
        })
        .on('keyup', 'input', function (e) {
            let clearIcon = $(e.delegateTarget).find('i.clear');
            if ($(e.target).val() == '') {
                clearIcon.addClass('hidden');
            } else {
                clearIcon.removeClass('hidden');
            }
            e.preventDefault();
        });

    $('.ui.checkbox')
        .checkbox();

    $('.bt-menu-btn.here')
        .on('click', (e) => {
            let mapCentre = map.getCenter();
            searchCriteria = {
                ...defaultSearchCriteria,
                lat: mapCentre.lat(),
                lng: mapCentre.lng(),
                zoom: map.getZoom()
            };
            getBuses();
            e.preventDefault();
        });

    $('.bt-menu-btn.me')
        .on('click', async (e) => {
            await currentLocation.update();
            searchCriteria = {
                ...searchCriteria,
                lat: currentLocation.position.latitude,
                lng: currentLocation.position.longitude,
                zoom: appConstant.zoomLocation
            };
            getBuses();
            e.preventDefault();
        });

    $('.bt-menu-btn.main')
        .on('click', '#viewOptions', (e) => {

            $('#optFavouriteBus > input')
                .val(userOptions.favouriteBus);

            $('#optHideInactiveVehicles')
                .checkbox(`set ${userOptions.hideAged ? 'checked' : 'unchecked'}`);

            $('#optMaxMarkersToDisplay')
                .slider('set value', userOptions.maxMarkers, false);

            $('#optTrackerRefreshPeriod')
                .slider('set value', userOptions.refreshPeriod, false);

            $('#options')
                .modal({
                    closable: false,
                })
                .modal('show');
        })
        .on('click', '#viewData', (e) => {

            // need to show modal (and the table) before loading the table else columns are all over the place...
            $('#data')
                .modal({
                    closable: false,
                })
                .modal('show');

            $('#vehicles').DataTable()
                .clear()
                .rows.add(vehicles)
                .columns.adjust()
                .responsive.recalc()
                .draw()
                ;
        })
        .on('click', '#viewJson', (e) => {
            $('#json')
                .modal({
                    closable: false,
                })
                .modal('show');
        });

    $('.bt-menu-btn.refresh')
        .on('click', (e) => {
            getBuses();
            e.preventDefault();
        });

    // Share...
    $('.bt-menu-btn.share')
        .on('click', async (e) => {

            try {
                await navigator.share({ title: 'BusTracker', url: `${window.location.origin}?${$.param(searchCriteria)}`});
                console.log("Data was shared successfully");
            } catch (err) {
                console.error("Share failed:", err.message);
            }

            e.preventDefault();
        });

    $('#infoTracking')
        .on('click', (e) => {

            let v = $(e.currentTarget).data("vehicleActivity");
            let vehicleDetails =
            [
                {
                    title: "Operator",
                    data: v.extendedAttributes.operatorName,
                },
                {
                    title: "Route",
                    data: v.MonitoredVehicleJourney.PublishedLineName,
                },
                {
                    title: "Origin",
                    data: v.MonitoredVehicleJourney.OriginName,
                },
                {
                    title: "Aimed Origin Departure Time",
                    data: v.MonitoredVehicleJourney.OriginAimedDepartureTime,
                    formatter: (data) => {
                        return (data ? appConstant.shortEnGBFormatter.format(new Date(data)) : null);
                    },
                },
                {
                    title: "Destination",
                    data: v.MonitoredVehicleJourney.DestinationName,
                },
                {
                    title: "Aimed Destination Arrival Time",
                    data: v.MonitoredVehicleJourney.DestinationAimedArrivalTime,
                    formatter: (data) => {
                        return (data ? appConstant.shortEnGBFormatter.format(new Date(data)) : null);
                    },
                }
            ];

            let html = "";
            let stripe = true;
            vehicleDetails.forEach(v => {
                html = html + `<div class="${(stripe ? " stripe1 " : "")}row">`;
                html = html + `<div class="six wide label column">${v.title}</div>`;
                html = html + `<div class="ten wide column">${(!v.data ? "Not provided" : (v.formatter ? v.formatter(v.data) : v.data))}</div>`;
                html = html + `</div>`;
                stripe = !stripe;
            });

            $('#trackedBusInfo .content .grid').html(html);


            $('#trackedBusInfo').modal({
                title: 'Tracked Bus Information',
                class: 'tiny',
                closeIcon: true,
            }).modal('show');

            e.preventDefault();
        });

    $('#stopTracking')
        .on('click', (e) => {
            clearTimeout(busTracker);
            $('.bt-search').show();
            $('.bt-menu').show();
            $('.bt-track').hide();
            // enable data dependent buttons...
            $('.bt-menu-btn').removeClass('disabled');
            e.preventDefault();
        });

    // Create data table (will load later)...
    $('#vehicles')
        .DataTable({
            pageLength: 10,
            scrollX: true,
            scrollY: true,
            autowidth: false,
            createdRow: (row, data, dataIndex) => {
                $(row).addClass(`bus-direction-${data.extendedAttributes.directionCode}`);

                if (data.extendedAttributes.favourite)
                    $(row).addClass(`favourite`);
                if (data.extendedAttributes.aged)
                    $(row).addClass(`aged`);
            },
            columns: [
                {
                    title: 'Operator',
                    data: 'extendedAttributes.operatorName'
                },
                {
                    title: 'Vehicle Reference',
                    data: 'MonitoredVehicleJourney.VehicleRef'
                },
                {
                    title: 'Route',
                    data: 'MonitoredVehicleJourney.PublishedLineName'
                },
                {
                    title: 'Destination',
                    data: 'MonitoredVehicleJourney.DestinationName'
                },
                {
                    title: 'Origin',
                    data: 'MonitoredVehicleJourney.OriginName'
                },
                {
                    title: 'Direction',
                    data: 'MonitoredVehicleJourney.DirectionRef'
                },
                {
                    title: 'Bearing',
                    data: 'MonitoredVehicleJourney.Bearing',
                    render: function (data, type, row, meta) {
                        return (data ? data : 'Not available');
                    }
                },
                {
                    title: 'Longitude',
                    data: 'MonitoredVehicleJourney.VehicleLocation.Longitude',
                    render: function (data, type, row, meta) {
                        return (data ? data : 'Not available');
                    }
                },
                {
                    title: 'Latitude',
                    data: 'MonitoredVehicleJourney.VehicleLocation.Latitude',
                    render: function (data, type, row, meta) {
                        return (data ? data : 'Not available');
                    }
                },
                {
                    title: 'Recorded',
                    data: 'RecordedAtTime',
                    render: function (data, type, row, meta) {
                        return appConstant.shortEnGBFormatter.format(new Date(data));
                    }
                },
                {
                    title: 'Valid Until',
                    data: 'ValidUntilTime',
                    visible: false,
                    render: function (data, type, row, meta) {
                        return appConstant.shortEnGBFormatter.format(new Date(data));
                    }
                },
            ]
        });

    $('.screen-message')
        .on('click', '.link.options', (e) => {
            $('#viewOptions').trigger('click');
        });

    $('#optFavouriteBus')
        .on('blur', 'input', (e) => {
            userOptions.set('favouriteBus', $(e.currentTarget).val().toUpperCase());
        });

    $('#optHideInactiveVehicles')
        .checkbox({
            onChecked: (() => {
                userOptions.set('hideAged', true);
            }),
            onUnchecked: (() => {
                userOptions.set('hideAged', false);
            }),
        }); 

    $('#optMaxMarkersToDisplay')
        .slider({
            min: appConstant.minBusDisplay,
            max: appConstant.maxBusDisplay,
            step: ((appConstant.maxBusDisplay - appConstant.minBusDisplay) > 500 ? 100 : 50),
            onChange: (val => userOptions.set('maxMarkers', val)),
        });

    $('#optTrackerRefreshPeriod')
        .slider({
            min: 20,
            max: 40,
            step: 5,
            onChange: (val => userOptions.set('refreshPeriod', val)),
        });

    // Bind search button to form...
    $('#closeOptionsForm')
        .on('click', (e) => {
            $('#options').modal('hide');
        });
 
    // Clear search history...
    $('#clearSearchHistory')
        .on('click', (e) => {
            searchHistory.removeAll();
            e.preventDefault();
        });

    $('#searchHistory')
    .on('click', '.item', (e) => {
        searchCriteria = JSON.parse(e.currentTarget.attributes.data.value);

        // not ideal...
        let title = operatorRoutes.flat.find(e => (e.operatorRef == searchCriteria.operatorRef && e.lineRef == searchCriteria.lineRef)).title;
        $('#search').search('set value', title);

        getBuses();
        e.preventDefault();
    })
    .on('load', (e) => {
        const list = $(e.currentTarget);
        list.empty();

        let recentSearches = searchHistory.get();

        if (recentSearches.length > 0) {
            recentSearches.forEach(s => {
                list.append(`<div class="link item" data='${JSON.stringify(s)}'>${s.display}</div>`);
            });
        } else {
            list.append('<div >No previous searches</div>');
        }
        return true;
    });

    $('.menu .browse')
        .popup({
            inline: true,
            on: 'click',
            hoverable: true,
            position: 'bottom left',
            prefer: 'adjacent',
            delay: {
                show: 300,
                hide: 500
            },
            onShow: (e) => {
                // reload the search history of this is being called from viewSearches...
                if (e.id == 'viewSearches') {
                    $('#searchHistory').trigger('load');
                }
                return true;
            }
        }
    );

    // Map pop-up event handlers...
    $('#map')
        .on('click', '.route-link', e => {
            searchCriteria = JSON.parse(e.currentTarget.attributes.data.value);
            getBuses();
        })
        .on('click', '.track-link', e => {
            let vehicleRef = e.currentTarget.attributes.data.value;
            currentViewMode = appConstant.viewMode.track;
            trackBus(vehicleRef, true, 0);
        })
        .on('click', '.favourite-link', e => userOptions.set('favouriteBus', e.currentTarget.attributes.data.value)
        );
};

// overwrite the search logic to control the list order of matching operators and routes (need to also replicate the message function too, not sure why)...
$.fn.search.settings.templates = {
    message: function (message, type, header) {
        var
            html = ''
            ;
        if (message !== undefined && type !== undefined) {
            html += ''
                + '<div class="message ' + type + '">';
            if (header) {
                html += ''
                    + '<div class="header">' + header + '</div>';
            }
            html += ' <div class="description">' + message + '</div>';
            html += '</div>';
        }

        return html;
    },
    standard: function (response) {
        // Your own sorting logic here
        var sortedResults = response.results
            .sort((a, b) => {
                if (a.operatorName == b.operatorName) {
                    a.routePrefix = a.route.match(/^[A-Z]+/);
                    a.routeNumber = parseInt(a.route.replace(/^[A-Z]+/, '').replace(/[A-Z]+$/, ''));
                    if (isNaN(a.routeNumber)) a.routeNumber = 0;
                    a.routeSuffix = a.route.match(/[A-Z]+$/);

                    b.routePrefix = b.route.match(/^[A-Z]+/);
                    b.routeNumber = parseInt(b.route.replace(/^[A-Z]+/, '').replace(/[A-Z]+$/, ''));
                    if (isNaN(b.routeNumber)) b.routeNumber = 0;
                    b.routeSuffix = b.route.match(/[A-Z]+$/);

                    if (a.routeNumber == b.routeNumber) {
                        return a.routePrefix < b.routePrefix ? -1 : 1;
                    }

                    return  a.routeNumber < b.routeNumber ? -1 : 1;
                }
                return a.operatorName < b.operatorName ? -1 : 1;
        });

        // Create the DOM as as it normally should be
         return $.map(sortedResults, function (item) {
                return $('<div>').append($('<a>').addClass('result').append(
                    $('<div>').addClass('content').append(
                        $('<div>').addClass('title').text(item.title)
                    )
                )).html();
            });
    }
};
function trackBus(vehicleRef, firstTime, counter) {

    counter = (counter == parseInt(userOptions.refreshPeriod/appConstant.refreshCounter) ? 1 : counter + 1);
    $('#trackerCounter .counter').html((userOptions.refreshPeriod - ((counter - 1) * appConstant.refreshCounter)));

    // on the first and then every userOptions.refreshPeriod call perform refresh,
    // on all other calls update the counter...
    if (counter > 1) {
        // schedule next callback...
        busTracker = setTimeout(trackBus, appConstant.refreshCounter * 1000, vehicleRef, false, counter);
        return;
    }

    $('#map')
        .dimmer({
            displayLoader: true,
            loaderVariation: 'slow orange medium elastic',
            loaderText: 'Retrieving data, please wait...',
            closable: false,
        })
        .dimmer('show');

    if (firstTime) {
        clearMap();
        $('.bt-search').hide();
        $('.bt-menu').hide();
        $('.bt-track').show();
        // clear any existing timer...
        if (refreshTimer) {
            clearTimeout(refreshTimer);
        }
    }

    const busDataUrl = '/services/BusLocationData';
    var busDataUri = `${busDataUrl}?`
    busDataUri = `${busDataUri}&vehicleRef=${vehicleRef}`;

    $.get(busDataUri, (resp) => {

        //convert the returned JSON string to a JSON object...
        resp = JSON.parse(resp);

        $('#jsonText').text(JSON.stringify(resp, null, 2));

        var vehicleActivity = resp.Siri.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity;

        // enrich data...
        vehicleActivity.extendedAttributes = enrichVehicleAttributes(vehicleActivity);

        $('#infoTracking').data("vehicleActivity", vehicleActivity);

        let title = `${vehicleActivity.MonitoredVehicleJourney.VehicleRef} (${vehicleActivity.extendedAttributes.operatorName} - ${vehicleActivity.MonitoredVehicleJourney.PublishedLineName})`;
        $('#trackedVehicle').html(title);

        addTrackedVehicle(vehicleActivity);
    })
    .fail((rq, ts, e) => {
        displayError(`Error encountered when requesting bus data: ${ts}.`);
    })
    .done(() => {
        // schedule next callback...
        busTracker = setTimeout(trackBus, appConstant.refreshCounter * 1000, vehicleRef, false, counter);
    })
    .always(() => {
        $('#map').dimmer('hide');
    });
};

async function addTrackedVehicle(vehicle) {

    // Request needed libraries.
    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker",);
    const { LatLngBounds } = await google.maps.importLibrary("core");
    const mapBounds = new google.maps.LatLngBounds();

    // do not add a marker if has not moved...
    if (markers.length > 0) {
        if (JSON.stringify(markers[markers.length - 1].vehicle.MonitoredVehicleJourney.VehicleLocation) === JSON.stringify(vehicle.MonitoredVehicleJourney.VehicleLocation)) {
            return;
        }
    }

    const timeTag = document.createElement("div");
    timeTag.className = "time-tag";
    timeTag.textContent = appConstant.timeENGFormatter.format(new Date(vehicle.RecordedAtTime));
 
    // add markers for timeTag...
    let marker = new google.maps.marker.AdvancedMarkerElement({
        map: map,
        position: { lat: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Latitude), lng: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Longitude) },
        content: timeTag,
        title: vehicle.MonitoredVehicleJourney.VehicleRef + '-' + vehicle.MonitoredVehicleJourney.DestinationName,
    });

    //marker.addEventListener("gmp-click", (o) => {
    //    toggleHighlight(marker, vehicle);
    //});

    marker.addListener("click", (o) => {
        toggleHighlight(marker, vehicle);
    });


    marker.vehicle = vehicle;

    //Add marker to tracking array (for use in removing them)...
    markers.push(marker);

    // Draw a polyline between the last timeTag and the latest...
    if (markers.length > 1) {

        const lineSymbol = {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        };

        let prevPoint =
        {
            timestamp: markers[markers.length - 2].vehicle.RecordedAtTime,
            lat: Number(markers[markers.length - 2].vehicle.MonitoredVehicleJourney.VehicleLocation.Latitude),
            lng: Number(markers[markers.length - 2].vehicle.MonitoredVehicleJourney.VehicleLocation.Longitude)
        };

        let currentPoint = {
            timestamp: markers[markers.length - 1].vehicle.RecordedAtTime,
            lat: Number(markers[markers.length - 1].vehicle.MonitoredVehicleJourney.VehicleLocation.Latitude),
            lng: Number(markers[markers.length - 1].vehicle.MonitoredVehicleJourney.VehicleLocation.Longitude)
        };

        let dMetres = distanceBetweenPoints(prevPoint, currentPoint);
        let dMiles = dMetres * 0.000621371;
        let tHours = (new Date(currentPoint.timestamp) - new Date(prevPoint.timestamp)) / (1000*60*60);
        let speedMPH = dMiles / tHours;

        const path = new google.maps.Polyline({
            path: [prevPoint, currentPoint],
            geodesic: true,
            strokeColor: "#FF0000",
            strokeOpacity: 1.0,
            strokeWeight: 2,
            icons: [
                {
                    icon: lineSymbol,
                    offset: "60%",
                },
            ],
            map: map,
        });

        let speedMarkerPos = {
            lat: prevPoint.lat + ((currentPoint.lat - prevPoint.lat) / 2),
            lng: prevPoint.lng + ((currentPoint.lng - prevPoint.lng) / 2)
        };
        const speedTag = document.createElement("div");
        speedTag.className = "speed-tag";
        speedTag.textContent = `${Math.floor(speedMPH).toString()} mph`;

        let speedMarker = new google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: speedMarkerPos,
            content: speedTag,
            title: "Point to point speed",
        });


        // add path to array of paths (for use in removing them)...
        paths.push(path);
        speedMarkers.push(speedMarker);
       
    }

    // get the last 3 points, to use as the mapBounds limit...
    let markerBounds = markers.filter((el, i, arr) => (i > arr.length - 4 ? el : false));
    markerBounds.forEach((m) => {
        mapBounds.extend(m.position);
    });
    map.fitBounds(mapBounds);

    // set the minimum zoom to be 17...
    if (map.zoom > 17)
        map.setZoom(17);
}

function getBuses(counter = 0)
{
    // clear any existing timer...
    if (refreshTimer) {
        clearTimeout(refreshTimer);
    }

    if (!searchCriteria) {
        return false;
    }

    counter = (counter == parseInt(userOptions.refreshPeriod / appConstant.refreshCounter) ? 1 : counter + 1);
    $('#refreshCounter .counter').html((userOptions.refreshPeriod - ((counter - 1) * appConstant.refreshCounter)));

    // on the first and then every userOptions.refreshPeriod call perform refresh,
    // on all other calls update the counter...
    if (counter > 1) {
        // schedule next callback...
        refreshTimer = setTimeout(getBuses, appConstant.refreshCounter * 1000, counter);
        return;
    }

    // clear map...
    clearMap();

    // re-position map if positional data is in search criteria (only time it is not is when initially selecting a specific operator/route)...
    if (searchCriteria.lat && searchCriteria.lng && searchCriteria.zoom) {
        map.panTo({ lat: +searchCriteria.lat, lng: +searchCriteria.lng });
        map.setZoom(+searchCriteria.zoom);
    }

    // only set this following global var after re-draw of map, else the setZoom change event gets fired reulting in infinite recursive call of this method...
    currentViewMode = appConstant.viewMode.search;

    const busDataUrl = '/services/BusLocationData';
    var operatorRef = searchCriteria.operatorRef;
    var lineRef = searchCriteria.lineRef;
    var busDataUri = `${busDataUrl}?`

    if (searchCriteria.operatorRef) {
        busDataUri = `${busDataUri}&operatorRef=${operatorRef}`;
    }

    if (searchCriteria.lineRef) {
        busDataUri = `${busDataUri}&lineRef=${lineRef}`;
    }

    // if the criteria is based on the maps central postion then add this to the query...
    if (searchCriteria.showAll) {

        const mapWest = map.getBounds().getSouthWest().lng();
        const mapSouth = map.getBounds().getSouthWest().lat();
        const mapEast = map.getBounds().getNorthEast().lng();
        const mapNorth = map.getBounds().getNorthEast().lat();

        // define bounding box 
        boundingBox.west = Math.max(mapWest, (mapWest + (mapEast - mapWest) / 2) - (appConstant.searchBoxSize * 2));
        boundingBox.east = Math.min(mapEast, (mapWest + (mapEast - mapWest) / 2) + (appConstant.searchBoxSize * 2));
        boundingBox.south = Math.max(mapSouth, (mapSouth + (mapNorth - mapSouth) / 2) - appConstant.searchBoxSize);
        boundingBox.north = Math.min(mapNorth, (mapSouth + (mapNorth - mapSouth) / 2) + appConstant.searchBoxSize);
        boundingBox.show = mapWest != boundingBox.west || mapSouth != boundingBox.south || mapEast != boundingBox.east || mapNorth != boundingBox.north;

        busDataUri = `${busDataUri}&boundingBox=${boundingBox.west},${boundingBox.south},${boundingBox.east},${boundingBox.north}`;
    }


    // add search criteria to cookie, (not including boundingBox only searches)...
    if (searchCriteria.initialRender && searchCriteria.operatorRef) {
        searchHistory.add(searchCriteria, operatorRoutes.routes);
    }

    $.get(busDataUri, resp => {

        //convert the returned JSON string to a JSON object...
        resp = JSON.parse(resp);

        $('#jsonText').text(JSON.stringify(resp, null, 2));

        var vehicleActivity = resp.Siri.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity;

        if (vehicleActivity) {

            // this is required if there is only one vehicle and the JSON is not structured as an array...
            if (Array.isArray(vehicleActivity) == false) {
                vehicleActivity = [vehicleActivity];
            };

            vehicles = vehicleActivity
                .map(v => {
                    extendedAttributes = enrichVehicleAttributes(v);
                    return {
                        ...v,
                        extendedAttributes
                    };
                });

            if (userOptions.hideAged) {
                vehicles = vehicles.filter(v => v.extendedAttributes.aged == false);
            }

            // Display a message when no vehicles to be displayed...
            if (vehicles.length < 1) {   
                displayMessage(`<p>There are no active buses to display.<br>To see inactive buses click <a class="link options">here</a> and unselect the <strong>Hide inactive buses</strong> option.</p>`);
                return false;
            }
            // limit number of markers loaded onto the map...
            else if (vehicles.length > userOptions.maxMarkers) {     
                displayMessage(`<p>There are ${vehicles.length} buses identified, only ${userOptions.maxMarkers} are shown.<br>Either zoom in on an area to see all buses, or click <a class="link options">here</a> to adjust the maximum number of buses displayed.</p>`);
                vehicles = vehicles.filter((v, i) => i < userOptions.maxMarkers);
            }

            // only draw a bounding box if the box is within the bounds of the displayed map....
            if (boundingBox.show) {

                if (mapBoundingBox)
                    mapBoundingBox.setMap(null);

                // Draw a rectangle to show the boundaryBox...
                mapBoundingBox = new google.maps.Rectangle({
                    strokeColor: "#FF0000",
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillOpacity: 0.1,
                    map,
                    bounds: {
                        north: boundingBox.north,
                        south: boundingBox.south,
                        east: boundingBox.east,
                        west: boundingBox.west,
                    },
                    draggable: true,
                });

                mapBoundingBox.addListener('dragend', () => {
                    // reposition map to be centered on the repositioned bounding box...
                    let mapCentre = mapBoundingBox.getBounds().getCenter();
                    searchCriteria = {
                        ...searchCriteria,
                        lat: mapCentre.lat(),
                        lng: mapCentre.lng()
                    };
                    getBuses();
                });
            }

            // add vehicles to the map, then the current location, if required, then resize/reposition the map as appropriate...
            // this is an asynchronous call so the always fn, below, is generally actioned before this addVehicles call completes...
            addVehicles(vehicles)
                .then(() => {

                    if (searchCriteria.initialRender && vehicles.length > 0) {
                        // resize/reposition map to show all markers...
                        const mapBounds = new google.maps.LatLngBounds();
                        markers.forEach((m) => {
                            mapBounds.extend(m.position);
                        });

                        map.fitBounds(mapBounds);

                        searchCriteria.initialRender = false;
                    };

                })
                .catch((e) => {
                    console.error(`Critical failure: ${e.message}`)
                    displayError(`Oops, a problem occurred displaying the buses.`);
                });


            $('.bt-menu-btn.refresh i').addClass('loading');
            // enable data dependent buttons...
            $('.dataDependent').removeClass('disabled');

        } else {

            vehicles = null;
            displayMessage('No buses matching your criteria are appearing here. Either zoom out or change your criteria.');
            $('.dataDependent').addClass('disabled');
        }

        // automated refresh....
        refreshTimer = setTimeout(getBuses, appConstant.refreshCounter * 1000, counter);

    })
    .fail((rq, ts, e) => {
        displayError(`Error encountered when requesting bus data: ${ts}.`);
    })
        .always(() => {
        $('#map').dimmer('hide');
    });
};

function enrichVehicleAttributes(v) {

    var vehicleDirection;
    switch (v.MonitoredVehicleJourney.DirectionRef.toLowerCase()) {
        case '2':
        case 'in':
        case 'inbound':
            vehicleDirection = 2;
            break;
        case 'outbound':
        case 'out':
        case '1':
        default:
            vehicleDirection = 1;
            break;
    };

    // A request from H...
    const favourite = (v.MonitoredVehicleJourney.VehicleRef == userOptions.favouriteBus) ? true : false;
    // aged infers recorded at time > 1 hour....
    const aged = (((new Date() - new Date(v.RecordedAtTime)) / 3600000) > 1) ? true : false;

    const operator = operatorRoutes.operators.find((operator) => operator.operatorRef == v.MonitoredVehicleJourney.OperatorRef);
    const operatorName = (operator) ? operator.operatorName : `Operator Name not found: ${v.MonitoredVehicleJourney.OperatorRef}`;

    const extendedAttributes = {
        operatorName: operatorName,
        directionCode: vehicleDirection,
        favourite: favourite,
        aged: aged
    };

    return extendedAttributes;
}

async function initMap() {

    // Request needed libraries.
    //@ts-ignore
    const { Map } = await google.maps.importLibrary("maps");
    //const { event } = await google.maps.importLibrary("core");
    //const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker",);

    await currentLocation.get();

    if (!currentLocation.canTrack) {
        $('.bt-menu-btn.me').addClass('disabled');
    }

    // if location is known we shall centre the map on that, with a zoom of appConstant.zoomLocation, else use the default...
    if (currentLocation.canTrack) {
        mapProps.zoom = appConstant.zoomLocation;
        mapProps.center = {
            lat: currentLocation.position.latitude,
            lng: currentLocation.position.longitude
        };
    }
    map = await new Map($('#map')[0], mapProps);

    if (currentLocation.canTrack) {
        await currentLocation.add();
    }

    map.addListener('dragend', () => {
        // reposition the boundary box and search again...
        if (currentViewMode == appConstant.viewMode.search) {
            let mapCentre = map.getCenter();
            searchCriteria = {
                ...searchCriteria,
                lat: mapCentre.lat(),
                lng: mapCentre.lng()
            };
            getBuses();
        }
    });

    map.addListener('zoom_changed', () => {
        if (currentViewMode == appConstant.viewMode.search) {
            let mapCentre = map.getCenter();
            searchCriteria = {
                ...searchCriteria,
                lat: mapCentre.lat(),
                lng: mapCentre.lng(),
                zoom: map.getZoom()
            };
            getBuses();
        }
    });

    //event.addListenerOnce(map, 'tilesloaded', (e) => {
    //    // automatically show buses near you...
    //    $('#locationSearch').trigger('click');
    //});
}

async function addVehicles(vehicles) {

    // Request needed libraries.
    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker",);
    const { LatLngBounds } = await google.maps.importLibrary("core");

    function buildContent(vehicle) {
        const content = document.createElement("div");

        content.classList.add("vehicle");

        // A request from H...
        const favourite = (vehicle.extendedAttributes.favourite == true) ? 'favourite' : '';
        // aged infers recorded at time > 1 hour....
        const aged = (vehicle.extendedAttributes.aged == true) ? 'aged' : '';

        const s = {
            lineRef: vehicle.MonitoredVehicleJourney.LineRef,
            operatorRef: vehicle.MonitoredVehicleJourney.OperatorRef,
            showAll: false,
            initialRender: true,
        };

        if (!Number.isNaN(vehicle.MonitoredVehicleJourney.Bearing)) {
            content.style.setProperty('--dir', Number(vehicle.MonitoredVehicleJourney.Bearing));
        }

        content.innerHTML = `
    <div class="route bus-direction-${vehicle.extendedAttributes.directionCode} ${favourite} ${aged}">
        ${stringTrim(vehicle.MonitoredVehicleJourney.PublishedLineName, 3)}
    </div>
    <div class="details">
        <div class="vehicleRef">Operator: ${vehicle.extendedAttributes.operatorName}</div>
        <div class="vehicleRef">Vehicle Reference: ${vehicle.MonitoredVehicleJourney.VehicleRef}</div>
        <div class="vehicleRef">Destination: ${vehicle.MonitoredVehicleJourney.DestinationName}</div>
        <div class="vehicleRef">Origin: ${vehicle.MonitoredVehicleJourney.OriginName}</div>
        <div class="vehicleRef">Direction: ${vehicle.MonitoredVehicleJourney.DirectionRef}</div>
        <div class="vehicleRef">Bearing: ${vehicle.MonitoredVehicleJourney.Bearing}</div>
        <div class="vehicleRef">Recorded: ${appConstant.shortEnGBFormatter.format(new Date(vehicle.RecordedAtTime))}</div>
        <div class="ui icon buttons" style="display: unset">
            <div class="ui route-link mini button" data='${JSON.stringify(s)}'><i class="bus icon"></i></div>
            <div class="ui favourite-link mini button" data='${vehicle.MonitoredVehicleJourney.VehicleRef}'><i class="heart outline icon"></i></div>
            <div class="ui track-link mini button" data='${vehicle.MonitoredVehicleJourney.VehicleRef}'><i class="eye icon"></i></div>
        </div>
    </div>
    `;

        return content;
    }

    // add markers for each vehicle...
    $.each(vehicles, function (index, vehicle) {

        const marker = new google.maps.marker.AdvancedMarkerElement({
            map: (userOptions.hideAged && vehicle.extendedAttributes.aged) ? null : map,
            position: { lat: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Latitude), lng: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Longitude) },
            content: buildContent(vehicle),
            title: vehicle.MonitoredVehicleJourney.VehicleRef + '-' + vehicle.MonitoredVehicleJourney.DestinationName,

        });

        marker.addListener('click', (o) => {
            toggleHighlight(marker, vehicle);
        });

        marker.vehicle = vehicle;

        //Add marker to tracking array (for use in removing them)...
        markers.push(marker);
    });
}

function stringTrim(s, max) {
    return s;

    // Can I do this in CSS so it only affects the unghihlighted version of the route...
    //return (s.length > max ? s.substring(0, max-1) + String.fromCharCode(0x2026) : s);
}

//function averageVehicleLocation(v) {

//    var latTotal = 0;
//    var longTotal = 0;

//    const location = v
//        .map((v) => {
//            return {
//                lat: Number(v.MonitoredVehicleJourney.VehicleLocation.Latitude),
//                long: Number(v.MonitoredVehicleJourney.VehicleLocation.Longitude),
//            }
//        });

//    var i = 0;
//    location.forEach((l) => {

//        if (l.lat != 0 && i.long != 0) {
//            latTotal = latTotal + l.lat;
//            longTotal = longTotal + l.long;
//            i++;
//        }
//    });

//    return {
//        lat: latTotal / i,
//        lng: longTotal / i
//    }
//}

function clearMap() {

    currentViewMode = null;

    // Clear any timeout callbacks...
    if (busTracker)
        clearTimeout(busTracker);

    // delete existing boundingBox...
    if (mapBoundingBox)
        mapBoundingBox.setMap(null);

    if (accuracyCircle)
        accuracyCircle.setMap(null);

    if (trackerInfoWindow) {
        trackerInfoWindow.close();
        trackerWindow = null;
    }

    // delete existing markers...
    for (let i = 0; i < markers.length; i++) {
        markers[i].setMap(null);
    }
    markers = [];

    // delete paths...
    for (let i = 0; i < paths.length; i++) {
        paths[i].setMap(null);
    }
    paths = [];

    // delete speedMarkers...
    for (let i = 0; i < speedMarkers.length; i++) {
        speedMarkers[i].setMap(null);
    }
    speedMarkers = [];


}

function toggleHighlight(markerView, vehicle) {
    if (markerView.content.classList.contains("highlight")) {
        markerView.content.classList.remove("highlight");
        markerView.zIndex = null;
    } else {
        markerView.content.classList.add("highlight");
        markerView.zIndex = 1;
    }
}

function displayError(content, autoHide = false) { 

    var modal = $.modal({
        /*title: title,*/
        class: 'tiny',
        closeIcon: !autoHide,
        content: content,
    })
        .modal('show');

    if (autoHide) {
        modal.delay(1500)
            .queue(function () {
                $(this).modal('hide').dequeue();
            });
    }
}

function displayMessage(content) {

    $('.app.screen-message .message-content').html(content);
    $('.app.screen-message').removeClass('hidden');

    setTimeout(() => {
        $('.app.screen-message').addClass('hidden');
    }, 5000);
}

function displaySystemMessage(content) {

    $('.system.screen-message .message-content').html(content);
    $('.system.screen-message').removeClass('hidden');

    setTimeout(() => {
        $('.system.screen-message').addClass('hidden');
    }, 5000);
}

function distanceBetweenPoints(point1, point2)
{
    const lat1 = point1.lat;
    const lon1 = point1.lng;
    const lat2 = point2.lat;
    const lon2 = point2.lng;

    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // in metres

    return d;
}
