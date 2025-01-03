export const appConstant = {
    cookieExpiry: 365,
    userOptionsCookieName: 'userOptions',
    userSearchesCookieName: 'userSearches',
    refreshCounter: 1, // seconds
    refreshStopArrivalsSecs: 5,
    refreshCurrentLocationSecs: 5,
    defaultZoom: 16,
    minBusStopZoom: 15,
    maxBusDisplay: 800,
    minBusDisplay: 100,
    maxBusArrivals: 5,
    maxSearchHistory: 8,
    searchBoxSize: 0.2,
    vehicleSmallThreshold: 300,
    maxServiceRetry: 5,
    delayServiceRetry: 5000,
    timeoutService: 3000,
    envMap: {
        Development: 'dev',
        Test: 'test',
        Staging: 'stg',
        Production: 'prod',
        Other: 'oth',
    },
    viewMode: {
        search: 0,
        track: 1,
    },
    shortEnGBFormatter: new Intl.DateTimeFormat('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true,
        timeZoneName: 'short',
    }),
    timeENGFormatter: new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
    }),
    mapBounds: {
        north: 61.02637,
        south: 49.624946,
        west: -7.239990,
        east: 3.691406,
    }
}

