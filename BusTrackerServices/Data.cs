using Microsoft.Data.SqlClient;
using Microsoft.AspNetCore.Http;
using BusTrackerServices;
using BusTrackerServices.Controllers;
using Microsoft.EntityFrameworkCore;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using BusTrackerServices.Models;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;
using Microsoft.AspNetCore.Routing;
using System.Data;


namespace BusTrackerServices.Data
{

    public interface ISqlData
    {
        Task<int> CreateSession();
        Task<int> UpdateSession(int? sessionId, SqlData.Event _event);

        string? GetRecentSessions();

        string? GetSessionHistory(int sessionId);

        string? GetAllSystemParameters();

        string? GetSystemParameter(string parameterName);

        string? UpdateSystemParameter(SystemParameter systemParameter);

        JsonResult? GetBusStopsByAtcoCode(string atcoCode);

        JsonResult? GetBusStopsByBoundingBox(double north, double east, double south, double west);

        int LoadBusStopXML();

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
        private readonly ILogger<SessionController> _logger;
        private readonly IHttpContextAccessor _httpContextAccessor;

        private string? _connectionString;

        public SqlData(
            IConfiguration configuration,
            ILogger<SessionController> logger,
            IHttpContextAccessor httpContextAccessor
            ) 
        {
            _configuration = configuration;
            _logger = logger;
            _httpContextAccessor = httpContextAccessor;
            _connectionString = _configuration["ConnectionStrings:BusTrackerDb"];
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

                    // Insert trace data record...
                    string sql = "INSERT INTO dbo.bt_session (event, header_query_string, header_user_agent, header_sec_ch_ua ) ";
                    sql += "VALUES (@event, @headerQueryString, @headerUserAgent, @headerSecChUa); ";
                    sql += "SELECT CAST(SCOPE_IDENTITY() AS INT);";
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
                        _logger.LogWarning(999, "Inserted session record: id = {0}.", id);
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
                sessionId = await CreateSession();

            try
            {
                using (SqlConnection conn = new SqlConnection(_connectionString))
                {
                    conn.Open();

                    // Insert trace data record...
                    string sql = "UPDATE dbo.bt_session SET ";
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

        public string? GetRecentSessions()
        {
            var strBuilder = new StringBuilder();
            int i = 0;
            string? connectionString = _configuration["ConnectionStrings:BusTrackerDb"];
            string? sql = _configuration["Sql:GetRecentSessions"];

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
                        _logger.LogError(999, ex, "SqlException on getting recent session records.");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(999, ex, "Exception on getting session records.");
                    }
                    finally
                    {
                        _logger.LogWarning(999, "Retrieved recent session records: {0}.", i);
                    }
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(999, ex, "Exception on connecting to database.");
            }

            return strBuilder.ToString();
        }

        public string? GetSessionHistory(int sessionId)
        {
            var strBuilder = new StringBuilder();
            int i = 0;
            string? connectionString = _configuration["ConnectionStrings:BusTrackerDb"];
            string? sql = _configuration["Sql:GetSessionHistory"];

            try
            {
                using (SqlConnection conn = new SqlConnection(connectionString))
                {
                    conn.Open();

                    // Insert trace data record...
                    using SqlCommand sqlCmd = new SqlCommand(sql, conn);
                    sqlCmd.Parameters.AddWithValue("@sessionId", sessionId);
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
                        _logger.LogError(999, ex, "SqlException on getting session history records.");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(999, ex, "Exception on getting session history records.");
                    }
                    finally
                    {
                        _logger.LogWarning(999, "Retrieved session history records: {0}.", i);
                    }
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(999, ex, "Exception on connecting to database.");
            }

            return strBuilder.ToString();
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
            string? jsonString = "";
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

        public JsonResult? GetBusStopsByAtcoCode(
            string atcoCode = "490"
        )
        {
            string? connectionString = _configuration["ConnectionStrings:BusTrackerDb"];
            string? sql = _configuration["Sql:GetBusStopsByAtcoCode"];
            string stringResult = string.Empty;

            try
            {
                using (SqlConnection conn = new SqlConnection(connectionString))
                {
                    conn.Open();

                    using SqlCommand sqlCmd = new SqlCommand(sql, conn);
                    sqlCmd.Parameters.AddWithValue("@atcoAreaCode", atcoCode);
                    try
                    {
                        stringResult = (string)sqlCmd.ExecuteScalar();
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

            JsonResult jsonResult = new JsonResult(stringResult);

            _logger.LogInformation(4103, "Get GetBusStopsByAtcoCode completed");

            return jsonResult;
        }

        public JsonResult? GetBusStopsByBoundingBox(
            double north = 51.432822,
            double east = -0.250454,
            double south = 51.406247,
            double west = -0.332851
        )
        {

            //string? filePath = _configuration["BT_Stops_Json_File_Path"];
            //_logger.LogInformation(4102, $"Bus Stops date source: {filePath}");

            //string jsonString = System.IO.File.ReadAllText(filePath);
            //JArray jsonArr = JArray.Parse(jsonString);
            //var result = jsonArr
            //    .Where(bs => (double?)bs["position"]["lat"] < north && (double?)bs["position"]["lat"] > south
            //        && (double?)bs["position"]["lng"] < east && (double?)bs["position"]["lng"] > west);

            //string stringResult = JsonConvert.SerializeObject(result);
            //JsonResult jsonResult = new JsonResult(stringResult);

            //_logger.LogInformation(4103, "Get Bus Stops completed");

            //return jsonResult;


            string? connectionString = _configuration["ConnectionStrings:BusTrackerDb"];
            string? sql = _configuration["Sql:GetBusStopsByBoundingBox"];
            string stringResult = string.Empty;

            try
            {
                using (SqlConnection conn = new SqlConnection(connectionString))
                {
                    conn.Open();

                    using SqlCommand sqlCmd = new SqlCommand(sql, conn);
                    sqlCmd.Parameters.AddWithValue("@north", north);
                    sqlCmd.Parameters.AddWithValue("@east", east);
                    sqlCmd.Parameters.AddWithValue("@south", south);
                    sqlCmd.Parameters.AddWithValue("@west", west);
                    try
                    {
                        stringResult = (string)sqlCmd.ExecuteScalar();
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

            JsonResult jsonResult = new JsonResult(stringResult);

            _logger.LogInformation(4103, "Get GetBusStopsByBoundingBox completed");

            return jsonResult;
        }

        public int LoadBusStopXML()
        {

            string? connectionString = _configuration["ConnectionStrings:BusTrackerDb"];
            string sql = "dbo.sp_bt_load_busstop_xml";
            string stringResult = string.Empty;
            int intResult = 0;

            try
            {
                using (SqlConnection conn = new SqlConnection(connectionString))
                {
                    conn.Open();

                    using SqlCommand sqlCmd = new SqlCommand(sql, conn);
                    sqlCmd.CommandType = CommandType.StoredProcedure;

                    SqlParameter returnVal = new SqlParameter
                    {
                        ParameterName = "@retVal",
                        SqlDbType = SqlDbType.Int,
                        Direction = ParameterDirection.Output,
                    };
                    sqlCmd.Parameters.Add(returnVal);

                    try
                    {
                        //intResult = (int)sqlCmd.ExecuteScalar();
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

            _logger.LogInformation(4103, "Get LoadBusStopXML completed");

            return intResult;
        }

    }
}

