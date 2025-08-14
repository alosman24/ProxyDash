using ProxyTester.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowElectron", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});
builder.Services.AddSingleton<IProxyTesterService, ProxyTesterService>();

// Configure logging to file
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

// Simple file logging setup
var logDirectory = Path.Combine(Directory.GetCurrentDirectory(), "Logs");
Directory.CreateDirectory(logDirectory);
var logFile = Path.Combine(logDirectory, $"ProxyTester-{DateTime.Now:yyyy-MM-dd}.log");

builder.Logging.AddFile(logFile);

var app = builder.Build();

// Configure pipeline
app.UseCors("AllowElectron");
app.UseRouting();
app.MapControllers();

app.Run("http://localhost:5000");