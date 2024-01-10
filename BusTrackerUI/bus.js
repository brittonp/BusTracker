// default...
HereLocation = {
    Latitude: 54.87676318480376,
    Longitude: -3.1485196166071217
};
const CookieExpiry = 365;
//const refreshPeriod = 30; // seconds
const refreshCounter = 1; // seconds
var prevRecordAtTime;

const shortEnGBFormatter = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true,
    timeZoneName: 'short',
});

const timeENGFormatter = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
});

var session;
var vehicles = [];
const defaultSearchCriteria = {
    lineRef: null,
    operatorRef: null,
    onMap: false,
    currentPosition: null,
    initialRender: true
};
let markers = [];
let paths = [];
let speedMarkers = []
let map, infoWindow, trackerInfoWindow;
var operators = [];
var userOptions;
var boundingBox = {
    north: null,
    south: null,
    east: null,
    west: null
};
let mapBoundingBox;
let accuracyCircle;
let busTracker;
let envMap = {
    Development: 'dev',
    Test: 'test',
    Staging: 'stg',
    Production: 'prod',
    Other: 'oth',
};
const viewMode = {
    search: 0,
    track: 1,
};
let currentViewMode;

// could put web.config...
const defaultUserOptions = {
    hideAged: true,
    favouriteBus: '',
    maxMarkers: 200,
    refreshPeriod: 30,  // seconds...
};

// Document Ready function...
$(() => {

    // first retrieve some info from the server...
    $('body')
        .dimmer({
            displayLoader: true,
            loaderVariation: 'slow orange medium elastic',
            loaderText: 'Initialising, please wait...',
            closable: false,
        })
        .dimmer('show');

    const sessionUrl = '/BusTrackerServices/Session/Create';
    $.get({
        url: sessionUrl,
        //async: false,
        timeout: 20*1000 //in milliseconds, in case the web services are waking up....
    })
        .fail((rq, ts, e) => {
            // could be more graceful...
            $('body').dimmer('hide');
            displayMessage(`Oops, a problem occurred loading the app, please try again later.`, false);
        })
        .done((resp) => {
            session = JSON.parse(resp);
            initView();
            $('body').dimmer('hide');
        })
        .always(() => {
        });
});

function initView() { 

    // Set environment glyph..
    $('.env-glyph').addClass(envMap[session.environment] || envMap.Other);

    const operatorsRoutesUrl = './data/operatorRoutes.json';
    const isMobile = (/Mobi|Android/i.test(navigator.userAgent));

    // load google maps intialiser...
    (g => {
        var h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window;
        b = b[c] || (b[c] = {}); var d = b.maps || (b.maps = {}), r = new Set, e = new URLSearchParams, u = () => h || (h = new Promise(async (f, n) => { await (a = m.createElement("script")); e.set("libraries", [...r] + ""); for (k in g) e.set(k.replace(/[A-Z]/g, t => "_" + t[0].toLowerCase()), g[k]); e.set("callback", c + ".maps." + q); a.src = `https://maps.${c}apis.com/maps/api/js?` + e; d[q] = f; a.onerror = () => h = n(Error(p + " could not load.")); a.nonce = m.querySelector("script[nonce]")?.nonce || ""; m.head.append(a) })); d[l] ? console.warn(p + " only loads once. Ignoring:", g) : d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n))
    })
        ({ key: session.googleMapKey, v: "beta" });

        // first thing get list of Operators and routes....
    $.get(operatorsRoutesUrl, (resp) => {
        operators = resp;
    })
        .done(() => {
            // disable data dependent buttons...
            $('.dataDependent').addClass("disabled");

            // Get user options...
            //Cookies.remove('userOptions');
            userOptions = Cookies.get('userOptions');
            if (!userOptions) {
                userOptions = defaultUserOptions;
                Cookies.set('userOptions', JSON.stringify(userOptions), { expires: CookieExpiry });
            }
            userOptions = JSON.parse(Cookies.get('userOptions'));

            const flatOperators = operators.data
                .flatMap(o => {

                    const operatorRoutes = [];

                    operatorRoutes.push({
                        operatorRef: o.operatorRef,
                        operatorName: o.operatorName,
                        lineRef: '',
                        route: '',
                        title: `${o.operatorName} - All Routes`
                    });

                    o.routes.forEach(r => {
                        operatorRoutes.push({
                            operatorRef: o.operatorRef,
                            operatorName: o.operatorName,
                            lineRef: r.lineRef,
                            route: r.route,
                            title: `${o.operatorName} - ${r.route}`
                        });
                    });

                    return operatorRoutes;
                });

            $('#search')
                .search({
                    source: flatOperators,
                    maxResults: 0,
                    searchFields: ['title'],
                    minCharacters: 2,
                    selectFirstResult: true,
                    fullTextSearch: 'all',
                    onSelect: (result, response) => {
                        searchCriteria = {
                            ...defaultSearchCriteria,
                            lineRef: result.lineRef,
                            operatorRef: result.operatorRef,
                            initialRender: true,
                            onMap: false,
                        };
                        currentViewMode = viewMode.search;
                        getBuses(searchCriteria, true);
                    }
                });
        })
        .fail((rq, ts, e) => {
            alert(`Error in processing ${operatorsRoutesUrl}: ${ts}`);
        })
        .always(() => {

        });

    initMap();


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
                        return shortEnGBFormatter.format(new Date(data));
                    }
                },
                {
                    title: 'Valid Until',
                    data: 'ValidUntilTime',
                    visible: false,
                    render: function (data, type, row, meta) {
                        return shortEnGBFormatter.format(new Date(data));
                    }
                },
            ]
        });

    $('.ui.checkbox')
        .checkbox();

    $('#locationSearch')
        .on('click', (e) => {
            getCurrentLocation()
                .then((coords) => {
                    searchCriteria = {
                        ...defaultSearchCriteria,
                        currentPosition: coords,
                        initialRender: true,
                        onMap: true,
                    };
                    currentViewMode = viewMode.search;
                    getBuses(searchCriteria);
                })
                .catch((e) => {
                    console.error(`Critical failure: ${e.message}`);
                    displayMessage('Your current location cannot be identified, this may either be because:<ul><li>you browser cannot support this function, or</li><li>you have declined this function for this site, if so then please review your browser settings.</li></ul>', false);
                });
            e.preventDefault();
        });

    // Update Map...
    $('#updateMap')
        .on('click', (e) => {
            getBuses(searchCriteria);
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
                        return (data ? shortEnGBFormatter.format(new Date(data)) : null);
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
                        return (data ? shortEnGBFormatter.format(new Date(data)) : null);
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
            $('.bt-track').hide();
            // enable data dependent buttons...
            $('.toolbar').removeClass("disabled");
            e.preventDefault();
        });

    // Show Data modal...
    $('#viewData')
        .on('click', (e) => {

            // need to show modal (and the table) before loading the table else columns are all over the place...
            $('#data').modal('show');

            $('#vehicles').DataTable()
                .clear()
                .rows.add(vehicles)
                .columns.adjust()
                .responsive.recalc()
                .draw()
                ;

            e.preventDefault();
        });

    // Show Json modal...
    $('#viewJson')
        .on('click', (e) => {
            $('#json').modal('show');
            e.preventDefault();
        });

    // Show Options modal...
    $('#viewOptions')
        .on('click', (e) => {
            $('#options .form')
                .form('set values', {
                    optionHideAged: userOptions.hideAged,
                    optionFavouriteBus: userOptions.favouriteBus,
                    optionMaxMarkers: userOptions.maxMarkers,
                    optionRefreshPeriod: userOptions.refreshPeriod,
                })
            $('#options').modal('show');
            e.preventDefault();
        });

    $('#formOptions')
        .form({
            on: 'blur',
            inline: true,
            revalidate: false,
            fields: {
                optionMaxMarkers: {
                    identifier: 'optionMaxMarkers',
                    rules: [
                        {
                            type: 'integer[1..200]',
                            prompt: 'Please enter a value between 1 and 200.'
                        }
                    ]
                },
                optionHideAged: {
                    identifier: 'optionHideAged',
                },
                optionFavouriteBus: {
                    identifier: 'optionFavouriteBus',
                },
                optionRefreshPeriod: {
                    identifier: 'optionRefreshPeriod',
                    rules: [
                        {
                            type: 'integer[20..300]',
                            prompt: 'Please enter a value between 20 and 300 (=5 mins).'
                        }
                    ]
                },
            },
            onSuccess: (e, f) => {
                $('#options').modal('hide');

                userOptions = {
                    hideAged: (f.optionHideAged === 'on' ? true : false),
                    favouriteBus: f.optionFavouriteBus,
                    maxMarkers: f.optionMaxMarkers,
                    refreshPeriod: f.optionRefreshPeriod,
                };

                Cookies.set('userOptions', JSON.stringify(userOptions), { expires: CookieExpiry });

                e.preventDefault();
            }
        });

    // Bind search button to form...
    $('#closeOptionsForm')
        .on('click', (e) => {
            $('#formOptions').submit();
            e.preventDefault();
        });
 
    // Clear search history...
    $('#clearSearchHistory')
        .on('click', (e) => {
            Cookies.remove('searches');
            $('#searchHistory').trigger('refresh');
            e.preventDefault();
        });

    $('#searchHistory')
    .on('click', '.item', (e) => {
        searchCriteria = JSON.parse(e.currentTarget.attributes.data.value);
        getBuses(searchCriteria);
        e.preventDefault();
    })
    .on('refresh', (e) => {
        var recentSearches = [];
        var searches = Cookies.get('searches');
        const list = $(e.currentTarget);

        list.empty();

        if (searches) {
            recentSearches = JSON.parse(searches);

            recentSearches = recentSearches
                .map((r, index, self) => {

                    const operator = operators.data.find((operator) => operator.operatorRef == r.operatorRef);
                    const operatorName = (operator) ? operator.operatorName : '';

                    const routeObj = operator.routes.find((route) => route.lineRef == r.lineRef);
                    const route = (r.lineRef && routeObj) ? routeObj.route : 'All Routes';
                    const display = `${operatorName} - ${route}`;

                    return {
                        ...r,
                        operatorName: operatorName,
                        route: route,
                        searched: r.searched,
                        display: display
                    }
                })
                .sort((a, b) => {
                    var a1 = new Date(a.searched);
                    var b1 = new Date(b.searched);
                    if (a1 == b1) return 0;
                    return a1 < b1 ? 1 : -1;
                });

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
                    $('#searchHistory').trigger('refresh');
                }
                return true;
            }
        }
    );

    // Map pop-up evetn handlers...
    $('#map')
        .on('click', '.route-link', e => {
            searchCriteria = JSON.parse(e.currentTarget.attributes.data.value);
            currentViewMode = viewMode.search;
            getBuses(searchCriteria, true);
        })
        .on('click', '.track-link', e => {
            let vehicleRef = e.currentTarget.attributes.data.value;
            currentViewMode = viewMode.track;
            trackBus(vehicleRef, true, 0);
        })
        .on('click', '.favourite-link', e => {
            userOptions.favouriteBus = e.currentTarget.attributes.data.value;
            Cookies.set('userOptions', JSON.stringify(userOptions), { expires: CookieExpiry });
        })
        ;
};

function addSearchToHistory(sc) {
    var recentSearches = [];
    var searches = Cookies.get('searches');

    if (searches) {
        recentSearches = JSON.parse(searches);
    }

    sc.searched = new Date().getTime();

    recentSearches.push(sc);

    // remove duplicates...
    recentSearches = recentSearches
        .sort((a, b) => {
            var a1 = new Date(a.searched);
            var b1 = new Date(b.searched);
            if (a1 == b1) return 0;
            return a1 < b1 ? 1 : -1;
        })
        .filter((r, index, self) => {
            return index === self.findIndex(r1 => r1.operatorRef === r.operatorRef && r1.lineRef === r.lineRef);
        });

    Cookies.set('searches', JSON.stringify(recentSearches), { expires: CookieExpiry });
}

function trackBus(vehicleRef, firstTime, counter) {

    let refreshPeriod = userOptions.refreshPeriod;

    counter = (counter == parseInt(refreshPeriod/refreshCounter) ? 1 : counter + 1);
    $('#trackerCounter .counter').html((refreshPeriod - ((counter-1) * refreshCounter)));

    // on the first and then every sixth call to this call back method update the bus position,
    // on all other calls update the counter...
    if (counter > 1) {
        // schedule next callback...
        busTracker = setTimeout(trackBus, refreshCounter * 1000, vehicleRef, false, counter);
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
        $('.bt-track').show();
    }

    const busDataUrl = '/BusTrackerServices/BusLocationData';
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
        displayMessage(`Error encountered when requesting bus data: ${ts}.`);
    })
    .done(() => {
            // disable data dependent buttons...
        $('.toolbar').addClass("disabled");
        // schedule next callback...
        busTracker = setTimeout(trackBus, refreshCounter * 1000, vehicleRef, false, counter);
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
    timeTag.textContent = timeENGFormatter.format(new Date(vehicle.RecordedAtTime));
 
    // add markers for timeTag...
    marker = new google.maps.marker.AdvancedMarkerElement({
        map: map,
        position: { lat: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Latitude), lng: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Longitude) },
        content: timeTag,
        title: vehicle.MonitoredVehicleJourney.VehicleRef + '-' + vehicle.MonitoredVehicleJourney.DestinationName,
    });

    marker.addEventListener("gmp-click", (o) => {
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

        speedMarker = new google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: speedMarkerPos,
            content: speedTag,
            title: "Point to point speed)",
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

function getBuses(sc) {

    $('#map')
        .dimmer({
            displayLoader: true,
            loaderVariation: 'slow orange medium elastic',
            loaderText: 'Retrieving data, please wait...',
            closable: false,
        })
        .dimmer('show')
        ;

    const busDataUrl = '/BusTrackerServices/BusLocationData';
    var operatorRef = sc.operatorRef;
    var lineRef = sc.lineRef;
    var busDataUri = `${busDataUrl}?`

    if (sc.operatorRef) {
        busDataUri = `${busDataUri}&operatorRef=${operatorRef}`;
    }

    if (sc.lineRef) {
        busDataUri = `${busDataUri}&lineRef=${lineRef}`;
    }

    // If this is the initial call to show buses near current location then reposition/resize the maap...
    if (sc.initialRender && sc.currentPosition) {
        map.setCenter({
            lat: sc.currentPosition.latitude,
            lng: sc.currentPosition.longitude,
        });
        map.setZoom(15);
    }

    // if the criteria is based on the maps central postion then add this to the query...
    if (sc.onMap) {
        const minLng = map.getBounds().getSouthWest().lng();
        const minLat = map.getBounds().getSouthWest().lat();
        const maxLng = map.getBounds().getNorthEast().lng();
        const maxLat = map.getBounds().getNorthEast().lat();

        // restrict bounding box 
        boundingBox.west = Math.max(minLng, (minLng + (maxLng - minLng) / 2) - 0.200);
        boundingBox.east = Math.min(maxLng, (minLng + (maxLng - minLng) / 2) + 0.200);
        boundingBox.south = Math.max(minLat, (minLat + (maxLat - minLat) / 2) - 0.100);
        boundingBox.north = Math.min(maxLat, (minLat + (maxLat - minLat) / 2) + 0.100);

        busDataUri = `${busDataUri}&boundingBox=${boundingBox.west},${boundingBox.south},${boundingBox.east},${boundingBox.north}`;
    }

    // add search criteria to cookie, (not including boundingBox only searches)...
    if (sc.initialRender && sc.operatorRef) {
        addSearchToHistory(sc);
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

            // clear map...
            clearMap();

            // add vehicles to the map, then the current location, if required, then resize/reposition the map as appropriate...
            // this is an asynchronous call so the always fn, below, is generally actioned before this addVehicles call completes...
            addVehicles(vehicles)
                .then(() => {
                    if (sc.currentPosition)
                        addCurrentLocation(sc.currentPosition);
                })
                .then(() => {
                    if (sc.onMap) {
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
                        });
                    } else if (sc.initialRender) {
                        // resize/reposition map to show all markers...
                        const mapBounds = new google.maps.LatLngBounds();
                        markers.forEach((m) => {
                            mapBounds.extend(m.position);
                        });

                        map.fitBounds(mapBounds);
                    };

                    // always set this to false..
                    sc.initialRender = false;
                })
                .catch((e) => {
                    console.error(`Critical failure: ${e.message}`)
                    displayMessage(`Oops, a problem occurred displaying the buses.`, false);
                });

            // enable data dependent buttons...
            $('.dataDependent').removeClass("disabled");

        } else {

            displayMessage('No data was returned matching the specified criteria.')

        }
    })
    .fail((rq, ts, e) => {
        displayMessage(`Error encountered when requesting bus data: ${ts}.`);
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

    const operator = operators.data.find((operator) => operator.operatorRef == v.MonitoredVehicleJourney.OperatorRef);
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
    //const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker",);

    map = new Map($('#map')[0], {
        zoom: 6,
        center: { lat: HereLocation.Latitude, lng: HereLocation.Longitude },
        mapId: "DEMO_MAP_ID",
        zoomControl: true,
        mapTypeControl: false,
        scaleControl: true,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: true,
    });

    map.addListener('dragend', (x, y, z) => {
        // reposition the boundary box and search again...
        if (currentViewMode == viewMode.search) {
            getBuses(searchCriteria);
        }
    });

    map.addListener('zoom_changed', (x, y, z) => {
        console.info(`map zoom: ${map.getZoom()}`);
    });


}

async function addVehicles(vehicles) {

    // Request needed libraries.
    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker",);
    const { LatLngBounds } = await google.maps.importLibrary("core");

    if (vehicles.length < 1) {
        // Display a message when the max number of markers is exceeded...
        displayMessage('No active vehicles to be displayed. To see inactive vehicles disable <em>Hide inactive vehicles</em> option.');
        return false;
    }

    // add markers for each vehicle...
    $.each(vehicles, function (index, vehicle) {

        // limit number of markers loaded onto the map...
        if (index > userOptions.maxMarkers) {
            // Display a message when the max number of markers is exceeded...
            displayMessage(`There are ${vehicles.length} buses identified, only ${userOptions.maxMarkers} will be displayed on the map.`);
            return false;
        }

        const marker = new google.maps.marker.AdvancedMarkerElement({
            map: (userOptions.hideAged && vehicle.extendedAttributes.aged) ? null : map,
            position: { lat: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Latitude), lng: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Longitude) },
            content: buildContent(vehicle),
            title: vehicle.MonitoredVehicleJourney.VehicleRef + '-' + vehicle.MonitoredVehicleJourney.DestinationName,

        });

        //beta only - stopped working 4-Jan-2024, so switched to weekly build and changes event listener...
        marker.addEventListener('gmp-click', (o) => {
            toggleHighlight(marker, vehicle);
        });

        //marker.addListener('click', (o) => {
        //    toggleHighlight(marker, vehicle);
        //});

        marker.vehicle = vehicle;

        //Add marker to tracking array (for use in removing them)...
        markers.push(marker);
    });
}

async function addCurrentLocation(coords) {
    // Request needed libraries.
    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker",);

    // Add a marker for current location...
    const meTag = document.createElement("div");
    meTag.className = "time-tag";
    meTag.textContent = (coords.accuracy > 10 ? "Your estimated location" : "Your location");

    // add markers for timeTag...
    let marker = new google.maps.marker.AdvancedMarkerElement({
        map: map,
        position: {
            lat: coords.latitude,
            lng: coords.longitude,
        },
        content: meTag,
        title: (coords.accuracy > 10 ? `This is an estimate of your location within ${Math.floor(coords.accuracy)} metres.` : "Your location."),
    });

    markers.push(marker);

    accuracyCircle = new google.maps.Circle({
        strokeColor: "#8160d4",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor:  "#8160d4",
        fillOpacity: 0.05,
        map,
        center: {
            lat: coords.latitude,
            lng: coords.longitude,
        }, 
        radius: coords.accuracy,  //metres..
    });

}

function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            position => resolve(position.coords),
            error => reject(error)
        )
    })
}

function averageVehicleLocation(v) {

    var latTotal = 0;
    var longTotal = 0;

    const location = v
        .map((v) => {
            return {
                lat: Number(v.MonitoredVehicleJourney.VehicleLocation.Latitude),
                long: Number(v.MonitoredVehicleJourney.VehicleLocation.Longitude),
            }
        });

    var i = 0;
    location.forEach((l) => {

        if (l.lat != 0 && i.long != 0) {
            latTotal = latTotal + l.lat;
            longTotal = longTotal + l.long;
            i++;
        }
    });

    return {
        lat: latTotal / i,
        lng: longTotal / i
    }
}

function clearMap() {

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
        onMap: false
    };

    content.innerHTML = `
    <div class="route bus-direction-${vehicle.extendedAttributes.directionCode} ${favourite} ${aged}">
        ${vehicle.MonitoredVehicleJourney.PublishedLineName}
    </div>
    <div class="details">
        <div class="vehicleRef">Operator: ${vehicle.extendedAttributes.operatorName}</div>
        <div class="vehicleRef">Vehicle Reference: ${vehicle.MonitoredVehicleJourney.VehicleRef}</div>
        <div class="vehicleRef">Destination: ${vehicle.MonitoredVehicleJourney.DestinationName}</div>
        <div class="vehicleRef">Origin: ${vehicle.MonitoredVehicleJourney.OriginName}</div>
        <div class="vehicleRef">Direction: ${vehicle.MonitoredVehicleJourney.DirectionRef}</div>
        <div class="vehicleRef">Recorded: ${shortEnGBFormatter.format(new Date(vehicle.RecordedAtTime))}</div>
        <div class="ui icon buttons" style="display: unset">
            <div class="ui route-link mini button" data='${JSON.stringify(s)}'><i class="bus icon"></i></div>
            <div class="ui favourite-link mini button" data='${vehicle.MonitoredVehicleJourney.VehicleRef}'><i class="heart outline icon"></i></div>
            <div class="ui track-link mini button" data='${vehicle.MonitoredVehicleJourney.VehicleRef}'><i class="eye icon"></i></div>
        </div>
    </div>
    `;

    return content;
}

function displayMessage(content, autoHide = true) {

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