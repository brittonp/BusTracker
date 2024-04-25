using Microsoft.AspNetCore.Mvc;
using System.Xml;
using Newtonsoft.Json;
using BusTrackerServices.Models;
using BusTrackerServices.Data;
using System.Text;
using Microsoft.AspNetCore.Http;


namespace BusTrackerServices.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class BusLocationDataController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<BusLocationDataController> _logger;
        private readonly ISqlData _sqlData;

        public BusLocationDataController(
            IConfiguration configuration, 
            ILogger<BusLocationDataController> logger,
            ISqlData sqlData)
        {
            _configuration = configuration;
            _logger = logger;
            _sqlData = sqlData;
        }

        [HttpGet]
        public JsonResult Get()
        {
            string queryString = $"&{(HttpContext.Request.QueryString).ToString().Substring(1)}";
            return GetData(_configuration["BusOpenDataFeed"] ?? "", queryString, SqlData.Event.LocationQuery);
        }

        [HttpGet("operatorRef-lineRef-boundingBox")]
        public JsonResult Get(
            string operatorRef,
            string lineRef,
            string boundingBox)
        {
            string queryString = $"&{(HttpContext.Request.QueryString).ToString().Substring(1)}";
            return GetData(_configuration["BusOpenDataFeed"] ?? "", queryString, SqlData.Event.LocationQuery);
        }

        [HttpGet("operatorRef-lineRef")]
        public JsonResult Get(
            string operatorRef,
            string lineRef)
        {
            string queryString = $"&{(HttpContext.Request.QueryString).ToString().Substring(1)}";
            return GetData(_configuration["BusOpenDataFeed"] ?? "", queryString, SqlData.Event.LocationQuery);
        }

        [HttpGet("operatorRef")]
        public JsonResult Get(
            string operatorRef)
        { 
            string queryString = $"&{(HttpContext.Request.QueryString).ToString().Substring(1)}";
            return GetData(_configuration["BusOpenDataFeed"] ?? "", queryString, SqlData.Event.LocationQuery);
        }

        [HttpPost]
        public JsonResult Post(BusDataQuery query)
        { 
            string queryString = ToQueryString(query);
            return GetData(_configuration["BusOpenDataFeed"] ?? "", queryString, SqlData.Event.LocationQuery);
        }

        // Disruption Get call...
        [HttpGet("disruption")]
        public JsonResult GetDisruptions()
        {
            return GetData(_configuration["BusOpenDataDisruptionFeed"] ?? "", "", SqlData.Event.DisruptionQuery);
        }

        private JsonResult GetData(string baseDftUri, string queryString, SqlData.Event eventType)
        {
            string jsonString;
            JsonResult myJson;

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

            if (_configuration["USE_DATABASE"] == "true")
            {
                int? sessionId = HttpContext.Session.GetInt32("SessionId");
                sessionId = _sqlData.UpdateSession(sessionId, eventType);
                HttpContext.Session.SetInt32("SessionId", (int)sessionId);
            }

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
                string name = prop.Name;
                string value = prop.GetValue(obj).ToString() ?? "";  // if ToString return null, then take ""...
                
                qs.Append($"&{Uri.EscapeDataString(name)}={Uri.EscapeDataString(value)}");
            }
            return qs.ToString();
        }

    }


}
