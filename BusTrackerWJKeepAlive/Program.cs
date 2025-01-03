using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.AzureAppServices;
using System.Runtime.CompilerServices;
using System.IO;

namespace BusTrackerWebJob.KeepAlive
{
    internal class Program
    {

        static async Task Main(string[] args)
        {

            var services = CreateServices();

            KeepAlive keepAlive = services.GetRequiredService<KeepAlive>();

            await keepAlive.Ping();

        }

        private static ServiceProvider CreateServices()
        {
            IConfiguration configuration = SetupConfiguration();

            var serviceProvider = new ServiceCollection()
                .AddLogging(options =>
                {
                    options.ClearProviders();
                    options.AddConsole();
                    options.AddEventLog(eventLogSettings =>
                    {
                        eventLogSettings.SourceName = "BusTracker";
                    });
                })
                .AddSingleton(configuration)
                .AddSingleton<KeepAlive>()
                .BuildServiceProvider();

            return serviceProvider;
        }

        private static IConfiguration SetupConfiguration()
        {
            return new ConfigurationBuilder()
                .AddUserSecrets<Program>()
                .AddEnvironmentVariables()
                .Build();
        }
    }
}
