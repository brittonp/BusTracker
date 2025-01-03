using Microsoft.AspNetCore.Mvc;
using System.Xml;
using Newtonsoft.Json;
using BusTrackerServices.Models;
using BusTrackerServices.Data;
using System.Text;
using Microsoft.AspNetCore.Http;
using Azure;
using System.Net.Http;
using System;


namespace BusTrackerServices.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class BusLocationDataController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<BusLocationDataController> _logger;
        private readonly ISqlData _sqlData;
        private readonly IHttpClientFactory _httpClientFactory;

        public BusLocationDataController(
            IConfiguration configuration, 
            ILogger<BusLocationDataController> logger,
            ISqlData sqlData,
            IHttpClientFactory httpClientFactory
        )
        {
            _configuration = configuration;
            _logger = logger;
            _sqlData = sqlData;
            _httpClientFactory = httpClientFactory;
        }

        [HttpGet]
        public async Task<JsonResult> Get()
        {
            string queryString = $"&{(HttpContext.Request.QueryString).ToString().Substring(1)}";
            return await GetData(_configuration["BusOpenDataFeed"] ?? "", queryString, SqlData.Event.LocationQuery);
        }

        [HttpGet("operatorRef-lineRef-boundingBox")]
        public async Task<JsonResult> Get(
            string operatorRef,
            string lineRef,
            string boundingBox)
        {
            string queryString = $"&{(HttpContext.Request.QueryString).ToString().Substring(1)}";
            return await GetData(_configuration["BusOpenDataFeed"] ?? "", queryString, SqlData.Event.LocationQuery);
        }

        [HttpGet("operatorRef-lineRef")]
        public async Task<JsonResult> Get(
            string operatorRef = "TFLO",
            string lineRef = "512"
        )
        {
            string queryString = $"&{(HttpContext.Request.QueryString).ToString().Substring(1)}";
            return await GetData(_configuration["BusOpenDataFeed"] ?? "", queryString, SqlData.Event.LocationQuery);
        }

        [HttpGet("operatorRef")]
        public async Task<JsonResult> Get(
            string operatorRef = "TFLO"
        )
        { 
            string queryString = $"&{(HttpContext.Request.QueryString).ToString().Substring(1)}";
            return await GetData(_configuration["BusOpenDataFeed"] ?? "", queryString, SqlData.Event.LocationQuery);
        }

        [HttpPost]
        public async Task<JsonResult> Post(BusDataQuery query)
        { 
            string queryString = ToQueryString(query);
            return await GetData(_configuration["BusOpenDataFeed"] ?? "", queryString, SqlData.Event.LocationQuery);
        }

        // Disruption Get call...
        [HttpGet("disruption")]
        public async Task<JsonResult> GetDisruptions()
        {
            return await GetData(_configuration["BusOpenDataDisruptionFeed"] ?? "", "", SqlData.Event.DisruptionQuery);
        }

        private async Task<JsonResult> GetData(string baseDftUri, string queryString, SqlData.Event eventType)
        {
            string uri = $"{baseDftUri}{queryString}";
            string response = "";
            string jsonString;
            JsonResult jsonResult;

            XmlDocument xmlDoc = new XmlDocument();

            using HttpClient client = _httpClientFactory.CreateClient();

            try
            {
                response = await client.GetStringAsync(uri);
                xmlDoc.LoadXml(response);
            }
            catch (HttpRequestException e)
            {
                _logger.LogError(999, e, $"Exception: {e.Message}");
                throw;
            }

            jsonString = JsonConvert.SerializeXmlNode(xmlDoc);
            jsonResult = new JsonResult(jsonString);

            return jsonResult;
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
