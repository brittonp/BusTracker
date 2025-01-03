using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;
using System.IO.Compression;
using System.Xml;
using System.Linq;
using System.Linq.Expressions;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using System;
using System.Data.SqlTypes;
using System.IO;
using Azure.Identity;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Blobs.Specialized;
using Azure.Storage;
using BusTrackerServices.Data;


namespace BusTrackerWebJob.Stops
{

    public interface IStops
    {   Task RefreshCacheAsync();
    }

    public class Stops : IStops
    {
        private static ILogger<Stops>? _logger;
        private static IConfiguration? _configuration;
        private readonly ISqlData _sqlData;


        private static string? naptanUrl;
        private static string? stopsJsonFilePath;
        private static string? stopsPath;

        private static readonly HttpClient httpClient = new HttpClient();


        public Stops(
            IConfiguration configuration,
            ILogger<Stops> logger,
            ISqlData sqlData
        )
        {
            _configuration = configuration;
            _logger = logger;
            _sqlData = sqlData;

            // perhaps have checks to ensure these are not null...
            naptanUrl = _configuration["BT_NaPTAN_URL"];
            stopsJsonFilePath = _configuration["BT_Stops_Json_File_Path"];
            stopsPath = Path.GetDirectoryName(stopsJsonFilePath);
        }

        public async Task RefreshAsync()
        {
            Console.WriteLine("BusTracker: Stops");
            DateTime start = DateTime.Now;
            Console.WriteLine($"Start time {start}");

            Stream fileStream = await GetFileStreamAsynch(naptanUrl);

            if (fileStream != Stream.Null)
            {
                await SaveStreamToBlobAsynch(fileStream, "bustrackerblobstorage", "json-data", "xxx.xml");

                await LoadXMLBlobIntoDbAsynch("bustrackerblobstorage", "json-data", "xxx.xml");
            }

            DateTime end = DateTime.Now;
            Console.WriteLine($"End time {end}");
            TimeSpan duration = end - start;
            Console.WriteLine($"Duration (secs) {duration.TotalSeconds}");
            Console.WriteLine("Completed.");

        }

        private async Task<Stream> GetFileStreamAsynch(string fileUrl)
        {
            Stream fileStream;

            try
            {
                fileStream = await httpClient.GetStreamAsync(fileUrl);
            }
            catch (Exception ex)
            {
                fileStream = Stream.Null;
            }

            Console.WriteLine("GetFileStreamAsynch - done");
            return fileStream;
        }

        private async Task SaveStreamToBlobAsynch(Stream fileStream, string storageAccount, string storageContainer, string storageFileName)
        {
            DefaultAzureCredentialOptions options = new DefaultAzureCredentialOptions
            {
                ExcludeAzureCliCredential = true,
                ExcludeAzureDeveloperCliCredential = true,
                ExcludeAzurePowerShellCredential = true,
                ExcludeEnvironmentCredential = true,
                ExcludeInteractiveBrowserCredential = true,
                ExcludeManagedIdentityCredential = true,
                ExcludeSharedTokenCacheCredential = true,
                ExcludeVisualStudioCodeCredential = true,
                ExcludeVisualStudioCredential = true,
                ExcludeWorkloadIdentityCredential = true
            };

            // if dev we have to use AzureDeveloperCliCredential (VisualStudioCredential does not work!!!)...
            //
            if (_configuration["Environment"] == "Dev")
            {
                options.ExcludeAzureDeveloperCliCredential = false;
            }
            else
            {
                options.ExcludeManagedIdentityCredential = false;
            }

            DefaultAzureCredential credential = new(options);

            BlobClient blobClient = new BlobServiceClient(new Uri($"https://{storageAccount}.blob.core.windows.net"), credential)
                .GetBlobContainerClient(storageContainer)
                .GetBlobClient(storageFileName);

            await blobClient.UploadAsync(fileStream, true);
            fileStream.Close();

            Console.WriteLine("SaveStreamToBlobAsynch - done");
        }

        private async Task LoadXMLBlobIntoDbAsynch(string storageAccount, string storageContainer, string storageFileName)
        {

            int sessionId = _sqlData.LoadBusStopXML();
            Console.WriteLine("LoadXMLBlobIntoDbAsynch - done");
        }

        public async Task RefreshCacheAsync()
        {
            Console.WriteLine("BusTracker: Stops");
            DateTime start = DateTime.Now;
            Console.WriteLine($"Start time {start}");

            var tasks = new List<Task<Double>>();

            // Call get data methods asynchronously...
            Task<JArray> stops = Task.Run(() => GetStopsAsynch());

            // Wait for all the tasks to finish.
            await Task.WhenAll(stops);

            Console.WriteLine("Running Task: Save to local file.");
            try
            {
                File.WriteAllText(stopsJsonFilePath, JsonConvert.SerializeObject(stops.Result, Newtonsoft.Json.Formatting.Indented));
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception: " + e.Message);
                _logger.LogError(998, e, "Exception writing to JSON file.");
            }
            finally
            {
                // return a summary of the data changes...
                string summary = String.Format("\nBusTracker - Stops: Summary:\n-------------------------------------\nTotal number of Stops: {0}\nWritten to: {1}\n-------------------------------------\n",
                    stops.Result.Count,
                    stopsJsonFilePath
                    );
                Console.WriteLine(summary);
            }

            DateTime end = DateTime.Now;
            Console.WriteLine($"End time {end}");
            TimeSpan duration = end - start;
            Console.WriteLine($"Duration (secs) {duration.TotalSeconds}");
            Console.WriteLine("Completed.");

        }


        private static async Task<JArray> GetStopsAsynch()
        {
            Console.WriteLine("Running Task: GetStopsAsynch.");

            XmlDocument xmlDoc = new XmlDocument();

            try
            {
                httpClient.Timeout = TimeSpan.FromMinutes(10);
                string response = await httpClient.GetStringAsync(naptanUrl);
                xmlDoc.LoadXml(response);
            }
            catch (HttpRequestException e)
            {
                _logger.LogError(998, e, $"Exception: {e.Message}");
                throw;
            }

            Console.WriteLine("Fetched Request");

            // just get the StopPoints node (less to convert to JSON)...
            XmlNamespaceManager nsMgr = new XmlNamespaceManager(xmlDoc.NameTable);
            nsMgr.AddNamespace("naptan", "http://www.naptan.org.uk/");
            XmlNode? xmlStopPoints = xmlDoc.SelectSingleNode("/naptan:NaPTAN/naptan:StopPoints", nsMgr);

            //Convert from XML to JSON...
            string jsonString = JsonConvert.SerializeXmlNode(xmlStopPoints);
            JObject jsonObj = JObject.Parse(jsonString);

            Console.WriteLine("Converted XML to JSON");

            var stops = jsonObj.Root["StopPoints"]?["StopPoint"]?
                .Where(r => (string?)r["StopClassification"]["StopType"] == "BCT")
                .Where(r => (string?)r["@Status"] != "inactive")
                .Where(r => r["Place"]["Location"]["Translation"] != null) // some bus stops do not have this info, they have northerly and easterly coords (aagh!).
                .Select(r => {
                    string? atcoAreaCode = ((string?)r["AtcoCode"]).Substring(0, 3);
                    string? commonName = (r["Descriptor"]["CommonName"].Type == JTokenType.String) 
                        ? r["Descriptor"]?["CommonName"]?.Value<string>() 
                        : r["Descriptor"]?["CommonName"]?["#text"]?.Value<string>();
                    string? indicator = (r["Descriptor"]?["Indicator"] != null ? 
                        (r["Descriptor"]?["Indicator"].Type == JTokenType.String
                            ? r["Descriptor"]?["Indicator"]?.Value<string>()
                            : r["Descriptor"]?["Indicator"]?["#text"]?.Value<string>())
                    : String.Empty);

                    // standardise the indicator
                    string? standardIndicator = StandardiseIndicator(indicator);

                    return new
                    {
                        atcoAreaCode = atcoAreaCode,
                        naptanId = r["AtcoCode"].ToString(),
                        commonName = commonName,
                        indicator = indicator,
                        standardIndicator = standardIndicator,
                        status = r["@Status"],
                        type = r["StopClassification"]["StopType"],
                        position = new
                        {
                            lat = r["Place"]["Location"]["Translation"]["Latitude"],
                            lng = r["Place"]["Location"]["Translation"]["Longitude"],
                        },
                    };
                });

            jsonString = JsonConvert.SerializeObject(stops);
            JArray jsonArray = JArray.Parse(jsonString);

            Console.WriteLine("Completed Task: GetStopsAsynch.");

            return jsonArray;

        }

        private static string? StandardiseIndicator(string? val)
        {
            string? returnVal = val;

            if (val.Length >2 )
            {

                List<IndicatorFilter> filters = [
                    new IndicatorFilter { Find = ["northeastbound", "north east", "north east bound", "ne bound", "ne-bound"], ReplaceWith = "->NE"},
                    new IndicatorFilter { Find = ["southeastbound", "south east", "south east bound", "se bound", "se-bound"], ReplaceWith = "->SE"},
                    new IndicatorFilter { Find = ["northwestbound", "north west", "north west bound", "nw bound", "nw-bound"], ReplaceWith = "->NW"},
                    new IndicatorFilter { Find = ["southwestbound", "south west", "south west bound", "sw bound", "sw-bound"], ReplaceWith = "->SW"},
                    new IndicatorFilter { Find = ["northbound", "north", "north bound", "n bound", "n-bound"], ReplaceWith = "->N"},
                    new IndicatorFilter { Find = ["eastbound", "east", "east bound", "e bound", "e-bound"], ReplaceWith = "->E"},
                    new IndicatorFilter { Find = ["southbound", "south", "south bound", "s bound", "s-bound"], ReplaceWith = "->S"},
                    new IndicatorFilter { Find = ["westbound", "west", "west bound", "w bound", "w-bound"], ReplaceWith = "->W"},
                    new IndicatorFilter { Find = ["stop ", "stand ", "bay "], ReplaceWith = String.Empty},
                ];

                foreach (IndicatorFilter filter in filters)
                {
                    foreach(string find in filter.Find)
                    {
                        returnVal = Regex.Replace(returnVal, find, filter.ReplaceWith, RegexOptions.IgnoreCase);
                    }
                }

                if (returnVal != val || returnVal.Substring(0,2) == "->")
                {
                    returnVal = returnVal.Trim();
                } else
                {
                    returnVal = String.Empty;
                }

            }
            return returnVal;
        }

        // Private class.
        private class IndicatorFilter
        {
            public List<string> Find { get; set; }
            public string ReplaceWith { get; set; }
        }

    }
}
