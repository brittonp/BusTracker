using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.AzureAppServices;
using System.Runtime.CompilerServices;
using System.IO;

namespace BusTrackerWebJob.OperatorRoutes
{
    internal class Program
    {

        static async Task Main(string[] args)
        {

            var services = CreateServices();

            OperatorRoutes operatorRoutes = services.GetRequiredService<OperatorRoutes>();

            await operatorRoutes.RefreshCacheAsync();

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
                .AddSingleton<OperatorRoutes>()
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
