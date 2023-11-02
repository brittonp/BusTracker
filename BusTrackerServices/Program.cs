var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Added as suggested in https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection?view=aspnetcore-7.0
builder.Services.AddHttpContextAccessor();
builder.Services.AddTransient<BusTrackerServices.Data.ISqlData, BusTrackerServices.Data.SqlData>();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

//logging - added by brittonp 26-Sep-2023
builder.Logging
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

//  in-memory session provider.

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthorization();

app.UseSession();

app.MapControllers();

app.Run();
