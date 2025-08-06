using BusTrackerServices.Data;
using BusTrackerServices.Models;
using System.Net;
using System.Text;
using System.Xml.Linq;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace BusTrackerServices.Services
{
    public interface IBusLocation
    {
        Task<IEnumerable<object>> Get(
            string? operatorRef,
            string? lineRef,
            string? boundingBox,
            string? vehicleRef
        );
    }

    public class BusLocation : IBusLocation
{
        private readonly IConfiguration _configuration;
        private readonly ILogger<BusStop> _logger;
        private readonly ISqlData _sqlData;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IHttpContextAccessor _httpContextAccessor;

        private readonly OperatorCache _operatorsCache;

        public BusLocation(
            IConfiguration configuration,
            ILogger<BusStop> logger,
            ISqlData sqlData,
            IHttpClientFactory httpClientFactory,
            IHttpContextAccessor httpContextAccessor,
            OperatorCache operatorsCache)
        {
            _configuration = configuration;
            _logger = logger;
            _sqlData = sqlData;
            _httpClientFactory = httpClientFactory;
            _httpContextAccessor = httpContextAccessor;
            _operatorsCache = operatorsCache;
        }

        public async Task<IEnumerable<object>> Get(
            string? operatorRef,
            string? lineRef,
            string? boundingBox,
            string? vehicleRef
            )
        {
            string? baseDftUri = _configuration["BT_OpenData:Location_Feed_URL"];
            XNamespace ns = _configuration["BT_OpenData:Siri_Namespace"] ?? "http://www.siri.org.uk/siri";
            string response = string.Empty;

            var qs = new StringBuilder();

            qs.Append(!string.IsNullOrEmpty(operatorRef) ? $"&operatorRef={Uri.EscapeDataString(operatorRef)}" : string.Empty);
            qs.Append(!string.IsNullOrEmpty(lineRef) ? $"&lineRef={Uri.EscapeDataString(lineRef)}" : string.Empty);
            qs.Append(!string.IsNullOrEmpty(boundingBox) ? $"&boundingBox={Uri.EscapeDataString(boundingBox)}" : string.Empty);
            qs.Append(!string.IsNullOrEmpty(vehicleRef) ? $"&vehicleRef={Uri.EscapeDataString(vehicleRef)}" : string.Empty);

            // if no parameters have been supplied then throw an error...
            if (qs.Length == 0)
                throw new Exception("No parameters, at least one must be supplied");

            string queryString = qs.ToString();
            string uri = $"{baseDftUri}{queryString}";
            using HttpClient client = _httpClientFactory.CreateClient();

            try
            {
                response = await client.GetStringAsync(uri);
            }
            catch (HttpRequestException e) when (e.StatusCode == HttpStatusCode.NotFound)
            {
                // ignore if no data is returned...
                return [];
            }
            catch (HttpRequestException e)
            {
                _logger.LogError(999, e, $"Exception: {e.Message}");
                throw;
            }

            XDocument doc = XDocument.Parse(response);

            // Get Operators...
            List<Operator> operators = await _operatorsCache.GetData();

            var vehicles = doc
                .Descendants(ns + "VehicleActivity")
                // Ignore any buses with no lat/lng...
                .Where(r => ((float?)(r.Descendants(ns + "Latitude").FirstOrDefault()) != 0) && (float?)(r.Descendants(ns + "Longitude").FirstOrDefault()) != 0)
                .Join(operators,
                    r => (string?)r.Descendants(ns + "OperatorRef").FirstOrDefault(),
                    o => o.OperatorRef,
                    (r, o) => {
                        DateTime timestamp = (DateTime?)r.Descendants(ns + "RecordedAtTime").FirstOrDefault() ?? DateTime.Now.Subtract(TimeSpan.FromHours(1));

                        int directionCode;
                        switch ((string?)r.Descendants(ns + "DirectionRef").FirstOrDefault())
                        {
                            case "2":
                            case "in":
                            case "inbound":
                                directionCode = 2;
                                break;
                            case "outbound":
                            case "out":
                            case "1":
                            default:
                                directionCode = 1;
                                break;
                        };

                        return new
                        {
                            lineRef = (string?)r.Descendants(ns + "LineRef").FirstOrDefault(),
                            directionRef = (string?)r.Descendants(ns + "DirectionRef").FirstOrDefault(),
                            publishedLineName = (string?)r.Descendants(ns + "PublishedLineName").FirstOrDefault(),
                            operatorRef = (string?)r.Descendants(ns + "OperatorRef").FirstOrDefault(),
                            operatorName = (string?)o.OperatorName,
                            originName = (string?)r.Descendants(ns + "OriginName").FirstOrDefault(),
                            destinationName = (string?)r.Descendants(ns + "DestinationName").FirstOrDefault(),
                            vehicleRef = (string?)r.Descendants(ns + "VehicleRef").FirstOrDefault(),
                            originAimedDepartureTime = ((DateTime?)r.Descendants(ns + "OriginAimedDepartureTime").FirstOrDefault())?.ToString("yyyy-MM-ddTHH:mm:ssZ") ?? string.Empty,
                            timestamp = ((DateTime?)r.Descendants(ns + "RecordedAtTime").FirstOrDefault())?.ToString("yyyy-MM-ddTHH:mm:ssZ") ?? string.Empty,
                            bearing = (int?)(r.Descendants(ns + "Bearing").FirstOrDefault()),
                            latitude = (float?)(r.Descendants(ns + "Latitude").FirstOrDefault()),
                            longitude = (float?)(r.Descendants(ns + "Longitude").FirstOrDefault()),
                            aged = (DateTime.Now - timestamp).TotalHours > 1,
                            directionCode
                        };
                    }
                )
                .ToArray();

            return vehicles;
        }
    }
}
