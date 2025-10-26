using Azure.Identity;
using Azure.Storage.Blobs;
using BusTrackerAPI.Services;
using DotSpatial.Projections;
using Microsoft.AspNetCore.Builder;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Data;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;

namespace BusTracker
{

    public class Stops 
    {
        private static ILogger<Stops>? _logger;
        private static IConfiguration? _configuration;

        private static string? naptanUrl;
        private static string? naptanNamespace;
        private static string? busStopDatabaseTable;
        private static string? stopsJsonFilePath;
        private static string? stopsPath;
        private static string? storageAccount;
        private static string? storageContainer;
        private static string? storageBlob;
        private static string? connectionString;

        private static readonly HttpClient httpClient = new HttpClient();

        public Stops(
            IConfiguration configuration,
            ILogger<Stops> logger
        )
        {
            _configuration = configuration;
            _logger = logger;

            // perhaps have checks to ensure these are not null...
            naptanUrl = _configuration["BT_NaPTAN:URL"];
            naptanNamespace = _configuration["BT_NaPTAN:Namespace"];
            busStopDatabaseTable = _configuration["BusStopDatabaseTable"];
            stopsJsonFilePath = _configuration["BT_Stops_Json_File_Path"];
            stopsPath = Path.GetDirectoryName(stopsJsonFilePath);
            connectionString = _configuration["ConnectionStrings:BusTrackerDb"];
            storageAccount = _configuration["AzureStorage:storageAccount"];
            storageContainer = configuration["AzureStorage:storageContainer"];
            storageBlob = _configuration["AzureStorage:storageBlob"];
        }

        // This is the original approach - wgich downloads the XML to blob storage on Azure, uses a stroed proc to load the data, then performs some more db actions to clean the data (a bit long winded)....
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
            int intResult = 0;

            try
            {
                using (SqlConnection conn = new SqlConnection(connectionString))
                {
                    conn.Open();
                    string? sql = "bus.sp_load_busstop_xml"; // _configuration["Sql:LoadBusStopData"];
                    using SqlCommand sqlCmd = new SqlCommand(sql, conn);
                    sqlCmd.CommandType = CommandType.StoredProcedure;
                    sqlCmd.CommandTimeout = 0;

                    SqlParameter returnVal = new SqlParameter
                    {
                        ParameterName = "@retVal",
                        SqlDbType = SqlDbType.Int,
                        Direction = ParameterDirection.Output,
                    };
                    sqlCmd.Parameters.Add(returnVal);

                    try
                    {
                        sqlCmd.ExecuteNonQuery();
                        intResult = (int)returnVal.Value;
                    }
                    catch (SqlException ex)
                    {
                        _logger.LogError(999, ex, "SqlException when getting data.");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(999, ex, "Exception when getting data.");
                    }
                    finally
                    {
                        _logger.LogInformation(999, $"Inserted {intResult} bus stop records.");
                    }
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(999, ex, "Exception on connecting to database.");
            }

            Console.WriteLine("LoadXMLBlobIntoDb - done");

            //return intResult;
        }

        private async Task CleanBusStopData()
        {
            using (SqlConnection conn = new SqlConnection(connectionString))
            {
                conn.Open();

                string selectSql = "SELECT * FROM [bus].[bus_stop]";
                DataTable table = new DataTable();

                using (SqlDataAdapter adapter = new SqlDataAdapter(selectSql, conn))
                {
                    adapter.Fill(table);
                }

                int kount = 0;
                foreach (DataRow row in table.Rows)
                {
                    kount++;

                    // Set the standard_indicator
                    string indicator = row.Field<string>("indicator") ?? string.Empty;
                    if (!string.IsNullOrEmpty(indicator))
                    {
                        var standardisedIndicator = StandardiseIndicator(indicator);
                        row["standard_indicator"] = standardisedIndicator;
                    }

                    // Add missing lat/lng (read them as strings)
                    string lat = row.Field<object>("lat")?.ToString() ?? string.Empty;
                    string lng = row.Field<object>("lng")?.ToString() ?? string.Empty;
                    if (string.IsNullOrEmpty(lat) && string.IsNullOrEmpty(lng))
                    {
                        var convertedData = ConvertUKOSToWGS84((double)(float)row["easting"], (double)(float)row["northing"]);

                        row["lat"] = convertedData[1];
                        row["lng"] = convertedData[0];
                    }

                    if (kount % 50000 == 0)
                    {
                        _logger.LogInformation("Processed {0} rows.", kount);
                    }
                }

                _logger.LogInformation("Processed {0} rows.", kount);
                _logger.LogInformation("Beginning bulk load...");

                // Truncate and reload using SqlBulkCopy
                using (SqlCommand truncateCmd = new SqlCommand("TRUNCATE TABLE [bus].[bus_stop];", conn))
                {
                    truncateCmd.ExecuteNonQuery();
                }

                using (SqlBulkCopy bulkCopy = new SqlBulkCopy(conn, SqlBulkCopyOptions.KeepIdentity, null))
                {
                    bulkCopy.DestinationTableName = "[bus].[bus_stop]";
                    bulkCopy.BatchSize = 50000; // optional: commit in chunks
                    bulkCopy.BulkCopyTimeout = 0; // no timeout
                    bulkCopy.WriteToServer(table);
                }

                _logger.LogInformation("Bulk insert complete. Total rows reloaded: {0}", table.Rows.Count);
                //return table.Rows.Count;
            }

            Console.WriteLine("CleanBusStopData - done");

        }


        // This is the alternative approach - just wondering if the size of the NaPTAN file may mean it should never be run from AZURE becuase of he memory usage....
        public async Task DirectRefresh()
        {
            _logger.LogInformation($"Downloading the XML from {naptanUrl}...");
            // Step 1: Download the XML
            var httpClient = new HttpClient
            {
                Timeout = TimeSpan.FromMinutes(10) // 10 minutes
            };
            string xmlContent = await httpClient.GetStringAsync(naptanUrl); // + "&atcoAreaCodes=050,490");

            _logger.LogInformation("Parsing and Filtering XML...");
            // Step 2: Parse and Filter XML
            XDocument doc = XDocument.Parse(xmlContent);

            // Extract <StopPoint> elements with specific properties
            XNamespace ns = naptanNamespace;
            // Query the XML
            var query = from stop in doc.Descendants(ns + "StopPoint")
                        where (string?)stop.Attribute("Status") == "active" 
                        && (string?)stop.Element(ns + "StopClassification")?.Element(ns + "StopType") == "BCT"
                        select new
                        {
                            naptan_id = (string?)stop.Element(ns + "AtcoCode"),
                            common_name = (string?)stop.Element(ns + "Descriptor")?.Element(ns + "CommonName"),
                            indicator = (string?)stop.Element(ns + "Descriptor")?.Element(ns + "Indicator"),
                            status = (string?)stop.Attribute("Status"),
                            type = (string?)stop.Element(ns + "StopClassification")?.Element(ns + "StopType"),
                            lat = (double?)stop.Element(ns + "Place")?
                                         .Element(ns + "Location")?
                                         .Element(ns + "Translation")?
                                         .Element(ns + "Latitude"),
                            lng = (double?)stop.Element(ns + "Place")?
                                         .Element(ns + "Location")?
                                         .Element(ns + "Translation")?
                                         .Element(ns + "Longitude"),
                            easting = (double?)stop.Element(ns + "Place")?
                                         .Element(ns + "Location")?
                                         .Element(ns + "Easting"),
                            northing = (double?)stop.Element(ns + "Place")?
                                          .Element(ns + "Location")?
                                          .Element(ns + "Northing"),
                        };

            _logger.LogInformation("Converting to DataTable...");
            // Step 3: Convert to DataTable
            DataTable table = new DataTable();
            table.Columns.Add("naptan_id", typeof(string));
            table.Columns.Add("atco_area_code", typeof(string));
            table.Columns.Add("common_name", typeof(string));
            table.Columns.Add("indicator", typeof(string));
            table.Columns.Add("standard_indicator", typeof(string));
            table.Columns.Add("status", typeof(string));
            table.Columns.Add("type", typeof(string));
            table.Columns.Add("lat", typeof(double));
            table.Columns.Add("lng", typeof(double));
            table.Columns.Add("easting", typeof(double));
            table.Columns.Add("northing", typeof(double));

            foreach (var x in query)
            {
                double? lat = x.lat;
                double? lng = x.lng;
                if (x.lat == null && x.lng == null && x.easting != null && x.northing != null)
                {
                    var latLng = ConvertUKOSToWGS84((double)x.easting, (double)x.northing);
                    lng = latLng[0];
                    lat = latLng[1];
                }

                var atcoAreaCode = x.naptan_id.Length >= 3 ? x.naptan_id[..3] : x.naptan_id;

                var standardisedIndicator = x.indicator != null ? StandardiseIndicator(x.indicator) : null;

                table.Rows.Add(
                    x.naptan_id,
                    atcoAreaCode, 
                    x.common_name,
                    x.indicator,
                    standardisedIndicator,
                    x.status,
                    x.type,
                    lat,
                    lng,
                    x.easting,
                    x.northing
                    );
            }

            _logger.LogInformation($"Identified {table.Rows.Count} stop points.");

            _logger.LogInformation($"Inserting into Database table {busStopDatabaseTable}...");

            //// Step 4: Insert into SQL Server
            using (SqlConnection conn = new SqlConnection(connectionString))
            {
                conn.Open();

                // Truncate and reload using SqlBulkCopy
                using (SqlCommand truncateCmd = new SqlCommand($"TRUNCATE TABLE {busStopDatabaseTable};", conn))
                {
                    truncateCmd.ExecuteNonQuery();
                }

                using (SqlBulkCopy bulkCopy = new SqlBulkCopy(conn, SqlBulkCopyOptions.TableLock | SqlBulkCopyOptions.UseInternalTransaction, null))
                {
                    bulkCopy.DestinationTableName = busStopDatabaseTable;
                    bulkCopy.BatchSize = 10000; // commit in chunks
                    bulkCopy.BulkCopyTimeout = 0; // no timeout
                    bulkCopy.NotifyAfter = 10000;  // fire event every 10,000 rows
                    bulkCopy.SqlRowsCopied += (sender, e) => _logger.LogInformation($"{e.RowsCopied} rows inserted...");
                    bulkCopy.WriteToServer(table);
                }

                _logger.LogInformation("Bulk insert complete. Total rows reloaded: {0}", table.Rows.Count);
            }

        }

        private double[] ConvertUKOSToWGS84(double easting, double northing)
        {

            // Define source projection (OSGB36 - British National Grid)
            ProjectionInfo osgb36 = KnownCoordinateSystems.Projected.NationalGrids.BritishNationalGridOSGB36;

            // Define target projection (WGS84)
            ProjectionInfo wgs84 = KnownCoordinateSystems.Geographic.World.WGS1984;

            // Example British National Grid Coordinates (Easting/Northing for London)
            double[] xy = { easting, northing };
            double[] z = { 0 };

            // Transform to Lat/Lng
            Reproject.ReprojectPoints(xy, z, osgb36, wgs84, 0, 1);

            return xy;

        }

        private static string? StandardiseIndicator(string? val)
        {
            string? returnVal = String.Empty;

            if (val.Length > 2 && val.Length < 20)
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
                    foreach (string find in filter.Find)
                    {
                        returnVal = Regex.Replace(returnVal, find, filter.ReplaceWith, RegexOptions.IgnoreCase);
                    }
                }

                if (returnVal != val || returnVal.Substring(0, 2) == "->")
                {
                    returnVal = returnVal.Trim();
                }
                else
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
