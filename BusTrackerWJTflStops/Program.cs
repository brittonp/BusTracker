using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.AzureAppServices;
using System.Runtime.CompilerServices;
using System.IO;
using BusTrackerServices.Data;

namespace BusTrackerWebJob.Stops
{
    internal class Program
    {

        static async Task Main(string[] args)
        {

            var services = CreateServices();

            Stops stops = services.GetRequiredService<Stops>();

            //await stops.RefreshCacheAsync();
            await stops.RefreshAsync();

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
                .AddHttpContextAccessor()
                .AddTransient<BusTrackerServices.Data.ISqlData, BusTrackerServices.Data.SqlData>()
                .AddSingleton<Stops>()
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
