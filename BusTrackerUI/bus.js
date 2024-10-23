import { appConstant } from "./globals.js";
import { appUtils } from "./utils.js";
import { operatorRoutes } from "./operator-routes.js";
import { searchHistory } from "./search-history.js";
import { userOptions } from "./user-options.js";
import { session } from "./session.js";
import { Ident } from "./ident.js";

let mapObj;
let vehicles = [];
const defaultSearchCriteria = {
    lineRef: null,
    operatorRef: null,
    showAll: true,
    resize: false,
    lat: null,
    lng: null,
    zoom: appConstant.defaultZoom
};
let searchCriteria;
let extendedAttributes;
let busTracker;
let refreshTimer;
let currentLocation = {
    get: async function () {

        try {
            //throw new Error("Test Error");
            const position = await getGeoLocation();

            currentLocation = {
                ...currentLocation,
                position: position,
                center: {
                    lat: position.latitude,
                    lng: position.longitude,
                },
                canTrack: !(position.code == 1)
            };
            return position;
        } catch (err) {
            appUtils.log(err.message);
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
    set: async function () {

        await this.get();
        if (!(this.canTrack)) return false;

        mapObj.showCurrentLocation(currentLocation);

        //setTimeout(this.set.bind(this), 5 * 1000);

    },

};

const appMessage = new appUtils.BTMessage();
const systemMessage = new appUtils.BTMessage({
    className: 'system',
    closeAction: true,
    actions: [
        {
            className: 'hide',
            label: 'Close and do not show again',
            action: function () {
                userOptions.set('hideSystemMessage', true);
            }
        }
    ],

});

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
    appUtils.log(`initiate: start`);

    // Initiate service worker...
    if (!navigator.serviceWorker.controller) {
        navigator.serviceWorker.register("/sw.js").then(function (reg) {
            appUtils.log("Service worker has been registered for scope: " + reg.scope);
        });
    }

    try {

        await session.init();

        // Import appropriate map provider...
        //session.mapProvider = 'Leaflet';
        const module = (session.mapProvider == 'Leaflet' ? await import('./map-leaflet.js') : await import('./map-google.js'));

        // temp ...
        //const query = appUtils.queryStringToJSON(location.search);
        //const module = (query.mapProvider == 'leaflet' ? await import('./map-leaflet.js') : await import('./map-google.js'));

        mapObj = module.mapObj;

        await Promise.all([
            mapObj.initiate(session),
            operatorRoutes.get(),
            userOptions.init()
        ]);

        await initView();

        // initialise the searchCriteria (base from defaults, plus query string, if provided)...
        if (location.search) {

            searchCriteria =
            {
                ...defaultSearchCriteria,
                ...appUtils.queryStringToJSON(location.search)
            }

            // initiate search on search criteria...
            $('.bt-menu-btn.refresh').trigger('click');

        } else {

            $('.bt-menu-btn.here').trigger('click');

        }
        console.log(searchCriteria);

        const endTime = new Date();
        appUtils.log(`initiate: complete after ${(endTime - startTime) / 1000}secs`);

    } catch (error) {
        appUtils.log(`Error initiating: ${error.message}`);
        alert(`Error initiating: ${error.message}`);
        //window.location.href = "offline.html";
    } finally {

        $('.page.dimmer.ident')
            .dimmer('hide')
            .dimmer('destroy');

        // session start message, this value is set in the services config...
        if (session.startMessage != null & userOptions.hideSystemMessage != true)
            systemMessage.display(session.startMessage);

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
                    resize: true,
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

    // Map event handlers...
    $('#map')
        .on('search-route', (e, sc) => {
            searchCriteria = sc;
            getBuses();
        })
        .on('track-vehicle', (e, vehicleRef) => {
            mapObj.currentViewMode = appConstant.viewMode.track;
            trackBus(vehicleRef, true, 0);
        })
        .on('add-favourite', (e, vehicleRef) => {
            userOptions.set('favouriteBus', vehicleRef);
        })
        .on('map-move', e => {

            if (mapObj.currentViewMode == appConstant.viewMode.search) {

                if (searchCriteria.resize) {
                    searchCriteria.resize = false;

                } else {

                    if (searchCriteria.showAll) {

                        appUtils.log(`Zoom: ${mapObj.getZoom()}`);
                        appUtils.log(`Bounds: ${JSON.stringify(mapObj.getBounds())}`);

                        let mapcenter = mapObj.getCenter();
                        searchCriteria = {
                            ...searchCriteria,
                            lat: mapcenter.lat,
                            lng: mapcenter.lng,
                            zoom: mapObj.getZoom()
                        };
                    }
                    getBuses();
                }

            }
            e.preventDefault();
        });

    $('.bt-menu-btn.here')
        .on('click', (e) => {

            let mapCentre = mapObj.getCenter();
            searchCriteria = {
                ...defaultSearchCriteria,
                lat: mapCentre.lat,
                lng: mapCentre.lng,
                zoom: mapObj.getZoom(),
            };
            getBuses();
            e.preventDefault();
        });

    $('.bt-menu-btn.me')
        .on('click', async (e) => {
            await currentLocation.get();
            if (currentLocation.canTrack) {
                // if location is known we shall recenter the map on that...
                searchCriteria = {
                    ...defaultSearchCriteria,
                    lat: currentLocation.position.lat,
                    lng: currentLocation.position.lng,
                };
                getBuses();
                e.preventDefault();

                // on completion of flyTo (map-move) the search will be executed...
                mapObj.flyTo(currentLocation.center);
            }
            e.preventDefault();
        });

    $('.bt-menu-btn.refresh')
        .on('click', (e) => {
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

            $('#optHideSystemMessage')
                .checkbox(`set ${userOptions.hideSystemMessage ? 'checked' : 'unchecked'}`);

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
            $('.bt-menu-btn.refresh').trigger('click');
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

    // this is for the appMessage with link to open Options dialog...
    $('body')
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
            min: 10,
            max: 40,
            step: 5,
            onChange: (val => userOptions.set('refreshPeriod', val)),
        });

    $('#optHideSystemMessage')
        .checkbox({
            onChecked: (() => {
                userOptions.set('hideSystemMessage', true);
            }),
            onUnchecked: (() => {
                userOptions.set('hideSystemMessage', false);
            }),
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
        mapObj.clear();

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

        mapObj.addTrackedVehicle(vehicleActivity);
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
    mapObj.clear();

    // hide any messages...
    appMessage.hide();

    mapObj.currentViewMode = appConstant.viewMode.search;

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
    if (searchCriteria.showAll == true) {
        const bounds = mapObj.getBounds();
        busDataUri = `${busDataUri}&boundingBox=${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;
    }

    // add search criteria to cookie, (not including boundingBox only searches)...
    if (searchCriteria.resize && searchCriteria.operatorRef) {
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
                appMessage.display(`<p>There are no active buses to display.<br>To see inactive buses click <a class="link options">here</a> and unselect the <strong>Hide inactive buses</strong> option.</p>`);
                return false;
            }
            // limit number of markers loaded onto the map...
            else if (vehicles.length > userOptions.maxMarkers) {     
                appMessage.display(`<p>There are ${vehicles.length} buses identified, only ${userOptions.maxMarkers} are shown.<br>Either zoom in on an area to see all buses, or click <a class="link options">here</a> to adjust the maximum number of buses displayed.</p>`);
                vehicles = vehicles.filter((v, i) => i < userOptions.maxMarkers);
            }

            // add vehicles to the map, then resize/reposition the map as appropriate...
            mapObj.addVehicles(vehicles)
                .then(() => {

                    if (searchCriteria.resize && vehicles.length > 0) {
                        // resize/reposition map to show all markers...
                        mapObj.fitAllVehicles();
                        //searchCriteria.resize = false;
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
            appMessage.display('No buses matching your criteria are appearing here. Either zoom out or change your criteria.');
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

    await currentLocation.get();
    if (!currentLocation.canTrack) {
        $('.bt-menu-btn.me').addClass('disabled');
    } 

    mapObj.create('map', currentLocation.center);

    // show the current location, if known...
    if (currentLocation.canTrack) {
        await currentLocation.set();
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

function displaySystemMessage(content) {

    $('#system-message .message-content').html(content);
    $('#system-message').removeClass('hidden');

    $('#system-message')
        .on('click', '.close', (e) => {
            $('#system-message').addClass('hidden');
        })
        .on('click', '.hide', (e) => {
            userOptions.set('hideSystemMessage', true);
            $('#system-message').addClass('hidden');
        });

}

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

                    return a.routeNumber < b.routeNumber ? -1 : 1;
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



