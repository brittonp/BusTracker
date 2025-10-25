using Azure.Identity;
using Azure.Storage.Blobs;
using BusTrackerAPI.Services;
using DotSpatial.Projections;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Data;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using ISqlData = BusTrackerAPI.Data.ISqlData;
using SqlData = BusTrackerAPI.Data.SqlData;


namespace BusTrackerWebJob.Stops
{

    public class Stops 
    {
        private static ILogger<Stops>? _logger;
        private static IConfiguration? _configuration;
        private readonly ISqlData _sqlData;

        private static string? naptanUrl;
        private static string? stopsJsonFilePath;
        private static string? stopsPath;
        private static string? storageAccount;
        private static string? storageContainer;
        private static string? storageBlob;
        private static string? _connectionString;

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
            _connectionString = _configuration["ConnectionStrings:BusTrackerDb"];
            storageAccount = _configuration["AzureStorage:storageAccount"];
            storageContainer = configuration["AzureStorage:storageContainer"];
            storageBlob = _configuration["AzureStorage:storageBlob"];
        }

        public async Task RefreshAsync()
        {
            Console.WriteLine("BusTracker: Stops");
            DateTime start = DateTime.Now;
            Console.WriteLine($"Start time {start}");

            Stream fileStream = await GetFileStream(naptanUrl);

            if (fileStream != Stream.Null)
            {
                await SaveStreamToBlob(fileStream);

                await LoadXMLBlobIntoDb();

                await CleanBusStopData();
            }

            DateTime end = DateTime.Now;
            Console.WriteLine($"End time {end}");
            TimeSpan duration = end - start;
            Console.WriteLine($"Duration (secs) {duration.TotalSeconds}");
            Console.WriteLine("Completed.");

        }

        private async Task<Stream> GetFileStream(string fileUrl)
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

            Console.WriteLine("GetFileStream - done");
            return fileStream;
        }

        private async Task SaveStreamToBlob(Stream fileStream)
        {
            var credential = new DefaultAzureCredential();

            BlobClient blobClient = new BlobServiceClient(new Uri($"https://{storageAccount}.blob.core.windows.net"), credential)
                .GetBlobContainerClient(storageContainer)
                .GetBlobClient(storageBlob);

            await blobClient.UploadAsync(fileStream, true);
            fileStream.Close();

            Console.WriteLine("SaveStreamToBlob - done");
        }

        private async Task LoadXMLBlobIntoDb()
        {
            await _sqlData.LoadBusStopXML();
            Console.WriteLine("LoadXMLBlobIntoDb - done");
        }

        private async Task CleanBusStopData()
        {
            await _sqlData.CleanBusStopData();
            Console.WriteLine("CleanBusStopData - done");
        }

    }

}
