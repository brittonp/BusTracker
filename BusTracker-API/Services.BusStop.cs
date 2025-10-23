using BusTrackerAPI.Data;
using System.Collections.Generic;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Xml;
using System.Xml.Linq;

namespace BusTrackerAPI.Services
{
    public interface IBusStop
    {
        Task<object> GetByAtcoCode(
            string atcoCode
        );

        Task<object> GetByBoundingBox(
            double north,
            double east,
            double south,
            double west
        );

        Task<object> GetArrivals(
            string naptanId
        );
    }

    public class BusStop: IBusStop
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<BusStop> _logger;
        private readonly ISqlData _sqlData;
        private readonly IHttpClientFactory _httpClientFactory;

        public BusStop(
            IConfiguration configuration,
            ILogger<BusStop> logger,
            ISqlData sqlData,
            IHttpClientFactory httpClientFactory)
        {
            _configuration = configuration;
            _logger = logger;
            _sqlData = sqlData;
            _httpClientFactory = httpClientFactory;
        }

        public async Task<object> GetByAtcoCode(
            string atcoCode
        )
        {
            var json = await _sqlData.GetBusStopsByAtcoCode(atcoCode);
            return json;
        }

        public async Task<object> GetByBoundingBox(
            double north,
            double east,
            double south,
            double west
        )
        {
            var json = await _sqlData.GetBusStopsByBoundingBox(north, east, south, west);
            return json;
        }

        public async Task<object> GetArrivals(string naptanId)
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
            }
            else
            {
                arrivalsTravelineFiltered = arrivalsTraveline;
            }

            // merge the TFL and the filtered Traveline arrivals...
            IEnumerable<BusStopArrival> mergedArrivals = [
                .. arrivalsTfl,
                .. arrivalsTravelineFiltered
            ];

            return mergedArrivals.ToArray();
        }

        private async Task<IEnumerable<BusStopArrival>?> GetTflAsync(
            string naptanId
        )
        {
            var baseUrl = _configuration["BT_Tfl:Next_Bus_URL"] ?? string.Empty;
            string uri = string.Format(baseUrl, naptanId);
            string response = "";

            using HttpClient client = _httpClientFactory.CreateClient("Tfl");

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

            var jsonArray = JsonSerializer.Deserialize<JsonElement[]>(response) ?? Array.Empty<JsonElement>();

            var arrivals = jsonArray
                .Select(r => new BusStopArrival
                {
                    lineName = r.GetProperty("lineName").GetString(),
                    destinationName = r.GetProperty("destinationName").GetString(),
                    timeToStation = r.GetProperty("timeToStation").GetInt32(),
                    stationName = r.GetProperty("stationName").GetString(),
                    naptanId = r.GetProperty("naptanId").GetString(),
                    timestamp = r.GetProperty("timestamp").GetString(),
                    liveData = (bool)true,
                    src = "TFL"
                }).ToArray();

            return arrivals;
        }

        private async Task<IEnumerable<BusStopArrival>> GetTravelineAsync(
            string naptanId
        )
        {
            //IEnumerable<BusStopArrival> nullTravelLine = [];
            //return nullTravelLine;

            string? uri = _configuration["BT_Traveline:Next_Bus_URL"];
            XNamespace ns = _configuration["BT_Traveline:Siri_Namespace"] ?? string.Empty;
            string response = String.Empty;

            var authenticationString = $"{_configuration["BT_Traveline:Requestor_Ref"]}:{_configuration["BT_Traveline:Requestor_Pwd"]}";
            var base64EncodedAuthenticationString = Convert.ToBase64String(System.Text.ASCIIEncoding.ASCII.GetBytes(authenticationString));
            var header = new AuthenticationHeaderValue("Basic", base64EncodedAuthenticationString);

            using HttpClient client = _httpClientFactory.CreateClient("Traveline");
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

            XDocument doc = XDocument.Parse(response);

            var arrivals = doc.Descendants(ns + "MonitoredStopVisit")
                .Select(r =>
                {
                    bool liveData = (string?)r.Descendants(ns + "ExpectedDepartureTime").FirstOrDefault() != null;

                    TimeSpan? timeSpan = (DateTime?)r.Descendants(ns + "AimedDepartureTime").FirstOrDefault() - (DateTime?)r.Descendants(ns + "RecordedAtTime").FirstOrDefault();
                    int timeToStation = (int)(timeSpan?.TotalSeconds ?? 0);

                    return new BusStopArrival
                    {
                        lineName = (string?)r.Descendants(ns + "PublishedLineName").FirstOrDefault(),
                        destinationName = (string?)r.Descendants(ns + "DirectionName").FirstOrDefault(),
                        timeToStation = timeToStation,
                        stationName = string.Empty,
                        naptanId = (string?)r.Descendants(ns + "MonitoringRef").FirstOrDefault(),
                        timestamp = ((DateTime?)r.Descendants(ns + "RecordedAtTime").FirstOrDefault())?.ToString("yyyy-MM-ddTHH:mm:ssZ") ?? string.Empty,
                        liveData = liveData,
                        src = "Traveline"
                    };
                }
                )
                .ToArray();

            return arrivals;
        }

        private StringContent TravelineRequestContent(string naptanId)
        {
            // Load XML file using XDocument
            string filePath = _configuration["BT_Traveline:Request_Content_File_Path"] ?? string.Empty;
            XDocument xmlDocument = XDocument.Load(filePath);

            // Define the XML namespace
            XNamespace siriNs = _configuration["BT_Traveline:Siri_Namespace"] ?? string.Empty;

            // Get root element
            XElement root = xmlDocument.Root;

            if (root != null)
            {
                // Update RequestorRef
                XElement? requestorRef = root.Descendants(siriNs + "RequestorRef").FirstOrDefault();
                if (requestorRef != null)
                {
                    requestorRef.Value = _configuration["BT_Traveline:Requestor_Ref"] ?? string.Empty;
                }

                // Update RequestTimestamp
                string requestTimestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
                foreach (XElement timestamp in root.Descendants(siriNs + "RequestTimestamp"))
                {
                    timestamp.Value = requestTimestamp;
                }

                // Update MessageIdentifier
                XElement? messageIdentifier = root.Descendants(siriNs + "MessageIdentifier").FirstOrDefault();
                if (messageIdentifier != null)
                {
                    messageIdentifier.Value = Guid.NewGuid().ToString();
                }

                // Update MonitoringRef
                XElement? monitoringRef = root.Descendants(siriNs + "MonitoringRef").FirstOrDefault();
                if (monitoringRef != null)
                {
                    monitoringRef.Value = naptanId;
                }
            }

            // Convert updated XML to string and return as StringContent
            return new StringContent(xmlDocument.ToString(), Encoding.UTF8, "application/xml");
        }

        //private StringContent TravelineRequestContent1(string naptanId)
        //{
        //    // Get request body XML...
        //    XmlDocument xmlDocument = new XmlDocument();
        //    xmlDocument.Load(_configuration["BT_Traveline:Request_Content_File_Path"] ?? string.Empty);

        //    // Set values...
        //    XmlNamespaceManager nsmgr = new XmlNamespaceManager(xmlDocument.NameTable);
        //    nsmgr.AddNamespace("siri", _configuration["BT_Traveline:Siri_Namespace"] ?? string.Empty);
        //    XmlElement? root = xmlDocument.DocumentElement;

        //    // RequestorRef...
        //    root.SelectSingleNode("descendant::siri:RequestorRef", nsmgr).InnerText = _configuration["BT_Traveline:Requestor_Ref"] ?? String.Empty;

        //    // RequestTimestamp...
        //    string requestTimestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
        //    foreach (XmlNode node in root.SelectNodes("descendant::siri:RequestTimestamp", nsmgr))
        //    {
        //        node.InnerText = requestTimestamp;
        //    }

        //    // MessageIdentifier...
        //    root.SelectSingleNode("descendant::siri:MessageIdentifier", nsmgr).InnerText = Guid.NewGuid().ToString();

        //    // MonitoringRef...
        //    root.SelectSingleNode("descendant::siri:MonitoringRef", nsmgr).InnerText = naptanId;

        //    return new StringContent(xmlDocument.OuterXml,
        //        Encoding.UTF8,
        //        "application/xml"
        //        );
        //}
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
