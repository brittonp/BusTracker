// program.cs
// This file is part of the Bus Tracker Services project.
using BusTrackerServices.Data;
using BusTrackerServices.Services;
using DotSpatial.Projections;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.FileProviders;
using Scalar.AspNetCore;
using ISession = BusTrackerServices.Services.ISession;
using ISqlData = BusTrackerServices.Data.ISqlData;
using SqlData = BusTrackerServices.Data.SqlData;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Removed since moving all services to minimal apis...
//builder.Services.AddControllers();

// Added as suggested in https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection?view=aspnetcore-7.0
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient();

builder.Services.AddTransient<ISqlData, SqlData>();
builder.Services.AddTransient<ISession, Session>();
builder.Services.AddTransient<IBusStop, BusStop>();
builder.Services.AddTransient<IBusLocation, BusLocation>();
builder.Services.AddTransient<IDisruptions, Disruptions>();
builder.Services.AddSingleton<OperatorCache>();

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
            //.WithLayout(ScalarLayout.Classic)
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

// EnableControllers...
// Removed since moving all services to minimal apis...
//app.UseAuthorization();
//app.MapControllers();

app.UseSession();

//minimal apis...
// Session api group...
var sessionGroup = app.MapGroup("/Session")
    .WithTags("Session");

sessionGroup.MapGet("/PingDatabase", async (ISession session) =>
{
    var result = await session.PingDatabase();
    return Results.Ok(result);

})
    .WithDescription("Ping the database and return information, (minimal api)");

sessionGroup.MapGet("/Create", async (ISession session) =>
{
    //var random = new Random();
    //int value = random.Next(1, 11);
    //Console.WriteLine(value);
    //app.Logger.LogInformation($"Delay seconds: {value}");
    //System.Threading.Thread.Sleep(TimeSpan.FromSeconds(value));
    var result = await session.CreateSession();
    return Results.Ok(result);
})
    .WithDescription("Create a session record and returns the session id, (minimal api)");

sessionGroup.MapGet("/GetRecentSessions", async (ISession session) =>
{
    var result = await session.GetRecentSessions();
    return Results.Json(result);
})
    .WithDescription($"Returns the {(int.TryParse(builder.Configuration["BT_RecentSessionLimit"], out int value) ? value : 10)} recent session records, (minimal api)");

sessionGroup.MapGet("/GetSessionHistory", async (ISession session, int id =0) =>
{
    var result = await session.GetSessionHistory(id);

    return Results.Json(result);

})
    .WithDescription("Returns the audit records of a specified session id, (minimal api)");

// Bus Stop Api group...
var busStopGroup = app.MapGroup("/BusStop")
    .WithTags("Bus Stop");

busStopGroup.MapGet("/GetByBoundingBox", async (
        IBusStop busStop,
        double north = 51.432822,
        double east = -0.250454,
        double south = 51.406247,
        double west = -0.332851
    ) =>
{
    var result = await busStop.GetByBoundingBox(north, east, south, west);

    return Results.Json(result);

})
    .WithDescription("Returns the bus stops within a bounding box, (minimal api)");

busStopGroup.MapGet("/GetByAtcoCode", async (IBusStop busStop, string atcoCode = "490"
) =>
{
    var result = await busStop.GetByAtcoCode(atcoCode);

    return Results.Json(result);

})
    .WithDescription("Returns the bus stops linked to a specified atcoAreaCode, (minimal api)");


busStopGroup.MapGet("/GetArrivals", async (IBusStop busStop,
    string naptanId = "40004406036A"  // Epsom A
    // string naptanId = "490018665S" // Latchemere Road South
) =>
{
    var result = await busStop.GetArrivals(naptanId);

    return Results.Json(result);

})
    .WithDescription("Returns the upcoming arrivals at a bus stop identified by its naptanId, (minimal api)");

// Session api group...
var busLocationGroup = app.MapGroup("/BusLocation")
    .WithTags("Bus Location");

busLocationGroup.MapGet("/Get", async (IBusLocation busLocation,
    string? operatorRef = null, //"TFLO",
    string? lineRef = null,
    string? boundingBox = null, //"-0.332851,51.406247,-0.250454,51.432822",
    string? vehicleRef = null
    ) =>
{
    try
    {
        var result = await busLocation.Get(operatorRef, lineRef, boundingBox, vehicleRef);
        return Results.Json(result);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(ex.Message);
    }
})
.WithDescription("Returns the location of buses identified by query parameters, (minimal api)");

// Session api group...
var disruptionsGroup = app.MapGroup("/Disruption")
    .WithTags("Disruptions");

disruptionsGroup.MapGet("/Get", async (IDisruptions disruptions) =>
{
    try
    {
        var result = await disruptions.Get();
        return Results.Json(result);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(ex.Message);
    }
})
.WithDescription("Returns disruptions, (minimal api)");

var operatorLinesGroup = app.MapGroup("/OperatorLines")
    .WithTags("Operator Lines");

operatorLinesGroup.MapGet("/Get", async (OperatorCache operatorLines) =>
{
    var result = await operatorLines.GetData();
    return Results.Json(result);
})
    .WithDescription("Returns all the cached operators and lines, (minimal api)");

app.Run();


