# Project Title: BusTracker
A web app to track bus services across England and Wales.

## Motivation
Bus Tracker has been developed as an exercise in the use of:

* .NET Core to create a REST service;
* GitHub to manage and control code;
* Visual Studio to create a solution containing projects:
 * Services;
 * Web UI.
* Google Map API;
* Sourcing data from the [Open Data Service](https://data.bus-data.dft.gov.uk/).
* Hosting on Azure infrastucture

## Access
You can access the test environment from here https://bustrackerapp.azurewebsites.net.

There are of course caveats associated with this site:
* It is not a production site and should not be considered as such:
  * it may become unavailable for periods of time;
  * the data may potetnialy be inaccurate
* As this project is a non-profit one and leverages "free/effectivley free" level services (Azure, Google Maps), there are controls to prevent the incurrence, by me, of costs for such servces; this may result in the unavailabilty of web app from running

The code is available here if you wish to look through - but you will need to aquire your own keys for the Google Maps Javascript API and the Open Bus Data if you plan to download and run it.
