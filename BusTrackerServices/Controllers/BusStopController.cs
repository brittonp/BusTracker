using Microsoft.AspNetCore.Mvc;
using BusTrackerServices.Data;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;
using Azure;
using System.Xml;
using System.Text;
using System;
using System.Net.Http.Headers;
using System.Net.Http;
using System.Xml.Schema;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using System.Net;
using System.Collections.Generic;

namespace BusTrackerServices.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class BusStopController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<BusStopController> _logger;
        private readonly ISqlData _sqlData;
        private readonly IHttpClientFactory _httpClientFactory;

        public BusStopController(
            IConfiguration configuration,
            ILogger<BusStopController> logger,
            ISqlData sqlData,
            IHttpClientFactory httpClientFactory
        )
        {
            _configuration = configuration;
            _logger = logger;
            _sqlData = sqlData;
            _httpClientFactory = httpClientFactory;
        }

        [HttpGet("Bounding-Box")]
        public JsonResult GetByBoundingBox(
            double north = 51.432822,
            double east = -0.250454,
            double south = 51.406247,
            double west = -0.332851
        )
        {
            return _sqlData.GetBusStopsByBoundingBox(north, east, south, west);
        }

        [HttpGet("Atco-Area-Code")]
        public JsonResult? GetByAtcoCode(
            string atcoCode = "490"
        )
        {
            return _sqlData.GetBusStopsByAtcoCode(atcoCode);
        }

        [HttpGet("GetArrivals")]
        public async Task<JsonResult> GetArrivals(
            string naptanId = "490018665S"
            //string naptanId = "0800COC30943"
        )
        {
            var arrivalsTflReq = GetTflAsync(naptanId);
            var arrivalsTravelineReq = GetTravelineAsync(naptanId);

            await Task.WhenAll(arrivalsTflReq, arrivalsTravelineReq);

            IEnumerable<BusStopArrival>? arrivalsTfl = arrivalsTflReq.Result;
            IEnumerable<BusStopArrival>? arrivalsTraveline = arrivalsTravelineReq.Result;

            // Ignore Traveline scheduled arrivals if TFL live arrivals exist for the same line number...
            IEnumerable<BusStopArrival> arrivalsTravelineFiltered = [];
            if (arrivalsTfl?.Any() == true)
            {
                foreach (BusStopArrival travelineBsa in arrivalsTraveline)
                {
                    if (arrivalsTfl?.Any(r => r.lineName == travelineBsa.lineName) == false)
                    {
                        arrivalsTravelineFiltered = arrivalsTravelineFiltered.Append(travelineBsa);
                    }
                }
            } else {
                arrivalsTravelineFiltered = arrivalsTraveline;
            }

            // merge the TFL and the filtered Traveline arrivals...
            IEnumerable<BusStopArrival> mergedArrivals = [
                .. arrivalsTfl, 
                .. arrivalsTravelineFiltered
            ];

            string jsonString = JsonConvert.SerializeObject(mergedArrivals);

            return new JsonResult(jsonString);
        }

        private async Task<IEnumerable<BusStopArrival>?> GetTflAsync(
            string naptanId
        )
        {
            string uri = $"https://api.tfl.gov.uk/StopPoint/{naptanId}/Arrivals";
            string response = "";

            using HttpClient client = _httpClientFactory.CreateClient();

            try
            {
                response = await client.GetStringAsync(uri);
            }
            catch (HttpRequestException e) when (e.StatusCode == HttpStatusCode.NotFound)
            {
                // ignore if no data is returned, (as when a non-TFL bustop naptanId is requested)...
                return [];
            }
            catch (HttpRequestException e)
            {
                _logger.LogError(998, e, $"Exception: {e.Message}");
                throw;
            }

            JArray jsonArr = JArray.Parse(response);

            var arrivals = jsonArr.Root
                .Select(r =>
                {
                    return new BusStopArrival
                    {
                        lineName = (string?)r["lineName"],
                        destinationName = (string?)r["destinationName"],
                        timeToStation = (int?)r["timeToStation"],
                        stationName = (string?)r["stationName"],
                        naptanId = (string?)r["naptanId"],
                        timestamp = (string?)r["timestamp"],
                        liveData = (bool)true,
                        src = "TFL"
                    };
                });

            return arrivals;
        }

        private async Task<IEnumerable<BusStopArrival>> GetTravelineAsync(
            string naptanId
        )
        {
            string? uri = _configuration["BT_Traveline:Next_Bus_URL"];
            string response = String.Empty;

            var authenticationString = $"{_configuration["BT_Traveline:Requestor_Ref"]}:{_configuration["BT_Traveline:Requestor_Pwd"]}";
            var base64EncodedAuthenticationString = Convert.ToBase64String(System.Text.ASCIIEncoding.ASCII.GetBytes(authenticationString));
            var header = new AuthenticationHeaderValue("Basic", base64EncodedAuthenticationString);

            using HttpClient client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = header;

            try
            {
                HttpResponseMessage responseBody = await client.PostAsync(uri, TravelineRequestContent(naptanId));
                response = await responseBody.Content.ReadAsStringAsync();
            }
            catch (HttpRequestException e)
            {
                _logger.LogError(998, e, $"Exception: {e.Message}");
                throw;
            }

            XmlDocument xmlDocument = new XmlDocument();
            xmlDocument.LoadXml(response);

            //Convert from XML to JSON...
            string jsonString = JsonConvert.SerializeXmlNode(xmlDocument.DocumentElement);
            JObject jsonObj = JObject.Parse(jsonString);

            // do stuff with jsonObj...
            IEnumerable<BusStopArrival>? arrivals = jsonObj.Root["Siri"]?["ServiceDelivery"]?["StopMonitoringDelivery"]?["MonitoredStopVisit"]?
                .Select(r =>
                {
                    // timeToStation = (AimedDepartureTime - RecordedAtTime ) in seconds (I think)...
                    bool liveData = (r["MonitoredVehicleJourney"]?["MonitoredCall"]?["ExpectedDepartureTime"] != null);

                    int timeToStation = (int)((DateTime)r["MonitoredVehicleJourney"]?["MonitoredCall"]?["AimedDepartureTime"] - (DateTime)r["RecordedAtTime"]).TotalSeconds;

                    return new BusStopArrival
                    {
                        lineName = r["MonitoredVehicleJourney"]?["PublishedLineName"].ToString(),
                        destinationName = r["MonitoredVehicleJourney"]?["DirectionName"].ToString(),
                        timeToStation = timeToStation,
                        stationName = String.Empty,
                        naptanId = r["MonitoringRef"].ToString(),
                        timestamp = ((DateTime)r["RecordedAtTime"]).ToString("yyyy-MM-ddTHH:mm:ssZ"),
                        liveData = liveData,
                        src = "Traveline"
                    };
                });

            return arrivals;
        }

        private StringContent TravelineRequestContent(string naptanId)
        {
            // Get request body XML...
            XmlDocument xmlDocument = new XmlDocument();
            xmlDocument.Load(_configuration["BT_Traveline:Request_Content_File_Path"] ?? String.Empty);

            // Set values...
            XmlNamespaceManager nsmgr = new XmlNamespaceManager(xmlDocument.NameTable);
            nsmgr.AddNamespace("siri", "http://www.siri.org.uk/");
            XmlElement? root = xmlDocument.DocumentElement;

            // RequestorRef...
            root.SelectSingleNode("descendant::siri:RequestorRef", nsmgr).InnerText = _configuration["BT_Traveline:Requestor_Ref"] ?? String.Empty;

            // RequestTimestamp...
            string requestTimestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
            foreach (XmlNode node in root.SelectNodes("descendant::siri:RequestTimestamp", nsmgr))
            {
                node.InnerText = requestTimestamp;
            }

            // MessageIdentifier...
            root.SelectSingleNode("descendant::siri:MessageIdentifier", nsmgr).InnerText = Guid.NewGuid().ToString();

            // MonitoringRef...
            root.SelectSingleNode("descendant::siri:MonitoringRef", nsmgr).InnerText = naptanId;

            return new StringContent(xmlDocument.OuterXml,
                Encoding.UTF8,
                "application/xml"
                );
        }

    }

    class BusStopArrival
    {
        public string? lineName { get; set; }
        public string? destinationName { get; set; }
        public int? timeToStation { get; set; }
        public string? stationName { get; set; }
        public string? naptanId { get; set; }
        public string? timestamp { get; set; }
        public bool? liveData { get; set; }
        public string? src { get; set; }
    }
}
