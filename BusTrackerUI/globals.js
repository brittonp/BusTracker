export const appConstant = {
    cookieExpiry: 365,
    userOptionsCookieName: 'userOptions',
    userSearchesCookieName: 'userSearches',
    refreshCounter: 1, // seconds
    zoomLocation: 15,
    maxBusDisplay: 800,
    minBusDisplay: 100,
    searchBoxSize: 0.2,
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
        hour12: false,
    })
}

export function log(msg) {
    console.log(`${appConstant.shortEnGBFormatter.format(new Date())}: ${msg}`);
}


export function queryStringToJSON(qs) {
    var pairs = qs.slice(1).split('&');

    var result = {};
    pairs.forEach(function (pair) {
        pair = pair.split('=');
        result[pair[0]] = decodeURIComponent(pair[1] || '');
    });

    return JSON.parse(JSON.stringify(result));
}