using Microsoft.Extensions.FileProviders;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Added as suggested in https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection?view=aspnetcore-7.0
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient();
builder.Services.AddTransient<BusTrackerServices.Data.ISqlData, BusTrackerServices.Data.SqlData>();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

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

builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Version = "1.0.0",
        Title = "BusTracker .Net Core API",
        Description = "A .NET Core API for BusTracker, this API is built in C# .NET Core.",
        //TermsOfService = new Uri("https://example.com/terms"),
        Contact = new OpenApiContact
        {
            Name = "GitHub",
            Url = new Uri("https://github.com/brittonp/BusTracker")
        },
        License = new OpenApiLicense
        {
            Name = "MIT Licence",
            Url = new Uri("https://bustrackerservices.azurewebsites.net/public/licence.html") 
        }
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment() || app.Environment.IsStaging()  || app.Environment.IsEnvironment("Test"))
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(Path.Combine(builder.Environment.ContentRootPath, "public")),
        RequestPath = "/public"
    });
}

app.UseAuthorization();

app.UseSession();

app.MapControllers();

app.Run();
