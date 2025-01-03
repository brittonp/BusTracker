using Microsoft.AspNetCore.Mvc;
using BusTrackerServices.Data;
using System.Runtime.CompilerServices;
//using Newtonsoft.Json.Linq;
//using Newtonsoft.Json;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Unicode;


namespace BusTrackerServices.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class SessionController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<SessionController> _logger;
        private readonly ISqlData _sqlData;

        public SessionController(
            IConfiguration configuration, 
            ILogger<SessionController> logger,
            ISqlData sqlData)
        {
            _configuration = configuration;
            _logger = logger;
            _sqlData = sqlData;
        }

        [HttpGet("Create")]
        public JsonResult? Create()
        {
            int sessionId = 0;
            // Insert record into session db table...
            if (_configuration["USE_DATABASE"] == "true")
            {
                sessionId = _sqlData.CreateSession();
            }

            //JObject result1 = new JObject(
            //    new JProperty("sessionId", sessionId),
            //    new JProperty("environment", _configuration["ASPNETCORE_ENVIRONMENT"]),
            //    new JProperty("googleMapKey", _configuration["GoogleMapKey"])
            //    );

            var result = new 
            {
                sessionId = sessionId,
                environment = _configuration["ASPNETCORE_ENVIRONMENT"],
                googleMapKey = _configuration["GoogleMapKey"],
                startMessage = _configuration["SessionStartMessage"],
                mapProvider = _configuration["MapProvider"],
                thunderforestMapKey = _configuration["ThunderforestMapKey"],
                busTrackerMapKey = _configuration["BusTrackerMapKey"],
            };

            _logger.LogWarning(4001, "Session initiated");

            return new JsonResult(result);
        }

        [HttpGet("GetRecent")]
        public JsonResult? GetRecent()
        {
            // Query all session records...
            string? strJson = _sqlData.GetRecentSessions();

            return new JsonResult(strJson);
        }

        [HttpGet("GetSessionHistory")]
        public JsonResult? GetSessionHistory(
            int sessionId)
        {
            // Query all session records...
            string? strJson = _sqlData.GetSessionHistory(sessionId);

            return new JsonResult(strJson);
        }

    }


}
