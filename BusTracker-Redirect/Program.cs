using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// Your Static Web App URL
var targetBaseUrl = "https://agreeable-tree-0e83e4c03.3.azurestaticapps.net";

// Redirect all requests
app.MapFallback(async (HttpContext context) =>
{
    // Preserve path and query string
    var targetUrl = targetBaseUrl + context.Request.Path + context.Request.QueryString;
    context.Response.Redirect(targetUrl, permanent: true);
    await Task.CompletedTask;
});

app.Run();
