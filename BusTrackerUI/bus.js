import { appConstant } from "./globals.js";
import { appUtils } from "./utils.js";
import { operatorRoutes } from "./operator-routes.js";
import { searchHistory } from "./search-history.js";
import { userOptions } from "./user-options.js";
import { session } from "./session.js";
import { Ident } from "./ident.js";
import { currentLocation } from "./current-location.js";
import { MasterDetailPanel } from "./master-detail.js";
import { BusStop } from "./busStop.js";

let mapObj;
let vehicles = [];
const defaultSearchCriteria = {
    lineRef: null,
    operatorRef: null,
    currentMapBounds: true,
    resizeAfterSearch: false,
    lat: null,
    lng: null,
    zoom: appConstant.defaultZoom
};
let searchCriteria;
let extendedAttributes;
let busTracker;
let refreshTimer;
let busStopArrivalTimer;

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

    //initViewPort();
    const mapPane = document.getElementById('map-pane');
    mapPane.container = new MasterDetailPanel({
        content: mapPane,
        detailClass: 'content pane',
    });

    const ident = new Ident();

    $(document)
        .on('session', (e, counter) => {
            ident.setText(e.detail.counter);
        })

    //document.addEventListener('session', (e) => {
    //    ident.setText(e.detail.counter);
    //});

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
        //session.mapProvider = 'Google';
        const module = (session.mapProvider == 'Leaflet' ? await import('./map-leaflet.js') : await import('./map-google.js'));

        mapObj = module.mapObj;

        await Promise.all([
            mapObj.initiate(session),
            operatorRoutes.get(),
            userOptions.init()
        ]);

        await initView();

    } catch (error) {
        appUtils.log(`Error initiating: ${error.message}`);
        alert(`Error initiating: ${error.message}`);
        //window.location.href = "offline.html";
    } finally {

        $('.page.dimmer.ident')
            .dimmer('hide')
            .dimmer('destroy');

        appUtils.log(`initiate: end`);

        // session start message, this value is set in the services config...
        if (session && session.startMessage != null && userOptions.hideSystemMessage != true)
            systemMessage.display(session.startMessage);

        // been playing about with when this gets fired...
        $(document).trigger('ready');

    }

    const endTime = new Date();
    appUtils.log(`initiate: complete after ${(endTime - startTime) / 1000}secs`);
}

async function initView() { 

    $(document)
        .on('show-location', (e, cl) => {
            mapObj.addCurrentLocation(currentLocation);
        })
        .on('ready', async (e) => {
            // initialise the searchCriteria (base from defaults, plus query string, if provided)...
            if (location.search) {

                searchCriteria =
                {
                    ...defaultSearchCriteria,
                    ...appUtils.queryStringToJSON(location.search)
                }

                // initiate search on search criteria...
                $('.bt .menu-btn.refresh').trigger('click');

            } else {

                $('.bt .menu-btn.here').trigger('click');

            }

            addStops();

        })
        .on('search-route', (e, sc) => {
            searchCriteria = sc;
            busController();
        })
        .on('track-vehicle', (e, vehicleRef) => {
            mapObj.currentViewMode = appConstant.viewMode.track;
            trackBus(vehicleRef, true, 0);
        })
        .on('add-favourite', (e, vehicleRef) => {
            userOptions.set('favouriteBus', vehicleRef);
        })
        .on('map-move', async (e) => {

            if (mapObj.currentViewMode == appConstant.viewMode.search) {
                if (searchCriteria.resizeAfterSearch) {
                    searchCriteria.resizeAfterSearch = false;

                } else {

                    let mapcenter = mapObj.getCenter();
                    searchCriteria = {
                        ...searchCriteria,
                        lat: mapcenter.lat,
                        lng: mapcenter.lng,
                        zoom: mapObj.getZoom()
                    };
                    await busController();
                }

                addStops();

            }
            e.preventDefault();
        })
        .on('show-bus-stop-arrivals', async (e, stop) => {
            displayStopArrivals(stop);
        })
        .on('detail-hidden', (e) => {
            if (busStopArrivalTimer) {
                clearTimeout(busStopArrivalTimer);
            }
        })
        ;

    // Set environment glyph..
    $('.env-glyph').addClass(appConstant.envMap[session.environment] || appConstant.envMap.Other);

    // disable data dependent buttons...
    $('.dataDependent').addClass('disabled');

    $('#search')
        .search({
            source: operatorRoutes.list,
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
                    currentMapBounds: false,
                    resizeAfterSearch: true,
                };
                mapObj.clearArrivalsPopup();
                busController();
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

    $('.bt .menu-btn.here')
        .on('click', (e) => {

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

    $('.bt .menu-btn.me')
        .on('click', async (e) => {
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

    $('.bt .menu-btn.refresh')
        .on('click', (e) => {
            busController();
            e.preventDefault();
        });

    $('.bt .menu-btn.main')
        .on('click', '#viewOptions', (e) => {

            $('#optionsMenu').popup('hide');

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

            $('#optionsMenu').popup('hide');

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

            $('#optionsMenu').popup('hide');

            $('#json')
                .modal({
                    closable: false,
                })
                .modal('show');
        });

    //$('.bt .menu-btn.main')
    //    .on('click', (e) => {

    //        $('#optionsMenu').popup('hide');

    //        $('#optFavouriteBus > input')
    //            .val(userOptions.favouriteBus);

    //        $('#optHideInactiveVehicles')
    //            .checkbox(`set ${userOptions.hideAged ? 'checked' : 'unchecked'}`);

    //        $('#optMaxMarkersToDisplay')
    //            .slider('set value', userOptions.maxMarkers, false);

    //        $('#optTrackerRefreshPeriod')
    //            .slider('set value', userOptions.refreshPeriod, false);

    //        $('#optHideSystemMessage')
    //            .checkbox(`set ${userOptions.hideSystemMessage ? 'checked' : 'unchecked'}`);

    //        $('#options')
    //            .modal({
    //                closable: false,
    //            })
    //            .modal('show');
    //    })

    // Share...
    $('.bt .menu-btn.share')
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
            $('.bt .search.panel').show();
            $('.bt .menu-btn.search').show();
            $('.bt .track.panel').hide();
            // enable data dependent buttons...
            $('.bt .menu-btn').removeClass('disabled');
            $('.bt .menu-btn.refresh').trigger('click');
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
                    title: 'Operator Ref',
                    data: 'MonitoredVehicleJourney.OperatorRef'
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
                    data: 'MonitoredVehicleJourney.DestinationName',
                    render: function (data, type, row, meta) {
                        return (data ? data : 'Not available');
                    }
                },
                {
                    title: 'Origin',
                    data: 'MonitoredVehicleJourney.OriginName',
                    render: function (data, type, row, meta) {
                        return (data ? data : 'Not available');
                    }
                },
                {
                    title: 'Direction',
                    data: 'MonitoredVehicleJourney.DirectionRef',
                    render: function (data, type, row, meta) {
                        return (data ? data : 'Not available');
                    }
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

    $('.bt .search-history')
        .on('load', (e) => {
            const list = $(e.currentTarget).find('.list');
            list.empty();

            let recentSearches = searchHistory.get();

            if (recentSearches.length > 0) {
                recentSearches.forEach(s => {
                    list.append(`<div class="link item" data='${JSON.stringify(s)}'>${s.title}</div>`);
                });
            } else {
                list.append('<div >No previous searches</div>');
            }
            return true;
        })
        .on('click', '.item', (e) => {
            searchCriteria = JSON.parse(e.currentTarget.attributes.data.value);

            // not ideal...
            let title = operatorRoutes.list.find(e => (e.operatorRef == searchCriteria.operatorRef && e.lineRef == searchCriteria.lineRef)).title;
            $('#search').search('set value', title);
            $('#search input').trigger('keyup'); // force display of clear button...

            // force hide of popup (some times hangs around)...
            $('#searchHistory').popup('hide');

            mapObj.clearArrivalsPopup();
            busController();
            //e.preventDefault();
        })
        .on('click', '.clear', (e) => {
            searchHistory.removeAll();

            // force hide of popup (some times hangs around)...
            $('#searchHistory').popup('hide');

            //e.preventDefault();
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
                hide: 300
            },
            onShow: (e) => {
                // reload the search history of this is being called from searchHistory...
                if (e.id == 'searchHistory') {
                    $('.bt .search-history').trigger('load');
                }
                return true;
            }
        }
    );

    await initMap();

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
        mapObj.clear(true);

        $('.bt .search.panel').hide();
        $('.bt .menu-btn.search').hide();
        $('.bt .track').show();
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

    $('#refreshCounter .counter').html(counter);

    // schedule next callback...
    refreshTimer = setTimeout(busController, appConstant.refreshCounter * 1000, counter);
}

async function getBuses()
{
    // clear map...
    mapObj.clear();
    appMessage.hide();

    mapObj.currentViewMode = appConstant.viewMode.search;

    const busDataUrl = '/services/BusLocationData';
    var operatorRef = searchCriteria.operatorRef;
    var lineRef = searchCriteria.lineRef;
    var busDataUri = `${busDataUrl}?`

    appUtils.log(`searchCriteria: ${JSON.stringify(searchCriteria) }`);

    if (searchCriteria.operatorRef) {
        busDataUri = `${busDataUri}&operatorRef=${operatorRef}`;
    }

    if (searchCriteria.lineRef) {
        busDataUri = `${busDataUri}&lineRef=${lineRef}`;
    }

    // if the criteria is based on the maps central postion then add this to the query...
    if (searchCriteria.currentMapBounds == true) {
        const bounds = mapObj.getBounds();
        busDataUri = `${busDataUri}&boundingBox=${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;
    } else {
        // for next search return to default behaviour to restrict query based on the map's current bounds...
        searchCriteria.currentMapBounds = true;
    }

    // add search criteria to cookie, (not including boundingBox only searches)...
    if (searchCriteria.resizeAfterSearch && searchCriteria.operatorRef) {
        searchHistory.add(searchCriteria, operatorRoutes);
    }

    try {

        const response = await fetch(busDataUri, {
            timeout: 30 * 1000,
            method: "GET"
        });
        if (!response.ok) {
            throw new Error(`Error encountered when requesting bus data: ${response.status}-${response.statusText}.`)
        }

        const respData = await response.json();
        const buses = JSON.parse(respData);

        $('#jsonText').text(JSON.stringify(buses, null, 2));

        var vehicleActivity = buses.Siri.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity;

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

            // do not plot vehicles with lat and lng of 0 and 0...
            vehicles = vehicles.filter(v => v.MonitoredVehicleJourney.VehicleLocation.Latitidue != 0 && v.MonitoredVehicleJourney.VehicleLocation.Longitude != 0);

            if (userOptions.hideAged) {
                vehicles = vehicles.filter(v => v.extendedAttributes.aged == false);
            }

            // Display a message when no vehicles to be displayed...
            if (vehicles.length < 1) {
                appMessage.display(`<p>There are no active buses to display.<br>To see inactive buses click <a class="link options">here</a> and unselect the <strong>Hide inactive buses</strong> option.</p>`);

            } else {
                // limit number of markers loaded onto the map...
                if (vehicles.length > userOptions.maxMarkers) {
                    appMessage.display(`<p>There are ${vehicles.length} buses identified, only ${userOptions.maxMarkers} are shown.<br>Either zoom in on an area to see all buses, or click <a class="link options">here</a> to adjust the maximum number of buses displayed.</p>`);
                    vehicles = vehicles.filter((v, i) => i < userOptions.maxMarkers);
                }

                // add vehicles to the map, then resizeAfterSearch/reposition the map as appropriate...
                //appUtils.log(`addVehicles: ${vehicles.length}`);
                mapObj.addVehicles(vehicles)
                    .then(() => {

                        if (searchCriteria.resizeAfterSearch && vehicles.length > 0) {
                            // resizeAfterSearch/reposition map to show all markers...
                            mapObj.fitAllVehicles();
                        };

                    })
                    .catch((e) => {
                        console.error(`Critical failure: ${e.message}`)
                        displayError(`Oops, a problem occurred displaying the buses.`);
                    });


                $('.bt .menu-btn.refresh i').addClass('loading');
                // enable data dependent buttons...
                $('.dataDependent').removeClass('disabled');
            }
        } else {
            vehicles = null;
            appMessage.display('No buses matching your criteria are appearing here. Either zoom out or change your criteria.');
            $('.dataDependent').addClass('disabled');
        }
    }
    catch (e) {
        appMessage.display(e.message);
        return false;
    }

    return true;
};

async function addStops() {

    // restrict when bus stops are displayed...
    if (mapObj.getZoom() < appConstant.minBusStopZoom) {
        mapObj.clearStopMarkers();
        mapObj.clearArrivalsPopup();
        return;
    }

    const bounds = mapObj.getBounds();
    let counter = 0;

    while (counter < appConstant.maxServiceRetry) {
        try {
            const response = await fetch(`/services/BusStop/Bounding-Box?north=${bounds.north}&east=${bounds.east}&south=${bounds.south}&west=${bounds.west}`,
                {
                timeout: appConstant.timeoutService,
                method: "GET"
                }
            );

            const data = await response.json();

            if (data.length > 0) {
                const busStops = JSON.parse(data);
                mapObj.addStops(busStops);
            }
            return true;
        }
        catch (err) {
            await appUtils.sleep(appConstant.delayServiceRetry);
        }
        finally {
            counter++;
        }
    }
    //throw new Error(`Failed to load bus stops.`);
    appMessage.display(`Failed to load bus stops.`);
    return false;

}

async function displayStopArrivals(stop) {

    const busStop = new BusStop(stop);

    await reloadContent(true);

    async function reloadContent(firstTime = false) {

        // cancel any exisiting arrival refreshes (for a previously selected bus stop)...
        if (busStopArrivalTimer) {
            clearTimeout(busStopArrivalTimer);
        }

        let arrivals = [];

        try {
            arrivals = await busStop.arrivals();
        }
        catch {
            null;
        }

        let content = `
        <div class="pane row">
            ${busStop.stop.standardIndicator ? `<div class="indicator" title='${busStop.stop.naptanId}'>${busStop.stop.standardIndicator}</div>` : ''}
            <div class="destination">${busStop.stop.commonName}${!busStop.stop.standardIndicator ? ', ' + busStop.stop.indicator : ''}<br> </div>
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
                    <td class="center aligned one wide">${(b.liveData == true ? 'Live' : 'Schd.')}</td>
                    <td class="center aligned three wide">${(b.minutes < 1 ? 'Due' : b.minutes)}</td>
                    <td class="center aligned  three wide">${b.lineName}</td>
                    <td class="four wide">${b.destinationName}</td>
                    <td class="one wide">${b.src}</td>
                </tr>`;
            });
            content += '</tbody></table>';
        }
        else {
            content += `
            <div class="pane row" >
                <div> Sorry, there is no arrival data available for this stop.</div>
            </div>`;
        }

        content += `
        </div>`;

        if (busStop.stop.atcoAreaCode == '490') {
            content += `
            <div class="pane row">
                <div><a href="https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service" target="_blank">Powered by TfL Open Data</a></div>
            </div>`;
        }

        // refresh detail pane...
        document.getElementById('map-pane').container.detail.setContent(content);

        // automated refresh....
        busStopArrivalTimer = setTimeout(reloadContent, appConstant.refreshStopArrivalsSecs * 1000);
    }
}

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

    const operator = operatorRoutes.list.find((operator) => operator.operatorRef == v.MonitoredVehicleJourney.OperatorRef);
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
        $('.bt .menu-btn.me').addClass('disabled');
    } 

    await mapObj.create('map', currentLocation.center);

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