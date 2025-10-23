using BusTrackerServices.Data;
using BusTrackerServices.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using System.Net;
using System.Text.Json;

namespace BusTrackerServices.Tests.Unit
{
    [TestClass]
    public sealed class DataTest
    {
        [TestMethod]
        public async Task PingDatabase_WhenSqlThrowsException_ReturnsErrorObject()
        {
            // Arrange
            string expectedSql = "SELECT 'TestData'";


            // Create mocks
            var mockConfiguration = new Mock<IConfiguration>();
            mockConfiguration
                .Setup(cfg => cfg["Sql:PingDatabase"])
                .Returns("INVALID SQL TO TRIGGER EXCEPTION");

            var mockLogger = new Mock<ILogger<SqlData>>();
            var mockHttpContextAccessor = new Mock<HttpContextAccessor>();

            var sqlData = new SqlData(mockConfiguration.Object, mockLogger.Object, mockHttpContextAccessor.Object);

            // Act
            var actual = await sqlData.PingDatabase();

            // Assert
            actual.Should().NotBeNull();
        }

        private async Task<object> MockResponseObject(string file)
        {
            var _filePath = Path.Combine(AppContext.BaseDirectory, "./TestData/", file);
            var jsonData = await File.ReadAllTextAsync(_filePath);

            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var result = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(jsonData, options);
            //var result = JsonSerializer.Deserialize<Dictionary<string, object>>(jsonData, options);

            return result ?? new object();
        }

        private async Task<string> ReadFileContent(string file)
        {
            var _filePath = Path.Combine(AppContext.BaseDirectory, "./TestData/", file);
            var content = await File.ReadAllTextAsync(_filePath);
            return content;
        }

    }
}
