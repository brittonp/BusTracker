using BusTrackerServices.Controllers;
using BusTrackerServices.Data;
using Microsoft.AspNetCore.Mvc;

namespace BusTrackerServices.Services
{
    public class Session
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<Session> _logger;
        private readonly ISqlData _sqlData;

        public Session(
            IConfiguration configuration,
            ILogger<Session> logger,
            ISqlData sqlData)
        {
            _configuration = configuration;
            _logger = logger;
            _sqlData = sqlData;
        }

        public async Task<JsonResult> Create()
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

        public JsonResult? GetRecent()
        {
            // Query all session records...
            string? strJson = _sqlData.GetRecentSessions();

            return new JsonResult(strJson);
        }

        public JsonResult? GetSessionHistory(
            int sessionId)
        {
            // Query all session records...
            string? strJson = _sqlData.GetSessionHistory(sessionId);

            return new JsonResult(strJson);
        }
    }
}
