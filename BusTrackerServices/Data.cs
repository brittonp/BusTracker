using Microsoft.Data.SqlClient;
using Microsoft.AspNetCore.Http;
using BusTrackerServices;
using BusTrackerServices.Controllers;
using Microsoft.EntityFrameworkCore;

namespace BusTrackerServices.Data
{

    public interface ISqlData
    {
        int CreateSession();
        int UpdateSession(int? sessionId, SqlData.Event _event);
    }

    public class SqlData : ISqlData
    {
        public enum Event
        {
            CreateSession,
            LocationQuery,
            DisruptionQuery,
            Other
        }

        private readonly IConfiguration _configuration;
        private readonly ILogger<SessionController> _logger;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public SqlData(
            IConfiguration configuration,
            ILogger<SessionController> logger,
            IHttpContextAccessor httpContextAccessor
            ) 
        {
            _configuration = configuration;
            _logger = logger;
            _httpContextAccessor = httpContextAccessor;
        }

        public int CreateSession()
        {
            int id = 0;
            HttpContext? context = _httpContextAccessor.HttpContext;
            string? connectionString = _configuration["ConnectionStrings:BusTrackerDb"];

            try
            {
                using (SqlConnection conn = new SqlConnection(connectionString))
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
                        id = (int)sqlCmd.ExecuteScalar();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(999, ex, "On inserting session record.");
                    }
                    finally
                    {
                        _logger.LogWarning(999, "Inserted session record: id = {0}.", id);
                    }
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(999, ex, "On connecting to database.");
            }

            return id;
        }

        public int UpdateSession(int? sessionId, SqlData.Event _event)
        {
            HttpContext? context = _httpContextAccessor.HttpContext;
            string? connectionString = _configuration["ConnectionStrings:BusTrackerDb"];

            //if session does not exist create one...
            if (!sessionId.HasValue)
                sessionId = CreateSession();

            try
            {
                using (SqlConnection conn = new SqlConnection(connectionString))
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
                        sqlCmd.ExecuteScalar();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(999, ex, "On updating session record: id = {0}.", sessionId);
                        return (int)sessionId;
                    }
                    finally
                    {
                        _logger.LogWarning(999, "Updated session record: id = {0}.", sessionId);
                    }
                }

            }
            catch (Exception ex)
            {
                _logger.LogError(999, ex, "On connecting to database.");
            }

            return (int)sessionId;

        }
    }
}
