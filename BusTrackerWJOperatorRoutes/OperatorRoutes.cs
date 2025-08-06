using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;
using System.IO.Compression;
using System.Xml;
using System.Linq;

namespace BusTrackerWebJob.OperatorRoutes
{

    public interface IOperatorRoutes
    {   Task RefreshCacheAsync();
    }

    public class OperatorRoutes : IOperatorRoutes
    {
        private static ILogger<OperatorRoutes>? _logger;
        private static IConfiguration? _configuration;

        private static string? busOpenDataBulkZipUrl;
        private static string? travelineNocFeedUrl;
        private static string? operatorRoutesJsonFilePath;
        private static string? operatorRoutesPath;

        public OperatorRoutes(
            IConfiguration configuration,
            ILogger<OperatorRoutes> logger

        )
        {
            _configuration = configuration;
            _logger = logger;

            // perhaps have checks to ensure these are not null...
            busOpenDataBulkZipUrl = _configuration["BT_BusOpenData_Bulk_Zip_URL"];
            travelineNocFeedUrl = _configuration["BT_Traveline:Noc_Feed_URL"];
            operatorRoutesJsonFilePath = _configuration["BT_Operator_Routes_Json_File_Path"];
            operatorRoutesPath = Path.GetDirectoryName(operatorRoutesJsonFilePath);
        }

        public async Task RefreshCacheAsync()
        {
            Console.WriteLine("BusTrackerRoutes");
            Console.WriteLine($"Start time {DateTime.Now}");

            var tasks = new List<Task<Double>>();
            ShowThreadInformation("Application");

            // Call get data methods asynchronously...
            Task<JArray> operators = Task.Run(() => GetOperatorsAsynch());

            Task<JArray> lines = Task.Run(() => GetLatestRoutesAsynch());

            Task<JArray> current = Task.Run(() => GetCurrentCachedOperatorsAndRoutesAsynch());

            // Wait for all the tasks to finish.
            await Task.WhenAll(lines, operators, current);

            // Join the Operators onto the latest set of lines, then Union with the existing Operator-lines,
            // implicitly de-duplicating, then reformat as Operators with nested lines...

            var newOperatorRoutes = lines.Result
                .Join(operators.Result,
                    r => r["operatorRef"],
                    o => o["operatorRef"],
                    (r, o) => new
                    {
                        operatorRef = o["operatorRef"],
                        operatorName = o["operatorName"],
                        lineRef = r["lineRef"],
                        lineName = r["lineName"],
                        added = r["added"]
                    }
                )
                .Union(current.Result
                    .Where(r => (string?)r["lineRef"] != "null")
                    .Select(r => new
                    {
                        operatorRef = r["operatorRef"],
                        operatorName = r["operatorName"],
                        lineRef = r["lineRef"],
                        lineName = r["lineName"],
                        added = r["added"]
                    }))
                //.Where(o => o.operatorRef.Equals("TFLO") )
                .GroupBy(o => new { o.operatorRef, o.operatorName, o.lineRef, o.lineName })
                .Select(group => group.OrderBy(o => o.added).First()) 
                .GroupBy(o => new { o.operatorRef, o.operatorName })
                .Select(o => new
                {
                    operatorRef = o.Key.operatorRef,
                    operatorName = o.Key.operatorName,
                    lines = o
                        .Select(r => new
                        {
                            lineRef = r.lineRef,
                            lineName = r.lineName,
                            added = r.added
                        }
                        )
                        .ToList()
                        .OrderBy(r => r.lineName)
                })
                .OrderBy(o => o.operatorName);

            Console.WriteLine("Running Task: Save to local file.");
            try
            {
                File.WriteAllText(operatorRoutesJsonFilePath, JsonConvert.SerializeObject(newOperatorRoutes, Newtonsoft.Json.Formatting.Indented));
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception: " + e.Message);
                _logger.LogError(998, e, "Exception writing to JSON file.");
            }
            finally
            {
                // return a summary of the data changes...
                string summary = String.Format("\nBusTracker - lines: Summary:\n-------------------------------------\nPrevious number of Operators: {0}\nPrevious number of lines: {1}\nNew number of Operators: {2}\nNew number of lines: {3}\nWritten to: {4}\n-------------------------------------\n",
                    current.Result.GroupBy(o => o["operatorRef"]).Count(),
                    current.Result.Count(),
                    newOperatorRoutes.Select(o => o.operatorRef).Distinct().Count(),
                    newOperatorRoutes.SelectMany(o => o.lines).Select(r => r.lineName).Count(),
                    operatorRoutesJsonFilePath
                    );
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
            JArray jsonArray;

            Console.WriteLine("Running Task: GetCurrentCachedOperatorsAndRoutesAsynch.");
            ShowThreadInformation("Task #" + Task.CurrentId.ToString());

            try
            {
                string jsonString = File.ReadAllText(operatorRoutesJsonFilePath);
                JArray jsonArr = JArray.Parse(jsonString);

                var operatorRoutes = jsonArr
                    .SelectMany(o => o["lines"]
                        .Where(r => (string?)r["lineRef"] != null)
                        .Select(r => new
                        {
                            operatorRef = o["operatorRef"],
                            operatorName = o["operatorName"],
                            lineRef = r["lineRef"],
                            lineName = r["lineName"],
                            added = r["added"]
                        })
                    );

                jsonString = JsonConvert.SerializeObject(operatorRoutes);
                jsonArray = JArray.Parse(jsonString);

                Console.WriteLine("Completed Task: GetCurrentCachedOperatorsAndRoutesAsynch.");
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.Message);
                jsonArray = JArray.Parse("[]");
            }

            return jsonArray;
        }
        private static async Task<JArray> GetOperatorsAsynch()
        {
            Console.WriteLine("Running Task: GetOperatorsAsynch.");
            ShowThreadInformation("Task #" + Task.CurrentId.ToString());

            XmlDocument xmlDoc = new XmlDocument();

            using (var client = new HttpClient())
            {
                var response = await client.GetAsync(travelineNocFeedUrl);

                string xmlString = response.Content.ReadAsStringAsync().Result;

                xmlDoc.LoadXml(xmlString);
            }

            //Convert JSON...
            string jsonString = JsonConvert.SerializeXmlNode(xmlDoc);
            JObject jsonObj = JObject.Parse(jsonString);

            //var nocLinesRecords = jsonObj.Root["travelinedata"]["NOCLines"]["NOCLinesRecord"]
            //    .Where(nocLinesRecord => (string?)nocLinesRecord["Mode"] == "Bus" || (string?)nocLinesRecord["Mode"] == "Coach")
            //    .Select(nocLineRecord => new
            //    {
            //        nocCode = nocLineRecord["NOCCODE"],
            //        pubNm = ((string?)nocLineRecord["PubNm"]).Trim()
            //    })
            //    .Distinct();

            //var nocTableRecords = jsonObj.Root["travelinedata"]["NOCTable"]["NOCTableRecord"]
            //    .Select(nocTableRecord => new
            //    {
            //        nocCode = nocTableRecord["NOCCODE"],
            //        opPubNm = ((string?)nocTableRecord["OperatorPublicName"]).Trim(),
            //        opId = nocTableRecord["OpId"]
            //    });

            //var operatorsRecords = jsonObj.Root["travelinedata"]["Operators"]["OperatorsRecord"]
            //    .Select(nocTableRecord => new
            //    {
            //        opId = nocTableRecord["OpId"],
            //        opNm = nocTableRecord["OpNm"]
            //    });

            //var nocOperatorRecords = nocLinesRecords
            //    .Join(nocTableRecords,
            //    nocLinesRecord => nocLinesRecord.nocCode,
            //    nocTableRecord => nocTableRecord.nocCode,
            //    (nocLinesRecord, nocTableRecord) => nocTableRecord)
            //    .Join(operatorsRecords,
            //        nocTableRecord => nocTableRecord.opId,
            //        operatorsRecord => operatorsRecord.opId,
            //        (nocTableRecord, operatorsRecord) => new
            //        {
            //            nocCode = nocTableRecord.nocCode,
            //            opPubNm = nocTableRecord.opPubNm,
            //            opId = operatorsRecord.opId,
            //            opNm = operatorsRecord.opNm
            //        }
            //    );

            //var nocOperatorRecords1 = nocOperatorRecords
            //    .Select(nocOperatorRecord => new
            //    {
            //        nocOperatorRecord.nocCode,
            //        nocOperatorRecord.opPubNm,
            //        nocOperatorRecord.opId,
            //        nocOperatorRecord.opNm,
            //        sharedOpPubNmCount = nocOperatorRecords
            //            .Where(r => (string?)r.opPubNm == (string?)nocOperatorRecord.opPubNm && (string?)r.opId != (string?)nocOperatorRecord.opId)
            //            .Count()
            //    });


            //var operators = nocLinesRecords
            //    .Join(nocOperatorRecords1,
            //        nocLinesRecord => nocLinesRecord.nocCode,
            //        nocOperatorsRecord => nocOperatorsRecord.nocCode,
            //        (nocLinesRecord, nocOperatorsRecord) => new
            //        {
            //            operatorRef = nocLinesRecord.nocCode,
            //            operatorName = $"{nocLinesRecord.pubNm}{(nocOperatorsRecord.sharedOpPubNmCount > 1 ? $" - {nocOperatorsRecord.opNm}" : null)}"
            //        }
            //    );

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


            var busDataZip = await HttpDownloadAndUnzipAsynch(busOpenDataBulkZipUrl, operatorRoutesPath);

            XmlDocument xmlDoc = new XmlDocument();
            xmlDoc.Load(Path.Combine(operatorRoutesPath, "siri.xml"));

            // convert to JSON xml does not want to work....
            string jsonString = JsonConvert.SerializeXmlNode(xmlDoc);
            JObject json = JObject.Parse(jsonString);

            var lines = json["Siri"]["ServiceDelivery"]["VehicleMonitoringDelivery"]["VehicleActivity"]
                .Select(va => va["MonitoredVehicleJourney"])
                .Where(mvj => (string?)mvj["LineRef"] != null)
                .Select(mvj => new
                {
                    lineRef = mvj["LineRef"],
                    lineName = mvj["PublishedLineName"],
                    added = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                    operatorRef = mvj["OperatorRef"]
                })
                .Distinct();

            jsonString = JsonConvert.SerializeObject(lines);
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
