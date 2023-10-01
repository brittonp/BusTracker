using Microsoft.AspNetCore.Mvc;
using System.Xml;
using Newtonsoft.Json;
using BusTrackerServices.Models;
using System.Text;
using System;
using System.Threading;
using System.Threading.Tasks;
using System.Diagnostics;

namespace BusTrackerServices.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class BusLocationDataController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<BusLocationDataController> _logger;

        public BusLocationDataController(
            IConfiguration configuration, 
            ILogger<BusLocationDataController> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        [HttpGet("TaskRunner")]
        public string TaskRunner()
        {
            JsonResult json;

            Debug.WriteLine("Application thread ID: {0}",Thread.CurrentThread.ManagedThreadId);

            // Use Task.Run to start a task that computes the sum of numbers
            var task = Task.Run(() =>
            {
                Debug.WriteLine("Task thread ID: {0}", Thread.CurrentThread.ManagedThreadId);

                for (int i = 0; i < 3; i++)
                {

                    json = GetData("&operatorRef=TFLO&lineRef=512");

                    Debug.WriteLine("{0} : Sleep for 10 seconds!", i);
                    Thread.Sleep(10000);
                }

            });

            Debug.WriteLine("Doing some other work...");

            task.Wait();

            Debug.WriteLine("Done");

            return task.Status.ToString();
        }



        [HttpGet]
        public JsonResult Get()
        {
            string queryString = $"&{(HttpContext.Request.QueryString).ToString().Substring(1)}";
            return GetData(queryString);
        }

        [HttpGet("operatorRef-lineRef-boundingBox")]
        public JsonResult Get(
            string operatorRef,
            string lineRef,
            string boundingBox)
        {
            string queryString = $"&{(HttpContext.Request.QueryString).ToString().Substring(1)}";
            return GetData(queryString);
        }

        [HttpGet("operatorRef-lineRef")]
        public JsonResult Get(
            string operatorRef,
            string lineRef)
        {
            string queryString = $"&{(HttpContext.Request.QueryString).ToString().Substring(1)}";
            return GetData(queryString);
        }

        [HttpGet("operatorRef")]
        public JsonResult Get(
            string operatorRef)
        { 
            string queryString = $"&{(HttpContext.Request.QueryString).ToString().Substring(1)}";
            return GetData(queryString);
        }

        [HttpPost]
        public JsonResult Post(BusDataQuery query)
        { 
            string queryString = ToQueryString(query);
            return GetData(queryString);
        }

        private JsonResult GetData(string queryString)
        {
            string jsonString;
            JsonResult myJson;

            // get the url to the data provider from appsettings.json...
            string baseDftUri = _configuration.GetValue<string>("BusOpenDataFeed");

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
                var name = prop.Name;
                var value = prop.GetValue(obj).ToString();
                
                qs.Append($"&{Uri.EscapeDataString(name)}={Uri.EscapeDataString(value)}");
            }
            return qs.ToString();
        }

    }


}
