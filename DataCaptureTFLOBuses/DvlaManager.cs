using System;
using System.Reflection.Metadata;
using System.Text;
using System.Text.Json;

public class DVLAManager
{
    private readonly HttpClient _httpClient;
    private string dvlaBaseUrl = "https://driver-vehicle-licensing.api.gov.uk/";
    private string xApiKey = "32soptRDJoYy3C1EyyH11D1h7p7dwnx3kzaTPWz4";
    private string vehicleEnquiry = "vehicle-enquiry/v1/vehicles";

    public DVLAManager()
    {
        _httpClient = new HttpClient();
        _httpClient.BaseAddress = new Uri(dvlaBaseUrl);
        _httpClient.DefaultRequestHeaders.Add("x-api-key", xApiKey);
        _httpClient.DefaultRequestHeaders.Add("accept", "application/json");
    }

    public async Task<Vehicle?> GetVehicleDetails(string registrationNumber)
    {
        using StringContent jsonContent = new(
            JsonSerializer.Serialize(new
            {
                registrationNumber = registrationNumber,
            }),
            Encoding.UTF8,
            "application/json");

        //var response = await _httpClient.PostAsync(vehicleEnquiry, jsonContent);
        var response = await PostWithRetryAsync(vehicleEnquiry, jsonContent);

        var json = await response.Content.ReadAsStringAsync();

        var vehicle =  JsonSerializer.Deserialize<Vehicle>(json);

        return vehicle;
    }

    private async Task<HttpResponseMessage> PostWithRetryAsync(string url, HttpContent content, int maxRetries = 10)
    {
        int retryCount = 0;
        int retryDelay = 1000; // millseconds

        while (true)
        {
            var response = await _httpClient.PostAsync(url, content);

            if ((int)response.StatusCode != 429)
            {
                return response; // Success or not retryable
            } 

            retryCount++;

            if (retryCount > maxRetries)
            {
                Console.WriteLine("Max retry limit reached. Aborting.");
                return response;
            }

            Console.WriteLine($"Received 429. Retrying in {retryDelay}ms (Attempt {retryCount}/{maxRetries})...");
            await Task.Delay(retryDelay); 
        }
    }
}


