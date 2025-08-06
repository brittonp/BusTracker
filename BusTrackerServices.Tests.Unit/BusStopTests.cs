using BusTrackerServices.Data;
using BusTrackerServices.Services;
using FluentAssertions;
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
    public sealed class BusStopTest
    {
        private readonly Mock<IConfiguration> _configMock;
        private readonly Mock<ILogger<BusStop>> _loggerMock;
        private readonly Mock<ISqlData> _sqlDataMock;
        private readonly Mock<IHttpClientFactory> _httpClientFactoryMock;

        public BusStopTest()
        {
            // Initialize common mocks in the constructor
            _configMock = new Mock<IConfiguration>();
            _loggerMock = new Mock<ILogger<BusStop>>();
            _sqlDataMock = new Mock<ISqlData>();
            _httpClientFactoryMock = new Mock<IHttpClientFactory>();

            _configMock.Setup(x => x["BT_Tfl:Next_Bus_URL"]).Returns("https://some-api.com/");
            _configMock.Setup(x => x["BT_Traveline:Next_Bus_URL"]).Returns("https://some-api.com/");
            _configMock.Setup(x => x["BT_Traveline:Siri_Namespace"]).Returns("http://www.siri.org.uk/");
            _configMock.Setup(x => x["BT_Traveline:Requestor_Ref"]).Returns("Requestor_Ref-Test");
            _configMock.Setup(x => x["BT_Traveline:Requestor_Pwd"]).Returns("Requestor_Pwd-Test");
            _configMock.Setup(x => x["BT_Traveline:Request_Content_File_Path"]).Returns("./Data/TravelineNextBusRequest.xml");
        }


        [TestMethod]
        public async Task GetByAtcoCode()
        {
            // Arrange
            var expected = await MockResponseObject("BusStopTest.GetByAtcoCode.json");
            string atcoCode = "490";

            _sqlDataMock
                .Setup(s => s.GetBusStopsByAtcoCode(atcoCode))
                .ReturnsAsync(expected);

            // Inject mocked objects into BusStop class
            var busStop = new BusStop(_configMock.Object, _loggerMock.Object, _sqlDataMock.Object, _httpClientFactoryMock.Object);

            // Act
            var actual = await busStop.GetByAtcoCode(atcoCode);

            // Assert
            JsonSerializer.Serialize(actual).Should().BeEquivalentTo(JsonSerializer.Serialize(expected));
        }

        [TestMethod]
        public async Task GetByBoundingBox()
        {
            // Arrange
            var expected = await MockResponseObject("BusStopTest.GetByBoundingBox.json");
            double north = 51.432822;
            double east = -0.250454;
            double south = 51.406247;
            double west = -0.332851;

            _sqlDataMock
                .Setup(s => s.GetBusStopsByBoundingBox(north, east, south, west))
                .ReturnsAsync(expected);

            // Inject mocked objects into BusStop class
            var busStop = new BusStop(_configMock.Object, _loggerMock.Object, _sqlDataMock.Object, _httpClientFactoryMock.Object);

            // Act
            var actual = await busStop.GetByBoundingBox(north, east, south, west);

            // Assert
            JsonSerializer.Serialize(actual).Should().BeEquivalentTo(JsonSerializer.Serialize(expected));
        }

        [TestMethod]
        public async Task GetArrivals()
        {
            // Arrange
            var expectedJson = await MockResponseObject("BusStopTest.GetArrivals.json");
            var mockedTFLJson = await ReadFileContent("BusStopTest.GetArrivals-TFL.json");
            string mockedTravelineXml = await ReadFileContent("BusStopTest.GetArrivals-Traveline.xml");

            string naptanId = "40004406038A"; //Epsom A

            // mock TFL (GET)
            var tflHttpMessageHandlerMock = new Mock<HttpMessageHandler>();

            tflHttpMessageHandlerMock
                .Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => req.Method == HttpMethod.Get),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.OK,
                    Content = new StringContent(mockedTFLJson)
                });

            var clientTfl = new HttpClient(tflHttpMessageHandlerMock.Object);

            // mock Traveline (POST)
            var travelineHttpMessageHandlerMock = new Mock<HttpMessageHandler>();
            travelineHttpMessageHandlerMock
                .Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => req.Method == HttpMethod.Post),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.OK,
                    Content = new StringContent(mockedTravelineXml)
                });

            var clientTraveline = new HttpClient(travelineHttpMessageHandlerMock.Object);

            // Setup factory to return the mocked clients
            _httpClientFactoryMock.Setup(f => f.CreateClient("Tfl")).Returns(clientTfl);
            _httpClientFactoryMock.Setup(f => f.CreateClient("Traveline")).Returns(clientTraveline);

            var busStop = new BusStop(_configMock.Object, _loggerMock.Object, _sqlDataMock.Object, _httpClientFactoryMock.Object);

            // Act
            var actual = await busStop.GetArrivals(naptanId);

            // Assert
            JsonSerializer.Serialize(actual).Should().BeEquivalentTo(JsonSerializer.Serialize(expectedJson));
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
