using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml;

namespace BusTrackerServices.Batch
{

    public interface IOperatorRoutes
    {   Task RefreshCacheAsync();
    }

    public class OperatorRoutes : IOperatorRoutes
    {
        private static ILogger<OperatorRoutes>? _logger;
        private static IConfiguration? _configuration;

        public OperatorRoutes(
            IConfiguration configuration,
            ILogger<OperatorRoutes> logger
        )
        {
            _configuration = configuration;
            _logger = logger;
        }

        public async Task RefreshCacheAsync()
        {
            //Console.WriteLine($"WEBROOT_PATH: {Environment.GetEnvironmentVariable("WEBROOT_PATH")}");

            Console.WriteLine($"Start time {DateTime.Now}");
            var tasks = new List<Task<Double>>();
            ShowThreadInformation("Application");

            _logger.LogInformation(998, "BusTrackerRoutes");
            Console.WriteLine("BusTrackerRoutes");

            // Call get data methods asynchronously...
            Task<JArray> operators = Task.Run(() => GetOperatorsAsynch());

            Task<JArray> routes = Task.Run(() => GetLatestRoutesAsynch());

            Task<JArray> current = Task.Run(() => GetCurrentCachedOperatorsAndRoutesAsynch());

            // Wait for all the tasks to finish.
            await Task.WhenAll(routes, operators, current);

            // Join the Operators onto the latest set of Routes, then Union with the existing Operator-Routes,
            // implicitly de-duplicating, then reformat as Operators with nested Routes...

            var newOperatorRoutes = routes.Result
                .Join(operators.Result,
                    r => r["operatorRef"],
                    o => o["operatorRef"],
                    (r, o) => new
                    {
                        operatorRef = o["operatorRef"],
                        operatorName = o["operatorName"],
                        lineRef = r["lineRef"],
                        route = r["route"]
                    }
                )
                .Union(current.Result
                    .Where(r => (string?)r["lineRef"] != "null")
                    .Select(r => new
                    {
                        operatorRef = r["operatorRef"],
                        operatorName = r["operatorName"],
                        lineRef = r["lineRef"],
                        route = r["route"]
                    }))
                //.Where(o => o.operatorRef.Equals("TFLO") )
                .GroupBy(o => new { o.operatorRef, o.operatorName })
                .Select(o => new
                {
                    operatorRef = o.Key.operatorRef,
                    operatorName = o.Key.operatorName,
                    routes = o
                        .Select(r => new
                        {
                            lineRef = r.lineRef,
                            route = r.route
                        }
                        )
                        .ToList()
                        .OrderBy(r => r.route)
                })
                .OrderBy(o => o.operatorName);

            Console.WriteLine("Running Task: Save to local file.");
            try
            {
                string path = _configuration["OperatorRoutesFileLocation"] ?? ""; // if ToString return null, then take ""...
                File.WriteAllText(path, JsonConvert.SerializeObject(newOperatorRoutes, Newtonsoft.Json.Formatting.Indented));
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception: " + e.Message);
                _logger.LogError(998, e, "Exception writing to JSON file.");
            }
            finally
            {
                // return a summary of the data changes...
                string summary = String.Format("BusTracker - Routes: Summary:\n-------------------------------------\nPrevious number of Operators: {0}\nPrevious number of Routes: {1}\nNew number of Operators: {2}\nNew number of Routes: {3}\n-------------------------------------\n",
                    current.Result.GroupBy(o => o["operatorRef"]).Count(),
                    current.Result.Count(),
                    newOperatorRoutes.Select(o => o.operatorRef).Distinct().Count(),
                    newOperatorRoutes.SelectMany(o => o.routes).Select(r => r.route).Count());
                Console.WriteLine(summary);
            }

            Console.WriteLine($"End time {DateTime.Now}");
            Console.WriteLine("Completed.");

        }


        private static async Task<string> HttpDownloadAndUnzipAsynch(string requestUri, string directoryToUnzip)
        {
            Console.WriteLine("Running Task: HttpDownloadAndUnzipAsynch.");
            ShowThreadInformation("Task #" + Task.CurrentId.ToString());

            using var response = await new HttpClient().GetAsync(requestUri);
            if (!response.IsSuccessStatusCode) return response.StatusCode.ToString();

            using var streamToReadFrom = await response.Content.ReadAsStreamAsync();
            using var zip = new ZipArchive(streamToReadFrom);
            zip.ExtractToDirectory(directoryToUnzip, true);

            Console.WriteLine("Completed Task: HttpDownloadAndUnzipAsynch.");
            return zip.Entries[0].ToString();
        }

        private static async Task<JArray> GetCurrentCachedOperatorsAndRoutesAsynch()
        {
            Console.WriteLine("Running Task: GetCurrentCachedOperatorsAndRoutesAsynch.");
            ShowThreadInformation("Task #" + Task.CurrentId.ToString());

            string jsonString = File.ReadAllText(_configuration["OperatorRoutesFileLocation"] ?? ""); // if ToString return null, then take ""...
            //JObject jsonObj = JObject.Parse(jsonString);
            JArray jsonArr = JArray.Parse(jsonString);

            //var operatorRoutes = jsonObj.Root["data"]
            var operatorRoutes = jsonArr
                .SelectMany(o => o["routes"]
                    .Where(r => (string?)r["lineRef"] != null)
                    .Select(r => new
                    {
                        operatorRef = o["operatorRef"],
                        operatorName = o["operatorName"],
                        lineRef = r["lineRef"],
                        route = r["route"]
                    })
                );

            jsonString = JsonConvert.SerializeObject(operatorRoutes);
            JArray jsonArray = JArray.Parse(jsonString);

            Console.WriteLine("Completed Task: GetCurrentCachedOperatorsAndRoutesAsynch.");
            return jsonArray;
        }
        private static async Task<JArray> GetOperatorsAsynch()
        {
            Console.WriteLine("Running Task: GetOperatorsAsynch.");
            ShowThreadInformation("Task #" + Task.CurrentId.ToString());

            XmlDocument xmlDoc = new XmlDocument();

            using (var client = new HttpClient())
            {
                var response = await client.GetAsync(_configuration["travelineNocFeedXML"]);

                string xmlString = response.Content.ReadAsStringAsync().Result;

                xmlDoc.LoadXml(xmlString);
            }

            //Convert JSON...
            string jsonString = JsonConvert.SerializeXmlNode(xmlDoc);
            JObject jsonObj = JObject.Parse(jsonString);

            var operators = jsonObj.Root["travelinedata"]["NOCLines"]["NOCLinesRecord"]
                .Where(r => (string?)r["Mode"] == "Bus" || (string?)r["Mode"] == "Coach")
                .Select(r => new
                {
                    operatorRef = r["NOCCODE"],
                    operatorName = r["PubNm"]
                })
                .Distinct();

            jsonString = JsonConvert.SerializeObject(operators);
            JArray jsonArray = JArray.Parse(jsonString);

            Console.WriteLine("Completed Task: GetOperatorsAsynch.");

            return jsonArray;

        }

        private static async Task<JArray> GetLatestRoutesAsynch()
        {
            Console.WriteLine("Running Task: GetLatestRoutesAsynch.");
            ShowThreadInformation("Task #" + Task.CurrentId.ToString());


            var busDataZip = await HttpDownloadAndUnzipAsynch(_configuration["BusOpenDataBulkZip"], _configuration["SiriDownloadFileLocation"]);

            XmlDocument xmlDoc = new XmlDocument();
            xmlDoc.Load(String.Format("{0}{1}", _configuration["SiriDownloadFileLocation"], "siri.xml"));

            // convert to JSON xml does not want to work....
            string jsonString = JsonConvert.SerializeXmlNode(xmlDoc);
            JObject json = JObject.Parse(jsonString);

            var routes = json["Siri"]["ServiceDelivery"]["VehicleMonitoringDelivery"]["VehicleActivity"]
                .Select(va => va["MonitoredVehicleJourney"])
                .Where(mvj => (string?)mvj["LineRef"] != null)
                .Select(mvj => new
                {
                    lineRef = mvj["LineRef"],
                    route = mvj["PublishedLineName"],
                    operatorRef = mvj["OperatorRef"]
                })
                .Distinct();

            jsonString = JsonConvert.SerializeObject(routes);
            JArray jsonArray = JArray.Parse(jsonString);

            Console.WriteLine("Completed Task: GetLatestRoutesAsynch.");

            return jsonArray;

        }

        private static void ShowThreadInformation(String taskName)
        {
            return;

            String? msg = null;
            Thread thread = Thread.CurrentThread;
            msg = String.Format("{0} thread information\n", taskName) +
                    String.Format("   Background: {0}\n", thread.IsBackground) +
                    String.Format("   Thread Pool: {0}\n", thread.IsThreadPoolThread) +
                    String.Format("   Thread ID: {0}\n", thread.ManagedThreadId);
            Console.WriteLine(msg);
        }
    }
}
