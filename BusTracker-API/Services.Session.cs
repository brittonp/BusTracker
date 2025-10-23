using BusTrackerAPI.Data;
using Microsoft.AspNetCore.Routing;

namespace BusTrackerAPI.Services
{

    public interface ISession
    {
        Task<object> PingDatabase();
        Task<object> CreateSession();
        Task<object> GetRecentSessions();
        Task<object> GetSessionHistory(int sessionId);
    }

        public class Session: ISession
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

        public async Task<object> PingDatabase()
        {
            // Ping database...
            var json = await _sqlData.PingDatabase();
            return json;
        }

        public async Task<object> CreateSession()
        {
            int sessionId = 0;
            // Insert record into session db table...
            if (_configuration["USE_DATABASE"] == "true")
            {
                sessionId = await _sqlData.CreateSession();
            }

            _logger.LogInformation(4001, "Session initiated");

            return new
            {
                sessionId = sessionId,
                environment = _configuration["ASPNETCORE_ENVIRONMENT"],
                useDatabase = _configuration["USE_DATABASE"],
                //googleMapKey = _configuration["GoogleMapKey"],
                startMessage = _configuration["SessionStartMessage"],
                //mapProvider = _configuration["MapProvider"],
                thunderforestMapKey = _configuration["ThunderforestMapKey"],
                //busTrackerMapKey = _configuration["BusTrackerMapKey"],
            }; ;
        }

        public async Task<object> GetRecentSessions()
        {
            // Query all session records...
            var json = await _sqlData.GetRecentSessions();

            return json;
        }

        public async Task<object> GetSessionHistory(int sessionId)
        {
            // Query all session records...
            var json = await _sqlData.GetSessionHistory(sessionId);

            return json;
        }
    }
}
