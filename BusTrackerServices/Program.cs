using BusTrackerServices.Data;
using BusTrackerServices.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.FileProviders;
using Microsoft.OpenApi;
using Microsoft.OpenApi.Models;
using Scalar.AspNetCore;


var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Added as suggested in https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection?view=aspnetcore-7.0
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient();
builder.Services.AddTransient<BusTrackerServices.Data.ISqlData, BusTrackerServices.Data.SqlData>();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();

//logging - added by brittonp 26-Sep-2023
builder.Logging
    .ClearProviders()
    .AddDebug()
    .AddEventLog(eventLogSettings =>
    {
        eventLogSettings.SourceName = "BusTracker";
    })
    .AddAzureWebAppDiagnostics(); 

//  in-memory session provider, taken from https://learn.microsoft.com/en-us/aspnet/core/fundamentals/app-state?view=aspnetcore-7.0 ...
builder.Services.AddDistributedMemoryCache();

builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(60);
    options.Cookie.Name = ".BusTracker.Session";
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

builder.Configuration.AddJsonFile("sqlCmds.json", optional: true, reloadOnChange: true);


builder.Services.AddOpenApi(options =>
{
// This line is required because in dev (on IIS) the server is presented as http://*:port#, but * is not recognised.
    options.AddDocumentTransformer((document, context, cancellationToken) =>
    {
        document.Servers.Clear();
        return Task.CompletedTask;
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment() || app.Environment.IsStaging()  || app.Environment.IsEnvironment("Test"))
{
    app.MapOpenApi();
    app.MapScalarApiReference(options =>
        options
            .WithTheme(ScalarTheme.None)
            .WithLayout(ScalarLayout.Classic)
            .WithDarkMode(false)
            .WithSidebar(true)
            .WithDotNetFlag(true)
    ); 

    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(Path.Combine(builder.Environment.ContentRootPath, "public")),
        RequestPath = "/public"
    });
}

app.UseAuthorization();

app.UseSession();

app.MapControllers();

//minimal apis...
app.MapGet("/SessionMinimalApi/Create", async (IConfiguration configuration, ISqlData sqlData, ILogger<Session> logger) =>
{
    Session session = new Session(configuration, logger, sqlData);

    var result = await session.Create();

    return Results.Json(result.Value);
})
.WithTags("SessionMinimalApi");

app.Run();
