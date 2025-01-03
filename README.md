# Project Title: BusTracker
A web app to track bus services across England and Wales.

## Motivation
It has been a few years since I considered myself as a developer; the natural career progression from developer through to management has meant that although I have continued to talk-the-talk, it has been a while since I walked-the-walk. During my current, by choice, career break, it has provided me the time and opportunity return to doing some real developing, albeit "playing around". 

You know what, I am not ashamed to say that it has been fun. 

BusTracker has been developed as an exercise in the use of:

* .NET Core to create REST services;
* GitHub to manage and control code;
* Visual Studio to create a solution containing projects:
 * .NET Core API Services;
 * Web UI.
* Google Map API;
* Sourcing data from the [Open Data Service](https://data.bus-data.dft.gov.uk/).
* Hosting on Azure infrastucture

## Access
You can access the test environment from here - https://bustrackerapp.azurewebsites.net.

There are of course caveats associated with this site:
* It is not a production site and should not be considered as such:
  * it may become unavailable without notice;
  * the data may potentially be inaccurate.
* As this project is a non-profit one and leverages "free/effectivley free" services (Azure, Google Maps), there are controls to prevent the incurrence, by me, of costs for such services; this may result in the unavailabilty of the web app.

The code is available here if you wish to look through it - but you will need to aquire your own keys for the Google Maps Javascript API and the Open Bus Data if you plan to download and run it.
