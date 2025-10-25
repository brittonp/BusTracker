using BusTrackerAPI.Models;
using DotSpatial.Projections;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace BusTrackerAPI.Data
{
    public interface ISqlData
    {
        Task<object> PingDatabase();
        Task<int> CreateSession();
        Task<int> UpdateSession(int? sessionId, SqlData.Event _event);
        Task<object> GetRecentSessions();
        Task<object> GetSessionHistory(int sessionId);

        string? GetAllSystemParameters();
        string? GetSystemParameter(string parameterName);
        string? UpdateSystemParameter(SystemParameter systemParameter);

        Task<object> GetBusStopsByAtcoCode(string atcoCode);
        Task<object> GetBusStopsByBoundingBox(double north, double east, double south, double west);

        Task<int> LoadBusStopXML();
        Task<int> CleanBusStopData();

    }

    public class SqlData : ISqlData
    {
        public enum Event
        {
            CreateSession,
            LocationQuery,
            DisruptionQuery,
            DVLAQuery,
            Other
        }

        private readonly IConfiguration _configuration;
        private readonly ILogger<SqlData> _logger;
        private readonly IHttpContextAccessor _httpContextAccessor;

        private string? _connectionString;

        public SqlData(
            IConfiguration configuration,
            ILogger<SqlData> logger,
            IHttpContextAccessor httpContextAccessor
            ) 
        {
            _configuration = configuration;
            _logger = logger;
            _httpContextAccessor = httpContextAccessor;
            _connectionString = _configuration["ConnectionStrings:BusTrackerDb"];
        }

        public async Task<object> PingDatabase()
        {
            var strBuilder = new StringBuilder();
            int i = 0;

            try
            {
                using (SqlConnection conn = new SqlConnection(_connectionString))
                {
                    conn.Open();
                    string? sql = _configuration["Sql:PingDatabase"];
                    using SqlCommand sqlCmd = new SqlCommand(sql, conn);
                    try
                    {
                        var reader = await sqlCmd.ExecuteReaderAsync();
                        if (!reader.HasRows)
                        {
                            strBuilder.Append("[]");
                        }
                        else
                        {
                            while (reader.Read())
                            {
                                strBuilder.Append(reader.GetValue(0).ToString());
                                i++;
                            }
                        }
                    }
                    catch (SqlException ex)
                    {
                        _logger.LogError(999, ex, "SqlException on pinging database.");

                        return new
                        {
                            connectionString = _connectionString,
                            message = ex.Message,
                            errorCode = ex.ErrorCode,
                            errorSource = ex.Source
                        };
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(999, ex, "Exception on pinging database.");
                        return new
                        {
                            connectionString = _connectionString,
                            message = ex.Message,
                            errorSource = ex.Source
                        };
                    }
                    finally
                    {
                        _logger.LogInformation(999, "Retrieved recent session records: {0}.", i);
                    }
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(999, ex, "Exception on connecting to database.");
                return new
                {
                    connectionString = _connectionString,
                    message = ex.Message,
                    errorSource = ex.Source
                };
            }

            var json = JsonSerializer.Deserialize<object>(strBuilder.ToString());
            return json ?? new object();
        }

        public async Task<int> CreateSession()
        {
            int id = 0;
            HttpContext? context = _httpContextAccessor.HttpContext;

            try
            {
                using (SqlConnection conn = new SqlConnection(_connectionString))
                {
                    conn.Open();
                    string? sql = _configuration["Sql:CreateSession"];
                    using SqlCommand sqlCmd = new SqlCommand(sql, conn);
                    sqlCmd.Parameters.AddWithNullableValue("@event", Event.CreateSession.ToString());
                    sqlCmd.Parameters.AddWithNullableValue("@headerQueryString", context.Request.QueryString.ToString().Truncate(250));
                    sqlCmd.Parameters.AddWithNullableValue("@headerUserAgent", context.Request.Headers["User-Agent"].ToString().Truncate(250));
                    sqlCmd.Parameters.AddWithNullableValue("@headerSecChUa", context.Request.Headers["sec-ch-ua"].ToString().Truncate(250));
                    try
                    {
                        id = (int?) await sqlCmd.ExecuteScalarAsync() ?? 0;
                    }
                    catch (SqlException ex)
                    {
                        _logger.LogError(999, ex, "SqlException on creating session.");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(999, ex, "Exception on creating session.");
                    }
                    finally
                    {
                        _logger.LogInformation(999, "Inserted session record: id = {0}.", id);
                    }
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(999, ex, "Exception on connecting to database.");
            }

            return id;
        }

        public async Task<int> UpdateSession(int? sessionId, SqlData.Event _event)
        {
            HttpContext? context = _httpContextAccessor.HttpContext;

            //if session does not exist create one...
            if (!sessionId.HasValue)
            {
                sessionId = await CreateSession();
            }

            try
            {
                using (SqlConnection conn = new SqlConnection(_connectionString))
                {
                    conn.Open();

                    // Insert trace data record...
                    string sql = "UPDATE bus.session SET ";
                    sql += "  event = @event, ";
                    sql += "  header_query_string = @headerQueryString, ";
                    sql += "  header_user_agent = @headerUserAgent,";
                    sql += "  header_sec_ch_ua = @headerSecChUa, ";
                    sql += "  updated = getdate() ";
                    sql += "WHERE id = @sessionId;";
                    using SqlCommand sqlCmd = new SqlCommand(sql, conn);
                    sqlCmd.Parameters.AddWithValue("@sessionId", sessionId);
                    sqlCmd.Parameters.AddWithNullableValue("@event", _event.ToString());
                    sqlCmd.Parameters.AddWithNullableValue("@headerQueryString", context.Request.QueryString.ToString().Truncate(250));
                    sqlCmd.Parameters.AddWithNullableValue("@headerUserAgent", context.Request.Headers["User-Agent"].ToString().Truncate(250));
                    sqlCmd.Parameters.AddWithNullableValue("@headerSecChUa", context.Request.Headers["sec-ch-ua"].ToString().Truncate(250));
                    try
                    {
                        await sqlCmd.ExecuteScalarAsync();
                    }
                    catch (SqlException ex)
                    {
                        _logger.LogError(999, ex, "SqlException on updating session.");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(999, ex, "Exception on updating session.");
                    }
                    finally
                    {
                        _logger.LogWarning(999, "Updated session record: id = {0}.", sessionId);
                    }
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(999, ex, "Exception on connecting to database.");
            }

            return (int)sessionId;

        }

        public async Task<object> GetRecentSessions()
        {


            var strBuilder = new StringBuilder();
            int i = 0;

            try
            {
                using (SqlConnection conn = new SqlConnection(_connectionString))
                {
                    conn.Open();
                    string? sql = _configuration["Sql:GetRecentSessions"];
                    int _recentSessionLimit = int.TryParse(_configuration["BT_RecentSessionLimit"], out int value) ? value : 10;
                    using SqlCommand sqlCmd = new SqlCommand(sql, conn);
                    sqlCmd.Parameters.AddWithValue("@number", _recentSessionLimit);
                    try
                    {
                        var reader = await sqlCmd.ExecuteReaderAsync();
                        if (!reader.HasRows)
                        {
                            strBuilder.Append("[]");
                        }
                        else
                        {
                            while (reader.Read())
                            {
                                strBuilder.Append(reader.GetValue(0).ToString());
                                i++;
                            }
                        }
                    }
                    catch (SqlException ex)
                    {
                        _logger.LogError(999, ex, "SqlException on getting recent session records.");

                        return new
                        {
                            connectionString = _connectionString,
                            message = ex.Message
                        };
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(999, ex, "Exception on getting session records.");
                        return new
                        {
                            connectionString = _connectionString,
                            message = ex.Message
                        };
                    }
                    finally
                    {
                        _logger.LogInformation(999, "Retrieved recent session records: {0}.", i);
                    }
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(999, ex, "Exception on connecting to database.");
                return new
                {
                    connectionString = _connectionString,
                    message = ex.Message
                };
            }

            var json = JsonSerializer.Deserialize<object>(strBuilder.ToString());
            return json ?? new object();
        }

        public async Task<object> GetSessionHistory(int sessionId)
        {
            var strBuilder = new StringBuilder();
            int i = 0;

            try
            {
                using (SqlConnection conn = new SqlConnection(_connectionString))
                {
                    conn.Open();
                    string? sql = _configuration["Sql:GetSessionHistory"];
                    using SqlCommand sqlCmd = new SqlCommand(sql, conn);
                    sqlCmd.Parameters.AddWithValue("@sessionId", sessionId);
                    try
                    {
                        var reader = await sqlCmd.ExecuteReaderAsync();
                        if (!reader.HasRows)
                        {
                            strBuilder.Append("[]");
                        }
                        else
                        {
                            while (reader.Read())
                            {
                                strBuilder.Append(reader.GetValue(0).ToString());
                                i++;
                            }
                        }
                    }
                    catch (SqlException ex)
                    {
                        _logger.LogError(999, ex, "SqlException on getting session history records.");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(999, ex, "Exception on getting session history records.");
                    }
                    finally
                    {
                        _logger.LogInformation(999, "Retrieved session history records: {0}.", i);
                    }
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(999, ex, "Exception on connecting to database.");
            }

            var json = JsonSerializer.Deserialize<object>(strBuilder.ToString());
            return json ?? new object();
        }

        public string? GetAllSystemParameters()
        {
            var strBuilder = new StringBuilder();
            int i = 0;
            string? connectionString = _configuration["ConnectionStrings:BusTrackerDb"];
            string? sql = _configuration["Sql:GetAllSystemParameters"];

            try
            {
                using (SqlConnection conn = new SqlConnection(connectionString))
                {
                    conn.Open();

                    // Insert trace data record...
                    using SqlCommand sqlCmd = new SqlCommand(sql, conn);
                    try
                    {
                        var reader = sqlCmd.ExecuteReader();
                        if (!reader.HasRows)
                        {
                            strBuilder.Append("[]");
                        }
                        else
                        {
                            while (reader.Read())
                            {
                                strBuilder.Append(reader.GetValue(0).ToString());
                                i++;
                            }
                        }
                    }
                    catch (SqlException ex)
                    {
                        _logger.LogError(999, ex, "SqlException on getting all parameter records.");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(999, ex, "Exception on getting all parameter records.");
                    }
                    finally
                    {
                        _logger.LogWarning(999, "Retrieved session records: {0}.", i);
                    }
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(999, ex, "Exception on connecting to database.");
            }

            return strBuilder.ToString();
        }

        public string? GetSystemParameter(string parameterName)
        {
            string systemParameter = "";
            string? connectionString = _configuration["ConnectionStrings:BusTrackerDb"];
            string? sql = _configuration["Sql:GetSystemParameter"];

            try
            {
                using (SqlConnection conn = new SqlConnection(connectionString))
                {
                    conn.Open();

                    using SqlCommand sqlCmd = new SqlCommand(sql, conn);
                    sqlCmd.Parameters.AddWithValue("@parameterName", parameterName);
                    try
                    {
                        systemParameter = (string)sqlCmd.ExecuteScalar();
                    }
                    catch (SqlException ex)
                    {
                        _logger.LogError(999, ex, "SqlException on getting parameter record.");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(999, ex, "Exception on getting parameter record.");
                    }
                    finally
                    {
                        _logger.LogWarning(999, "Retrieved parameter record: {0}.", parameterName);
                    }
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(999, ex, "Exception on connecting to database.");
            }

            return systemParameter;
        }

        // will create a class for the data...
        public string? UpdateSystemParameter(SystemParameter systemParameter)
        {
            HttpContext? context = _httpContextAccessor.HttpContext;
            //string? jsonString = "";
            int rowsAffected = 0;
            string? connectionString = _configuration["ConnectionStrings:BusTrackerDb"];
            string? sql = _configuration["Sql:UpdateSystemParameter"];

            try
            {
                using (SqlConnection conn = new SqlConnection(connectionString))
                {
                    conn.Open();

                    using SqlCommand sqlCmd = new SqlCommand(sql, conn);
                    sqlCmd.Parameters.AddWithValue("@parameterName", systemParameter.name);
                    sqlCmd.Parameters.AddWithValue("@version", systemParameter.version);
                    sqlCmd.Parameters.AddWithValue("@parameterValue", systemParameter.value);
                    sqlCmd.Parameters.AddWithValue("@updatedBy", systemParameter.updated_by);

                    try
                    {
                        rowsAffected = (int)sqlCmd.ExecuteNonQuery();
                    }
                    catch (SqlException ex)
                    {
                        _logger.LogError(999, ex, "SqlException on updating parameter.");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(999, ex, "Exception on updating parameter.");
                    }
                    finally
                    {
                        _logger.LogWarning(999, "Updated parameter record: id = {0}.", systemParameter.name);
                    }
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(999, ex, "Exception on connecting to database.");
            }

            // not nice...
            if (rowsAffected < 1)
            {
                var e = new Error("BT-0001", "The System Parameter has been modified by another process, refresh the table to see latest modifications.");

                return System.Text.Json.JsonSerializer.Serialize(e);
            }
            else
            {
                return GetSystemParameter(systemParameter.name?? "");
            }

        }

        public async Task<object> GetBusStopsByAtcoCode(
            string atcoCode
        )
        {
            var strBuilder = new StringBuilder();
            int i = 0;

            try
            {
                using (SqlConnection conn = new SqlConnection(_connectionString))
                {
                    conn.Open();
                    string? sql = _configuration["Sql:GetBusStopsByAtcoCode"];
                    using SqlCommand sqlCmd = new SqlCommand(sql, conn);
                    sqlCmd.Parameters.AddWithValue("@atcoAreaCode", atcoCode);
                    try
                    {
                        var reader = await sqlCmd.ExecuteReaderAsync();
                        if (!reader.HasRows)
                        {
                            strBuilder.Append("[]");
                        }
                        else
                        {
                            while (reader.Read())
                            {
                                strBuilder.Append(reader.GetValue(0).ToString());
                                i++;
                            }
                        }
                    }
                    catch (SqlException ex)
                    {
                        _logger.LogError(999, ex, "SqlException on getting parameter record.");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(999, ex, "Exception on getting parameter record.");
                    }
                    finally
                    {
                        _logger.LogInformation(999, "Retrieved atcoCode data: {0}.", atcoCode);
                    }
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(999, ex, "Exception on connecting to database.");
            }

            var json = JsonSerializer.Deserialize<object>(strBuilder.ToString());
            return json ?? new object();
        }

        public async Task<object> GetBusStopsByBoundingBox(
            double north,
            double east,
            double south,
            double west
        )
        {

            string stringResult = string.Empty;

            try
            {
                using (SqlConnection conn = new SqlConnection(_connectionString))
                {
                    conn.Open();
                    string? sql = _configuration["Sql:GetBusStopsByBoundingBox"];
                    using SqlCommand sqlCmd = new SqlCommand(sql, conn);
                    sqlCmd.Parameters.AddWithValue("@north", north);
                    sqlCmd.Parameters.AddWithValue("@east", east);
                    sqlCmd.Parameters.AddWithValue("@south", south);
                    sqlCmd.Parameters.AddWithValue("@west", west);
                    try

                    {
                        var result = await sqlCmd.ExecuteScalarAsync();
                        stringResult = (result == null) ? string.Empty : (result as string) ?? string.Empty;
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
                        _logger.LogInformation(999, "Retrieved bounding box data.");
                    }
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(999, ex, "Exception on connecting to database.");
            }

            if (stringResult == string.Empty)
            {
                return new object();
            } else
            {
                var json = JsonSerializer.Deserialize<object>(stringResult);
                return json ?? new object();
            }
        }

        public async Task<int> LoadBusStopXML()
        {
            int intResult = 0;

            try
            {
                using (SqlConnection conn = new SqlConnection(_connectionString))
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

            return intResult;
        }


        public async Task<int> CleanBusStopData()
        {
            using (SqlConnection conn = new SqlConnection(_connectionString))
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
                return table.Rows.Count;
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
            string? returnVal = val;

            if (val.Length > 2)
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

