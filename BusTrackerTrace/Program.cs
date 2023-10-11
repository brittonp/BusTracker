using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Xml;
using BusTrackerServices.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Data.SqlTypes;

namespace BusTrackerServices.Trace
{
    enum TraceStatus
    {
        Running,
        Completed,
        Failed
    }

    class Program
    {

        private static IConfiguration? _configuration;
        private static ILogger? _logger;

        static void Main(string[] args)
        {
            // configure logging...
            using var loggerFactory = LoggerFactory.Create(builder =>
            {
                builder
                    .AddEventLog(eventLogSettings =>
                    {
                        eventLogSettings.SourceName = "BusTracker";

                    });
            });
            ILogger logger = loggerFactory.CreateLogger<Program>();
            _logger = logger;

            // Retrieve secrets and to configuration...
            try
            {
                var configuration = new ConfigurationBuilder()
                    .AddUserSecrets<Program>()
                    .Build();
                _configuration = configuration;

            }
            catch (Exception ex)
            {
                // send exception to logs...
                _logger.LogError(999, ex, "Error.");
            }

            try
            {
                JsonResult jsonResult;
                jsonResult = GetData("&operatorRef=TFLO&lineRef=512");

                // Use Newtonsoft as it is cleaner to navigate down the JSON to section of interest...
                JObject jObject = JObject.Parse(jsonResult.Value.ToString());
                VehicleActivity[] vehicleActivity = jObject["Siri"]["ServiceDelivery"]["VehicleMonitoringDelivery"]["VehicleActivity"].ToObject<VehicleActivity[]>();

                AddTraceData(vehicleActivity);
            }
            catch (Exception ex)
            {
                // send exception to logs...
                _logger.LogError(999, ex, "Error.");
            }

        }

        private static JsonResult GetData(string queryString)
        {
            string jsonString;
            JsonResult myJson;

            // get the url to the data provider from appsettings.json...
            string baseDftUri = _configuration["BusOpenDataFeed"];

            string dftUri = $"{baseDftUri}{queryString}";

            XmlDocument xmlDoc = new XmlDocument();

            DateTime requestTimestamp = DateTime.UtcNow;

            _logger.LogInformation(999, "Request {URI} submitted at {DT}.", dftUri, requestTimestamp.ToLongTimeString());

            try
            {
                xmlDoc.Load(dftUri);
                //throw new Exception("Test exception");
            }
            catch (Exception ex)
            {
                _logger.LogError(999, ex, "Request {URI} failed.", dftUri);
                JsonResult jsonResult = new JsonResult(ex.Message);
                jsonResult.StatusCode = 500;

                return jsonResult;
            }

            DateTime responseTimestamp = DateTime.UtcNow;
            TimeSpan ts = responseTimestamp - requestTimestamp;
            _logger.LogInformation(999, "Response {URI} received at {DT}, duration {TS} milliseconds.", dftUri, responseTimestamp.ToLongTimeString(), ts.TotalMilliseconds);

            jsonString = JsonConvert.SerializeXmlNode(xmlDoc);

            myJson = new JsonResult(jsonString);

            return myJson;
        }

        private static void AddTraceData(VehicleActivity[] vehicleActivity)
        {

            string connectionString = _configuration["ConnectionStrings:BusTrackerDb"];

            using (SqlConnection conn = new SqlConnection(connectionString))
            {
                conn.Open();

                // Insert trace data record...
                string sql = "INSERT INTO dbo.trace_data (recorded_at_time, item_identifier, valid_until, operator_ref, line_ref, vehicle_ref, vehicle_journey_ref, direction_ref, published_line_name, ";
                sql += "origin_ref, origin_name, destination_ref, destination_name, origin_aimed_departure_time, location_latitude, location_longitude) ";
                sql += "VALUES (@recordedAtTime, @itemIdentifier, @validUntil, @operatorRef, @lineRef, @vehicleRef, @vehicleJourneyRef, @directionRef, @publishedLineName, ";
                sql += "@originRef, @originName, @destinationRef, @destinationName, @originAimedDepartureTime, @locationLatitude, @locationLongitude);";
                using (SqlCommand sqlCmd = new SqlCommand(sql, conn))
                {
                    //Insert trace data records...
                    foreach (VehicleActivity va in vehicleActivity)
                    {
                        sqlCmd.Parameters.Clear();
                        sqlCmd.Parameters.AddWithValue("@recordedAtTime", va.RecordedAtTime);
                        sqlCmd.Parameters.AddWithValue("@itemIdentifier", va.ItemIdentifier);
                        sqlCmd.Parameters.AddWithValue("@validUntil", va.ValidUntilTime);
                        sqlCmd.Parameters.AddWithValue("@operatorRef", va.MonitoredVehicleJourney.OperatorRef);
                        sqlCmd.Parameters.AddWithValue("@lineRef", va.MonitoredVehicleJourney.LineRef);
                        sqlCmd.Parameters.AddWithValue("@vehicleRef", va.MonitoredVehicleJourney.VehicleRef);
                        sqlCmd.Parameters.AddWithValue("@vehicleJourneyRef", va.MonitoredVehicleJourney.VehicleJourneyRef);
                        sqlCmd.Parameters.AddWithNullableValue("@directionRef", va.MonitoredVehicleJourney.DirectionRef);
                        sqlCmd.Parameters.AddWithNullableValue("@publishedLineName", va.MonitoredVehicleJourney.PublishedLineName);
                        sqlCmd.Parameters.AddWithNullableValue("@originRef", va.MonitoredVehicleJourney.OriginRef);
                        sqlCmd.Parameters.AddWithNullableValue("@originName", va.MonitoredVehicleJourney.OriginName);
                        sqlCmd.Parameters.AddWithNullableValue("@destinationRef", va.MonitoredVehicleJourney.DestinationRef);
                        sqlCmd.Parameters.AddWithNullableValue("@destinationName", va.MonitoredVehicleJourney.DestinationName);
                        sqlCmd.Parameters.AddWithNullableValue("@originAimedDepartureTime", va.MonitoredVehicleJourney.OriginAimedDepartureTime);
                        sqlCmd.Parameters.AddWithNullableValue("@locationLatitude", va.MonitoredVehicleJourney.VehicleLocation.Latitude);
                        sqlCmd.Parameters.AddWithNullableValue("@locationLongitude", va.MonitoredVehicleJourney.VehicleLocation.Longitude);

                        try
                        {
                            sqlCmd.ExecuteNonQuery();
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(999, ex, "On inserting records into dbo.trace_data.");
                            return;
                        }
                    }
                }
            }

            _logger.LogInformation(999, "Inserted {0} records into dbo.trace_data.", vehicleActivity.Length);
        }
    }
}

