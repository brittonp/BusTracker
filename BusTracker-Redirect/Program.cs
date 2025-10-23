using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var targetBaseUrl = app.Configuration["BT_Redirect_Url"];

// Redirect all requests
app.MapFallback(async (HttpContext context) =>
{
    // Preserve path and query string
    var targetUrl = targetBaseUrl + context.Request.Path + context.Request.QueryString;

    // Prevent caching
    context.Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    context.Response.Headers["Pragma"] = "no-cache";
    context.Response.Headers["Expires"] = "0";

    context.Response.Redirect(targetUrl, permanent: false);
    await Task.CompletedTask;
});

app.Run();
