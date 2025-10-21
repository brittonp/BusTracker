const CACHE_NAME = "bustracker-v3.0.0"; // Change this to force refresh

self.addEventListener("install", function (event) {
  event.waitUntil(preLoad());
});

self.addEventListener("updatefound", () => {
  console.log("New version available. Please refresh.");
});

var preLoad = function () {
  console.log("Installing web app");
  return caches.open(CACHE_NAME).then(function (cache) {
    console.log("caching index and important routes");
    return cache.addAll([
      //"/",
      "/offline.html",
    ]);
  });
};

self.addEventListener("activate", (event) => {
  event.waitUntil(clearOldCaches());
});

var clearOldCaches = function () {
  caches.keys().then((cacheNames) => {
    return Promise.all(
      cacheNames.map((cache) => {
        if (cache !== CACHE_NAME) {
          return caches.delete(cache);
        }
      })
    );
  });
};

//self.addEventListener("fetch", function (event) {
//    event.respondWith(checkResponse(event.request).catch(function () {
//        return returnFromCache(event.request);
//    }));
//    event.waitUntil(addToCache(event.request));
//});

var checkResponse = function (request) {
  return new Promise(function (fulfill, reject) {
    fetch(request).then(function (response) {
      if (response.status !== 404) {
        fulfill(response);
      } else {
        reject();
      }
    }, reject);
  });
};

var addToCache = function (request) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return fetch(request.clone()).then(function (response) {
      //console.log(response.url + " was cached");
      if (request.method == "GET") {
        return cache.put(request, response);
      }
    });
  });
};

var returnFromCache = function (request) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(request).then(function (matching) {
      if (!matching || matching.status == 404) {
        return cache.match("offline.html");
      } else {
        return matching;
      }
    });
  });
};
