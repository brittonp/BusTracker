using System.Text.Json;
using System.Xml.Serialization;

class Program
{
    static async Task Main(string[] args)
    {
        string operatorRef = "TFLO"; // Example operator reference
        string url = $"https://data.bus-data.dft.gov.uk/api/v1/datafeed?api_key=14252c40f9ca2de40a49debe9fb77253321025c7&operatorRef={operatorRef}";

        string downloadsPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
        string filePath = Path.Combine(downloadsPath, $"{operatorRef}.json");

        DVLAManager dvlaManager = new DVLAManager();

        try
        {
            Console.WriteLine($"Start time: {DateTime.Now}");

            string xmlContent = await DownloadXmlAsync(url);

            XmlSerializer serializer = new XmlSerializer(typeof(Siri));
            using StringReader reader = new StringReader(xmlContent);
            Siri siri = (Siri)serializer.Deserialize(reader);
            List<Vehicle> vehicles = new List<Vehicle>();

            int i = 0;
            int numVehicles = siri.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity.Count();
            foreach (var vehicleActivity in siri.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity)
            {
                var vehicleRef = vehicleActivity.MonitoredVehicleJourney.VehicleRef;

                var vehicle = await dvlaManager.GetVehicleDetails(vehicleRef);

                if (vehicle.registrationNumber != null)
                {
                    vehicles.Add(vehicle);

                    i++;
                    if (i % 100 == 0)
                    {
                        Console.WriteLine($"Processes {i} vehicles of {numVehicles}");
                    }
                }

            }

            // Serialize the list to JSON
            string json = JsonSerializer.Serialize(vehicles, new JsonSerializerOptions { WriteIndented = true });

            // Write the JSON data to the file
            await File.WriteAllTextAsync(filePath, json);

        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
        }
    }

    static async Task<string> DownloadXmlAsync(string url)
    {
        using HttpClient client = new HttpClient();
        return await client.GetStringAsync(url);
    }

}
