using BusTrackerAPI.Data;
using BusTrackerAPI.Models;
using System;
using System.Collections.Generic;
using System.Runtime.Caching;
using System.Text.Json;


namespace BusTrackerAPI.Services
{
    public class OperatorCache
    {
        private static readonly ObjectCache _cache = MemoryCache.Default;
        private static readonly string CacheKey = "OperatorCache";
        private readonly IConfiguration _configuration;
        private readonly ILogger<OperatorCache> _logger;
        private readonly ISqlData _sqlData;

        public OperatorCache(
            IConfiguration configuration,
            ILogger<OperatorCache> logger,
            ISqlData sqlData)
        {
            _configuration = configuration;
            _logger = logger;
            _sqlData = sqlData;
        }

        public async Task<List<Operator>> GetData()
        {
            if (!(_cache[CacheKey] is List<Operator> cachedData))
            {
                _logger.LogInformation(4104, "Refreshing Operator cache");
                cachedData = await LoadData();
                _cache.Set(CacheKey, cachedData, DateTimeOffset.Now.AddMinutes(30)); // Expires in 30 minutes
            }
            return cachedData;
        }

        private async Task<List<Operator>> LoadData()
        {
            // Sourced from a file (cheaper than using db)...
            string filePath = _configuration["BT_Operator_Routes_Json_File_Path"] ?? string.Empty;
            string json = await File.ReadAllTextAsync(filePath); // Read JSON file

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            return JsonSerializer.Deserialize<List<Operator>>(json, options) ?? [];
        }
    }
}
