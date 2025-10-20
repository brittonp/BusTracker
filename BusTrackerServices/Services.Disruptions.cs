using BusTrackerServices.Data;
using BusTrackerServices.Models;
using System.Net;
using System.Xml.Linq;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace BusTrackerServices.Services
{
    public interface IDisruptions
    {
        Task<IEnumerable<object>> Get();
    }

    public class Disruptions : IDisruptions
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<Disruptions> _logger;
        private readonly ISqlData _sqlData;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IHttpContextAccessor _httpContextAccessor;

        private readonly OperatorCache _operatorsCache;

        public Disruptions(
            IConfiguration configuration,
            ILogger<Disruptions> logger,
            ISqlData sqlData,
            IHttpClientFactory httpClientFactory,
            IHttpContextAccessor httpContextAccessor)
        {
            _configuration = configuration;
            _logger = logger;
            _sqlData = sqlData;
            _httpClientFactory = httpClientFactory;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<IEnumerable<object>> Get()
        {
            string uri = _configuration["BusOpenDataDisruptionFeed"] ?? "";
            XNamespace ns = _configuration["BT_OpenData:Siri_Namespace"] ?? "http://www.siri.org.uk/siri";
            string response = string.Empty;


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

            var disruptions = doc
                .Descendants(ns + "PtSituationElement")
                // Only include those affecting bus operations...
                .Where(r => (string?)r.Descendants(ns + "VehicleMode").FirstOrDefault() == "bus")
                .Select(r => new
                {
                    participantRef = (string?)r.Descendants(ns + "ParticipantRef").FirstOrDefault(),
                    progress = (string?)r.Descendants(ns + "Progress").FirstOrDefault(),
                    vehicleMode = (string?)r.Descendants(ns + "VehicleMode").FirstOrDefault(),
                    MiscellaneousReason = (string?)r.Descendants(ns + "MiscellaneousReason").FirstOrDefault(),
                    summary = (string?)r.Descendants(ns + "Summary").FirstOrDefault(),
                    description = (string?)r.Descendants(ns + "Description").FirstOrDefault(),
                    creationTime = ((DateTime?)r.Descendants(ns + "CreationTime").FirstOrDefault())?.ToString("yyyy-MM-ddTHH:mm:ssZ") ?? string.Empty,
                    affectedStops = r.Descendants(ns + "StopPoints")
                        .Descendants(ns + "AffectedStopPoint")
                        .Select(s => new
                        {
                            stopPoint = (string?)s.Descendants(ns + "StopPointRef").FirstOrDefault()
                        })
                        .ToArray()
                })
                .ToArray();

            return disruptions;
        }
    }
}
