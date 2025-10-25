using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ISqlData = BusTrackerAPI.Data.ISqlData;
using SqlData = BusTrackerAPI.Data.SqlData;

namespace BusTrackerWebJob.Stops
{
    internal class Program
    {

        static async Task Main(string[] args)
        {
            var services = CreateServices();

            Stops stops = services.GetRequiredService<Stops>();

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
                .AddTransient<ISqlData, SqlData>()
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
