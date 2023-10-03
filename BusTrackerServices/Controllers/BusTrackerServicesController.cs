using Microsoft.AspNetCore.Mvc;
using System.Xml;
using Newtonsoft.Json;
using BusTrackerServices.Models;
using System.Text;
using System.Diagnostics;
using Microsoft.Data.SqlClient;
using Newtonsoft.Json.Linq;

namespace BusTrackerServices.Controllers
{
    enum TraceStatus
    {
        Running,
        Completed,
        Failed
    }


    [ApiController]
    [Route("[controller]")]
    public class BusLocationDataController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<BusLocationDataController> _logger;

        public BusLocationDataController(
            IConfiguration configuration, 
            ILogger<BusLocationDataController> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        [HttpGet("TraceRunner")]
        public string TraceRunner()
        {
            string json;
            JsonResult jsonResult;

            Debug.WriteLine("Application thread ID: {0}",Thread.CurrentThread.ManagedThreadId);

            int traceId = StartTrace(Thread.CurrentThread.ManagedThreadId);

            // Use Task.Run to start a trace task...
            var task = Task.Run(() =>
            {
                Debug.WriteLine("Task thread ID: {0}", Thread.CurrentThread.ManagedThreadId);

                int durationMins = 60*10;
                int periodMins = 2;

                DateTime endTime = DateTime.Now.AddMinutes(durationMins);

                Debug.WriteLine("Starting, will end {0}", endTime);

                //for (int i = 0; i < 3; i++)
                int i = 0;
                while (DateTime.Now < endTime)
                {
                    i++;

                    try
                    {
                        jsonResult = GetData("&operatorRef=TFLO&lineRef=512");

                        // Use Newtonsoft as it is cleaner to navigate down the JSON to section of interest...
                        JObject jObject = JObject.Parse(jsonResult.Value.ToString());
                        VehicleActivity[] vehicleActivity = jObject["Siri"]["ServiceDelivery"]["VehicleMonitoringDelivery"]["VehicleActivity"].ToObject<VehicleActivity[]>();

                        AddTraceData(traceId, vehicleActivity);
                    }
                    catch (Exception ex)
                    {
                        UpdateTrace(traceId, TraceStatus.Failed, Thread.CurrentThread.ManagedThreadId);
                        _logger.LogError(999, ex, "Trace failed.");
                        return;
                    }

                    Debug.WriteLine("{0} : Sleep for {1} minutes!", i, periodMins);

                    UpdateTrace(traceId, TraceStatus.Running, Thread.CurrentThread.ManagedThreadId);
                    Thread.Sleep(periodMins*60*1000);
                }

                UpdateTrace(traceId, TraceStatus.Completed, Thread.CurrentThread.ManagedThreadId);

            });

            //task.Wait();

            Debug.WriteLine("Done");

            return task.Status.ToString();
        }

        private int StartTrace(int primaryThread)
        {
            int traceId;
            string connectionString = _configuration["ConnectionStrings:BusTrackerDb"];

            using (SqlConnection conn = new SqlConnection(connectionString))
            {
                conn.Open();

                // Insert trace master record...
                string sql = "INSERT INTO dbo.trace_job (status, primary_thread) VALUES (@status, @primaryThread);SELECT CAST(SCOPE_IDENTITY() AS INT);";
                using (SqlCommand sqlCmd = new SqlCommand(sql, conn))
                {
                    sqlCmd.Parameters.AddWithValue("@status", TraceStatus.Running.ToString());
                    sqlCmd.Parameters.AddWithValue("@primaryThread", primaryThread);

                    //get traceId...
                    traceId = (int)sqlCmd.ExecuteScalar();
                }
            }
            return traceId;
        }

        private void UpdateTrace(int traceId, TraceStatus status, int taskThread)
        {
            string connectionString = _configuration["ConnectionStrings:BusTrackerDb"];

            using (SqlConnection conn = new SqlConnection(connectionString))
            {
                conn.Open();

                // Update trace master record...
                string sql = "UPDATE dbo.trace_job SET status = @status, task_thread = @taskThread, updated= GETDATE() WHERE id = @traceId";
                using (SqlCommand sqlCmd = new SqlCommand(sql, conn))
                {
                    sqlCmd.Parameters.AddWithValue("@traceId", traceId);
                    sqlCmd.Parameters.AddWithValue("@status", status.ToString());
                    sqlCmd.Parameters.AddWithValue("@taskThread", taskThread);
                    sqlCmd.ExecuteNonQuery();
                }
            }
        }

        private void AddTraceData(int traceId, VehicleActivity[] vehicleActivity)
        {
            string connectionString = _configuration["ConnectionStrings:BusTrackerDb"];

            using (SqlConnection conn = new SqlConnection(connectionString))
            {
                conn.Open();

                // Insert trace data record...
                string sql = "INSERT INTO dbo.trace_step (trace_id) VALUES (@traceId);SELECT CAST(SCOPE_IDENTITY() AS INT);";
                using (SqlCommand sqlCmd = new SqlCommand(sql, conn))
                {

                    // Insert trace step record...
                    sqlCmd.Parameters.AddWithValue("@traceId", traceId);

                    //get traceId...
                    int traceStepId = (int)sqlCmd.ExecuteScalar();

                    // Insert trace data record...
                    sqlCmd.Parameters.Clear();
                    sql = "INSERT INTO dbo.trace_data (trace_id, trace_step_id, recorded_at_time, item_identifier, valid_until, operator_ref, line_ref, vehicle_ref, vehicle_journey_ref, direction_ref, published_line_name, ";
                    sql += "origin_ref, origin_name, destination_ref, destination_name, origin_aimed_departure_time, location_latitude, location_longitude) ";
                    sql += "VALUES (@traceId, @traceStepId, @recordedAtTime, @itemIdentifier, @validUntil, @operatorRef, @lineRef, @vehicleRef, @vehicleJourneyRef, @directionRef, @publishedLineName, ";
                    sql += "@originRef, @originName, @destinationRef, @destinationName, @originAimedDepartureTime, @locationLatitude, @locationLongitude);";
                    sqlCmd.CommandText = sql;

                    //Insert trace data records...
                    foreach (VehicleActivity va in vehicleActivity)
                    {
                        sqlCmd.Parameters.Clear();
                        sqlCmd.Parameters.AddWithValue("@traceId", traceId);
                        sqlCmd.Parameters.AddWithValue("@traceStepId", traceStepId);
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
                            _logger.LogError(999, ex, "Insert failed.");
                            return;
                        }
                    }
                }
            }
        }

        [HttpGet]
        public JsonResult Get()
        {
            string queryString = $"&{(HttpContext.Request.QueryString).ToString().Substring(1)}";
            return GetData(queryString);
        }

        [HttpGet("operatorRef-lineRef-boundingBox")]
        public JsonResult Get(
            string operatorRef,
            string lineRef,
            string boundingBox)
        {
            string queryString = $"&{(HttpContext.Request.QueryString).ToString().Substring(1)}";
            return GetData(queryString);
        }

        [HttpGet("operatorRef-lineRef")]
        public JsonResult Get(
            string operatorRef,
            string lineRef)
        {
            string queryString = $"&{(HttpContext.Request.QueryString).ToString().Substring(1)}";
            return GetData(queryString);
        }

        [HttpGet("operatorRef")]
        public JsonResult Get(
            string operatorRef)
        { 
            string queryString = $"&{(HttpContext.Request.QueryString).ToString().Substring(1)}";
            return GetData(queryString);
        }

        [HttpPost]
        public JsonResult Post(BusDataQuery query)
        { 
            string queryString = ToQueryString(query);
            return GetData(queryString);
        }

        private JsonResult GetData(string queryString)
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

        private string ToQueryString(object obj)
        {

            var qs = new StringBuilder();

            var objType = obj.GetType();

            var properties = objType.GetProperties();

            foreach (var prop in properties)
            {
                var name = prop.Name;
                var value = prop.GetValue(obj).ToString();
                
                qs.Append($"&{Uri.EscapeDataString(name)}={Uri.EscapeDataString(value)}");
            }
            return qs.ToString();
        }

    }


}
