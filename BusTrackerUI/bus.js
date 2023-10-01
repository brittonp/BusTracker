(g => { var h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window; b = b[c] || (b[c] = {}); var d = b.maps || (b.maps = {}), r = new Set, e = new URLSearchParams, u = () => h || (h = new Promise(async (f, n) => { await (a = m.createElement("script")); e.set("libraries", [...r] + ""); for (k in g) e.set(k.replace(/[A-Z]/g, t => "_" + t[0].toLowerCase()), g[k]); e.set("callback", c + ".maps." + q); a.src = `https://maps.${c}apis.com/maps/api/js?` + e; d[q] = f; a.onerror = () => h = n(Error(p + " could not load.")); a.nonce = m.querySelector("script[nonce]")?.nonce || ""; m.head.append(a) })); d[l] ? console.warn(p + " only loads once. Ignoring:", g) : d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)) })
    ({ key: "AIzaSyAyq25sEsGPXISna5uL1Zkgq5ofCIT1anI", v: "beta" });

// default...
HereLocation = {
    Latitude: 54.87676318480376,
    Longitude: -3.1485196166071217
};
const CookieExpiry = 7;
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

var vehicles = [];
var searchCriteria = {
    lineRef: null,
    operatorRef: null,
    onMap: false
};
var markers = [];
var map;
var operators = [];
var userOptions;
var boundingBox = {
    north: null,
    south: null,
    east: null,
    west: null
};
var mapBoundingBox;

// Document Ready function...
$(function () {

    //$('.ui.accordion').accordion();

    const operatorsRoutesUrl = './data/operatorRoutes.json';
    const isMobile = (/Mobi|Android/i.test(navigator.userAgent));

    // arrange header bar based on device type...
    if (isMobile) {
        $('#mobileMenuTitle').append($('#menuTitle'));
        $('#mobileMenuSearch').append($('#menuSearch'));
        $('#mobileMenuButtons').append($('#menuButtons'));
    } else {
        $('#otherMenuTitle').append($('#menuTitle'));
        $('#otherMenuSearch').append($('#menuSearch'));
        $('#otherMenuButtons').append($('#menuButtons'));
    }

     // first thing get list of Operators and routes....
    $
        .get(operatorsRoutesUrl, function (resp) {

            operators = resp;

            // disable data dependent buttons...
            $('.dataDependent').addClass("disabled");

            // Get user options...
            //Cookies.remove('userOptions');
            userOptions = Cookies.get('userOptions');
            if (!userOptions) {
                userOptions = {
                    hideAged: true,
                    favouriteBus: '',
                    maxMarkers: 200
                };
                Cookies.set('userOptions', JSON.stringify(userOptions), { expires: CookieExpiry });
            }
            userOptions = JSON.parse(Cookies.get('userOptions'));

            // Create data table (will load later)...
            new DataTable('#vehicles', {
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
                        data: 'extendedAttributes.operatorPublicName'
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

            const flatOperators = operators.data
                .flatMap(o => {

                    const operatorRoutes = [];

                    operatorRoutes.push({
                        operatorRef: o.operatorRef,
                        operatorPublicName: o.operatorPublicName,
                        lineRef: '',
                        route: '',
                        title: `${o.operatorPublicName} - All Routes`
                    });

                    o.routes.forEach(r => {
                        operatorRoutes.push({
                            operatorRef: o.operatorRef,
                            operatorPublicName: o.operatorPublicName,
                            lineRef: r.lineRef,
                            route: r.route,
                            title: `${o.operatorPublicName} - ${r.route}`
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
                            lineRef: result.lineRef,
                            operatorRef: result.operatorRef,
                            onMap: false
                        };
                        getBuses(searchCriteria, true);
                    }
                })
                ;

            loadSearchHistory();

        })
        .fail(function (e, e2) {
            alert(`Error in processing ${operatorsRoutesUrl}: ${e2}`);
        });

    initMap();

    $('.ui.checkbox')
        .checkbox()
        ;

    $('#locationSearch')
        .on('click', (e) => {
            searchCriteria = {
                lineRef: '',
                operatorRef: '',
                onMap: true
            };
            getBuses(searchCriteria);
            e.preventDefault();
        });

    // Update Map...
    $('#updateMap')
        .on('click', (e) => {
            getBuses(searchCriteria);
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
                    optionMaxMarkers: userOptions.maxMarkers
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

                }
            },
            onSuccess: (e, f) => {
                $('#options').modal('hide');

                userOptions.hideAged = (f.optionHideAged === 'on' ? true : false);
                userOptions.favouriteBus = f.optionFavouriteBus;
                userOptions.maxMarkers = f.optionMaxMarkers;

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
            loadSearchHistory();
            e.preventDefault();
        });

    $('#searchHistory')
        .on('click', '.item', (e) => {
            searchCriteria = JSON.parse(e.currentTarget.attributes.data.value);
            getBuses(searchCriteria, true);
            e.preventDefault();
        });

    $('.menu .browse')
        .popup({
            inline: true,
            on: 'click',
            hoverable: true,
            position: 'bottom left',
            delay: {
                show: 300,
                hide: 500
            }
        })
        ;
});

loadSearchHistory = function () {

    var recentSearches = [];
    var searches = Cookies.get('searches');

    $('#searchHistory').empty();

    if (searches) {
        recentSearches = JSON.parse(searches);

        recentSearches = recentSearches
            .map((r, index, self) => {

                const operator = operators.data.find((operator) => operator.operatorRef == r.operatorRef);
                const operatorPublicName = (operator) ? operator.operatorPublicName : '';

                // this is a fudge - if the route for the operator is not in the cached data (file operatorRoutes.json read into array operators)
                // then show all routes. Really the cached operator/route data should be updated more frequently.
                const routeObj = operator.routes.find((route) => route.lineRef == r.lineRef);
                const route = (r.lineRef && routeObj) ? routeObj.route : 'All Routes';
                const display = `${operatorPublicName} - ${route}`;

                return {
                    ...r,
                    operatorPublicName: operatorPublicName,
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
            $('#searchHistory').append(`<div class="link item" data='${JSON.stringify(s)}'>${s.display}</div>`);
        });

    } else {
        $('#searchHistory').append('<div >No previous searches</div>');
    }
}

function getBuses (f, recentre) {

    $('#map')
        .dimmer({
            displayLoader: true,
            loaderVariation: 'slow orange medium elastic',
            loaderText: 'Retrieving data, please wait...',
            closable: false,
        })
        .dimmer('show')
        ;

    const busDataUrl = './BusTrackerServices/BusLocationData';
    //const busDataUrl = 'BusData.aspx';
    var operatorRef = f.operatorRef;
    var lineRef = f.lineRef;

    //var busDataUri = `${busDataUrl}?operatorRef=${operatorRef}`

    var busDataUri = `${busDataUrl}?`

    if (operatorRef.length) {
        busDataUri = `${busDataUri}&operatorRef=${operatorRef}`;
    }

    if (lineRef.length) {
        busDataUri = `${busDataUri}&lineRef=${ lineRef }`;
    }

    if (f.onMap) {
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
    if (operatorRef) {
        var recentSearches = [];
        var searches = Cookies.get('searches');

        if (searches) {
            recentSearches = JSON.parse(searches);
        }

        f.searched = new Date().getTime();

        recentSearches.push(f);

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

        loadSearchHistory();

    }

  
    $.get(busDataUri, function (resp) {

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
                    const operatorPublicName = (operator) ? operator.operatorPublicName : `Operator Name not found: ${v.MonitoredVehicleJourney.OperatorRef}`;

                    const extendedAttributes = {
                        operatorPublicName: operatorPublicName,
                        directionCode: vehicleDirection,
                        favourite: favourite,
                        aged: aged
                    };

                    return {
                        ...v,
                        extendedAttributes
                    };
                });

            if (userOptions.hideAged) {
                vehicles = vehicles.filter(v => v.extendedAttributes.aged == false);
            }

            loadMap(vehicles, recentre);

            // enable data dependent buttons...
            $('.dataDependent').removeClass("disabled");

        } else {

            DisplayMessage('No data was returned matching the specified criteria.')

        }
    })
    .fail((e) => {
        DisplayMessage(`Error encountered when requesting bus data: ${e.responseText}.`);
    })
    .always(() => {
        $('#map').dimmer('hide');
    });
};

async function initMap() {

    // Request needed libraries.
    //@ts-ignore
    const { Map } = await google.maps.importLibrary("maps");
    //const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker",);

    map = new Map($('#map')[0], {
        zoom: 6,
        center: { lat: HereLocation.Latitude, lng: HereLocation.Longitude },
        mapId: "DEMO_MAP_ID",
    });

    map.addListener("dragend", (x, y, z) => {
        // reposition the boundary box and search again...
        if (searchCriteria.onMap) {
            getBuses(searchCriteria);
        }
    });

}

async function loadMap(vehicles, recentre) {

    // Request needed libraries.
    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker",);
    const { LatLngBounds } = await google.maps.importLibrary("core");
    const mapBounds = new google.maps.LatLngBounds();

    // delete existing boundingBox...
    if (mapBoundingBox)
        mapBoundingBox.setMap(null);

    // delete existing markers...
    deleteMarkers();

    if (vehicles.length < 1) {
        // Display a message when the max number of markers is exceeded...
        DisplayMessage('No active vehicles to be displayed. To see inactive vehicles disable <em>Hide inactive vehicles</em> option.');
        return false;
    }

    // add markers for each vehicle...
    $.each(vehicles, function (index, vehicle) {

        // limit number of markers loade donto the map...
        if (index > userOptions.maxMarkers) {
            // Display a message when the max number of markers is exceeded...
            DisplayMessage(`There are ${vehicles.length} buses identified, only ${userOptions.maxMarkers} can be displayed on the map.`);
            return false;
        }

        const AdvancedMarkerElement = new google.maps.marker.AdvancedMarkerElement({
            map: (userOptions.hideAged && vehicle.extendedAttributes.aged) ? null : map,
            position: { lat: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Latitude), lng: Number(vehicle.MonitoredVehicleJourney.VehicleLocation.Longitude) },
            content: buildContent(vehicle),
            title: vehicle.MonitoredVehicleJourney.VehicleRef + '-' + vehicle.MonitoredVehicleJourney.DestinationName,

        });

        AdvancedMarkerElement.addEventListener("gmp-click", (o) => {
            toggleHighlight(AdvancedMarkerElement, vehicle);
        });

        // Listen for specific actions initiated from the marker...
        AdvancedMarkerElement.addListener("click", (o) => {
            if ($(o.domEvent.target).hasClass('route-link')) {
                searchCriteria = JSON.parse(o.domEvent.target.attributes.data.value);
                getBuses(searchCriteria, true);
            }
        });

        AdvancedMarkerElement.vehicle = vehicle;

        //Add marker to tracking array (for use in removing them)...
        markers.push(AdvancedMarkerElement);

        mapBounds.extend(AdvancedMarkerElement.position);

    });

    if (recentre == true) {
        // zoom map to show all markers...
        map.fitBounds(mapBounds);
    } else {
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
    }
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

// Sets the map on all markers in the array.
function setMapOnAll(map) {
    for (let i = 0; i < markers.length; i++) {
        markers[i].setMap(map);
    }
}

// Removes the markers from the map, but keeps them in the array.
function hideMarkers() {
    setMapOnAll(null);
}

// Deletes all markers in the array by removing references to them.
function deleteMarkers() {
    hideMarkers();
    markers = [];
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
        <div class="vehicleRef">Operator: ${vehicle.extendedAttributes.operatorPublicName}</div>
        <div class="vehicleRef">Vehicle Reference: ${vehicle.MonitoredVehicleJourney.VehicleRef}</div>
        <div class="vehicleRef">Destination: ${vehicle.MonitoredVehicleJourney.DestinationName}</div>
        <div class="vehicleRef">Origin: ${vehicle.MonitoredVehicleJourney.OriginName}</div>
        <div class="vehicleRef">Direction: ${vehicle.MonitoredVehicleJourney.DirectionRef}</div>
        <div class="vehicleRef">Recorded: ${shortEnGBFormatter.format(new Date(vehicle.RecordedAtTime))}</div>
        <div class="ui icon buttons" style="display: unset">
          <div class="ui route-link mini button" data='${JSON.stringify(s)}'><i class="bus icon"></i></div>
          <button class="ui favourite-link mini button" title="Make this your favourite bus" data="${vehicle.MonitoredVehicleJourney.VehicleRef}"><i class="heart outline icon"></i></button>
        </div>
    </div>
    `;
    return content;
}

function DisplayMessage(content) {

    $.modal({
        /*title: title,*/
        class: 'tiny',
        closeIcon: false,
        content: content,
    })
        .modal('show')
        .delay(4000)
        .queue(function () {
            $(this).modal('hide').dequeue();
        });
}
