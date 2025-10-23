using BusTrackerServices.Data;
using BusTrackerServices.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using FluentAssertions;
using Moq;
using System.Text.Json;

namespace BusTrackerServices.Tests.Unit
{
    [TestClass]
    public sealed class SessionTest
    {

        private readonly Mock<IConfiguration> _configMock;
        private readonly Mock<ILogger<Session>> _loggerMock;
        private readonly Mock<ISqlData> _sqlDataMock;

        // Constructor to initialize mocks
        public SessionTest()
        {
            // Initialize all mocks in the constructor
            _configMock = new Mock<IConfiguration>();
            _loggerMock = new Mock<ILogger<Session>>();
            _sqlDataMock = new Mock<ISqlData>();
        }

        [TestMethod]
        public async Task PingDatabase()
        {
            // Arrange
            var expected = await MockResponseObject("SessionTest.PingDatabase.json");

            // Create mock of ISqlData
            _sqlDataMock
                .Setup(s => s.PingDatabase())
                .ReturnsAsync(expected);

            // Inject mocked objects into Session class
            var session = new Session(_configMock.Object, _loggerMock.Object, _sqlDataMock.Object);

            // Act
            var actual = await session.PingDatabase();

            // Assert
            JsonSerializer.Serialize(actual).Should().BeEquivalentTo(JsonSerializer.Serialize(expected));
        }
        [TestMethod]
        public async Task PingDatabaseError()
        {
            // Arrange
            var expected = await MockResponseObject("SessionTest.PingDatabase-Error.json");

            // Create mock of ISqlData
            _sqlDataMock
                .Setup(s => s.PingDatabase())
                .ReturnsAsync(expected);

            // Inject mocked objects into Session class
            var session = new Session(_configMock.Object, _loggerMock.Object, _sqlDataMock.Object);

            // Act
            var actual = await session.PingDatabase();

            // Assert
            JsonSerializer.Serialize(actual).Should().BeEquivalentTo(JsonSerializer.Serialize(expected));
        }

        [TestMethod]
        public async Task CreateSession()
        {
            // Arrange
            var expected = await MockResponseObject("SessionTest.CreateSession.json");

            _configMock.Setup(x => x["USE_DATABASE"]).Returns("true");
            _configMock.Setup(x => x["ASPNETCORE_ENVIRONMENT"]).Returns("Development");
            _configMock.Setup(x => x["GoogleMapKey"]).Returns("googleMapKeyTest");
            _configMock.Setup(x => x["SessionStartMessage"]).Returns("startMessageTest");
            _configMock.Setup(x => x["MapProvider"]).Returns("Leaflet");
            _configMock.Setup(x => x["ThunderforestMapKey"]).Returns("thunderforestMapKeyTest");
            _configMock.Setup(x => x["BusTrackerMapKey"]).Returns("busTrackerMapKeyTest");

            _sqlDataMock
                .Setup(s => s.CreateSession())
                .ReturnsAsync(3470);

            // Inject mocked objects into Session class
            var session = new Session(_configMock.Object, _loggerMock.Object, _sqlDataMock.Object);

            // Act
            var actual = await session.CreateSession();

            // Assert
            JsonSerializer.Serialize(actual).Should().BeEquivalentTo(JsonSerializer.Serialize(expected));
        }

        private async Task<object> MockResponseObject(string file)
        {
            var _filePath = Path.Combine(AppContext.BaseDirectory, "./TestData/", file);
            var jsonData = await File.ReadAllTextAsync(_filePath);

            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            //var result = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(jsonData, options);
            var result = JsonSerializer.Deserialize<Dictionary<string, object>>(jsonData, options);

            return result ?? new object();
        }

    }
}
