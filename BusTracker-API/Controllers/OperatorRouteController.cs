using BusTrackerServices.Data;
using Microsoft.AspNetCore.Mvc;
using System.Xml;
using System.Text.Json;
using System.IO;
using Microsoft.AspNetCore.Hosting;
using Newtonsoft.Json.Serialization;
using System.Text.Unicode;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace BusTrackerServices.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class OperatorRouteController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<OperatorRouteController> _logger;
        private readonly ISqlData _sqlData;
        private readonly IWebHostEnvironment _env;

        public OperatorRouteController(
            IConfiguration configuration,
            ILogger<OperatorRouteController> logger,
            ISqlData sqlData,
            IWebHostEnvironment env
            )
        {
            _configuration = configuration;
            _logger = logger;
            _sqlData = sqlData;
            _env = env;
        }

        [HttpGet("Get")]
        //public JsonResult? Get()
        public string? Get()
        {
            string filePath = _configuration["BT_Operator_Routes_Json_File_Path"];
            _logger.LogInformation(4102, $"Operator Routes date source: {filePath}");

            string fileContents = System.IO.File.ReadAllText(filePath);

            _logger.LogInformation(4103, "Get Operator Routes completed");

            return fileContents;
        }

    }


}
