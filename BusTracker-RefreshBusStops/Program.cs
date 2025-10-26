using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace BusTracker
{
    internal class Program
    {

        static async Task Main(string[] args)
        {
            var services = CreateServices();

            Stops stops = services.GetRequiredService<Stops>();

            //await stops.RefreshAsync();
            await stops.DirectRefresh();

        }

        private static ServiceProvider CreateServices()
        {
            IConfiguration configuration = SetupConfiguration();

            var serviceProvider = new ServiceCollection()
                .AddLogging(options =>
                {
                    options.ClearProviders();
                    options.AddConsole();
                    options.AddDebug();
                    options.AddEventLog(eventLogSettings =>
                    {
                        eventLogSettings.SourceName = "BusTracker";
                    });

                    options.AddFilter("Microsoft", LogLevel.Warning); // suppress Microsoft noise
                    options.AddFilter("System", LogLevel.Warning);    // suppress System noise
                    options.AddFilter("BusTracker", LogLevel.Information); // show your app logs
                    options.AddFilter((category, level) =>
                    {
                        if (category.Contains("ProjNet") && level == LogLevel.Debug)
                            return false; // suppress ProjNet debug messages
                        return true;
                    });
                })
                .AddSingleton(configuration)
                .AddHttpContextAccessor()
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
