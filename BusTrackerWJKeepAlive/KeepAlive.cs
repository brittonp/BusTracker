using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BusTrackerWebJob.KeepAlive
{

    public interface IKeepAlive
    {   
        Task Ping();
    }

    public class KeepAlive : IKeepAlive
    {
        private static ILogger? _logger;
        private static IConfiguration? _configuration;

        public KeepAlive(
            IConfiguration configuration,
            ILogger<KeepAlive> logger
        )
        {
            _configuration = configuration;
            _logger = logger;

        }

        public async Task Ping()
        {
            Console.WriteLine("BusTrackerKeepAlive");
            Console.WriteLine($"Start time {DateTime.Now}");

            //foreach (var item in _configuration.GetChildren())
            //{
            //    Console.WriteLine($"{item.Key} : {item.Value}");
            //}

            //Console.WriteLine(_configuration["WEBSITE_HOSTNAME"]);

            string pingUrl = _configuration["WEBSITE_HOSTNAME"] != null ? $"https://{_configuration["WEBSITE_HOSTNAME"]}/Admin/Ping" : @"http://localhost:8082/Admin/Ping";

            using (var client = new HttpClient())
            {
                var response = await client.GetAsync(pingUrl);
                Console.WriteLine($"Ping URL: {pingUrl}");
                Console.WriteLine($"Response Status Code: {response.StatusCode}");
            }

            Console.WriteLine($"End time {DateTime.Now}");
            Console.WriteLine("Completed.");

        }

        private static void ShowThreadInformation(String taskName)
        {
            return;

            String? msg = null;
            Thread thread = Thread.CurrentThread;
            msg = String.Format("{0} thread information\n", taskName) +
                    String.Format("   Background: {0}\n", thread.IsBackground) +
                    String.Format("   Thread Pool: {0}\n", thread.IsThreadPoolThread) +
                    String.Format("   Thread ID: {0}\n", thread.ManagedThreadId);
            Console.WriteLine(msg);
        }
    }
}
