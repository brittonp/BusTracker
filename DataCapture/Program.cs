using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Net.Http;
using System.Threading.Tasks;
using System.Xml;
using System.Xml.Linq;
using static System.Runtime.InteropServices.JavaScript.JSType;

class Program
{
    static async Task Main(string[] args)
    {
        string vehicleRef = "BV67JYW"; // Example vehicle reference
        string url = $"https://data.bus-data.dft.gov.uk/api/v1/datafeed?api_key=14252c40f9ca2de40a49debe9fb77253321025c7&vehicleRef={vehicleRef}";
        JArray jsonArray = new JArray();

        string downloadsPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
        string filePath = Path.Combine(downloadsPath, "BV67JYW.json");

        try
        {

            while (true)
            {

                Console.WriteLine($"Checking at {DateTime.Now}");
                string xmlContent = await DownloadXmlAsync(url);
                string jsonContent = ConvertXmlToJson(xmlContent);
                JObject json = JObject.Parse(jsonContent);
                var jsonServiceDelivery = json?.SelectToken("Siri.ServiceDelivery");

                if (jsonServiceDelivery == null)
                {
                    Console.WriteLine("No ServiceDelivery found in the JSON.");
                    break;
                }

                jsonArray.Add(jsonServiceDelivery);

                // Write the JSON data to the file
                await File.WriteAllTextAsync(filePath, jsonArray.ToString(Newtonsoft.Json.Formatting.Indented));

                // Wait for 1 minute
                await Task.Delay(TimeSpan.FromMinutes(1));
            }
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

    static string ConvertXmlToJson(string xml)
    {
        XmlDocument doc = new XmlDocument();
        doc.LoadXml(xml);
        return JsonConvert.SerializeXmlNode(doc, Newtonsoft.Json.Formatting.Indented);
    }
}
