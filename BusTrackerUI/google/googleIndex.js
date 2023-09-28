// Initialize and add the map
let map;

async function initMap() {
    // The location of Uluru

    // Request needed libraries.
    //@ts-ignore
    const { Map } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    // The map, centered at Uluru
 //   map = new Map(document.getElementById("map"), {
    map = new Map($('#map')[0], {
        zoom: 14,
        center: { lat: 51.4191387, lng: -0.3015675 }, 
        mapId: "DEMO_MAP_ID",
    });

    // The marker, positioned at Uluru
    const marker = new AdvancedMarkerElement({
        map: map,
        position: { lat: 51.408207, lng: -0.303816 },
        title: "LE21FRV",
    });

    const marker1 = new AdvancedMarkerElement({
        map: map,
        position: { lat: 51.4191387, lng: -0.3015675 },
        title: "LG71DVP",
    });
}

initMap();