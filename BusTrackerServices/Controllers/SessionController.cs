using Microsoft.AspNetCore.Mvc;
using BusTrackerServices.Data;
using System.Runtime.CompilerServices;


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

        [HttpGet]
        public int CreateSession()
        {
            // Insert record into session db table...
            int sessionId = _sqlData.CreateSession();
            HttpContext.Session.SetInt32("SessionId", sessionId);

            return sessionId;
        }

    }


}
