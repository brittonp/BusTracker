using Microsoft.AspNetCore.Mvc;
using BusTrackerServices.Data;
using System.Runtime.CompilerServices;
using Newtonsoft.Json.Linq;
//using Newtonsoft.Json;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Unicode;
using BusTrackerServices.Models;


namespace BusTrackerServices.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class AdminController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<AdminController> _logger;
        private readonly ISqlData _sqlData;

        public AdminController(
            IConfiguration configuration, 
            ILogger<AdminController> logger,
            ISqlData sqlData)
        {
            _configuration = configuration;
            _logger = logger;
            _sqlData = sqlData;
        }


        [HttpGet("GetAllSystemParameters")]
        public JsonResult? GetAllSystemParameters()
        {
            // Query all session records...
            string? strJson = _sqlData.GetAllSystemParameters();

            return new JsonResult(strJson);
        }

        [HttpGet("GetSystemParameter")]
        public JsonResult? GetSystemParameter(
            string parameterName)
        {
            // Query all session records...
            string? strJson = _sqlData.GetSystemParameter(parameterName);

            return new JsonResult(strJson);
        }

        [HttpPost("UpdateSystemParameter")]
        public JsonResult UpdateSystemParameter(SystemParameter systemParameter)
        {
            // Set the updated_by...
            systemParameter.updated_by = this.HttpContext.User.Identity.Name ?? "Unknown";

            string? strJson = _sqlData.UpdateSystemParameter(systemParameter);

            //JsonSerializer.Serialize - Microsoft
            //JsonConvert.SerializeObject - Newtonsoft
            return new JsonResult(strJson);
        }

        [HttpGet("Ping")]
        public JsonResult? Ping()
        {

            var result = new
            {
                live = true,
            };

            return new JsonResult(result);
        }
    }


}
