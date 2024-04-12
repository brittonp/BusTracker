using Microsoft.AspNetCore.Mvc;
using BusTrackerServices.Data;
using System.Runtime.CompilerServices;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;
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
            // Insert record into session db table...
            int sessionId = _sqlData.CreateSession();
            HttpContext.Session.SetInt32("SessionId", sessionId);

            JObject result = new JObject(
                new JProperty("sessionId", sessionId),
                new JProperty("environment", _configuration["ASPNETCORE_ENVIRONMENT"]),
                new JProperty("googleMapKey", _configuration["GoogleMapKey"])
                ) ;

            return new JsonResult(result.ToString());
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
