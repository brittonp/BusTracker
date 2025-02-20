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
        public async Task<JsonResult?> Create()
        {
            int sessionId = 0;
            // Insert record into session db table...
            if (_configuration["USE_DATABASE"] == "true")
            {
                sessionId = await _sqlData.CreateSession();
            }

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
        public async Task<JsonResult?> GetRecent()
        {
            // Query all session records...
            string? strJson = await _sqlData.GetRecentSessions();

            return new JsonResult(strJson);
        }

        [HttpGet("GetSessionHistory")]
        public async Task<JsonResult?> GetSessionHistory(
            int sessionId)
        {
            // Query all session records...
            string? strJson = await _sqlData.GetSessionHistory(sessionId);

            return new JsonResult(strJson);
        }

    }


}
