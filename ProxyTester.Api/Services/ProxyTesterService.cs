using System.Net;
using System.Text.Json;
using ProxyTester.Api.Models;
using System.Net.Sockets;

namespace ProxyTester.Api.Services;

public class ProxyTesterService : IProxyTesterService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<ProxyTesterService> _logger;

    public ProxyTesterService(ILogger<ProxyTesterService> logger)
    {
        _logger = logger;
        _httpClient = new HttpClient();
    }

    public async Task<ProxyTestResult> TestProxyAsync(ProxyInfo proxy, string testUrl, int timeoutSeconds)
    {
        var result = new ProxyTestResult
        {
            Id = proxy.Id,
            Status = ProxyStatus.Testing,
            TestedAt = DateTime.UtcNow
        };

        _logger.LogInformation("🏓 Ping testing proxy {IP}:{Port}", proxy.IpAddress, proxy.Port);

        try
        {
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            
            using var tcpClient = new TcpClient();
            
            // Set timeout
            var connectTask = tcpClient.ConnectAsync(proxy.IpAddress, proxy.Port);
            var timeoutTask = Task.Delay(TimeSpan.FromSeconds(timeoutSeconds));
            
            var completedTask = await Task.WhenAny(connectTask, timeoutTask);
            stopwatch.Stop();
            
            if (completedTask == connectTask && tcpClient.Connected)
            {
                result.Status = ProxyStatus.Active;
                result.ResponseTime = (int)stopwatch.ElapsedMilliseconds;
                result.DetectedIp = proxy.IpAddress; // Set the proxy IP as detected IP
                
                _logger.LogInformation("✅ Proxy {IP}:{Port} ping SUCCESS ({ResponseTime}ms)", 
                    proxy.IpAddress, proxy.Port, result.ResponseTime);

                // Get geolocation info for the proxy IP
                await GetGeolocationAsync(result, proxy.GeoProvider ?? "ip-api");
            }
            else
            {
                result.Status = ProxyStatus.Failed;
                result.Error = "Connection timeout or refused";
                _logger.LogError("⏰ Proxy {IP}:{Port} ping FAILED - Timeout or connection refused", 
                    proxy.IpAddress, proxy.Port);
            }
        }
        catch (SocketException ex)
        {
            result.Status = ProxyStatus.Failed;
            result.Error = "Connection failed";
            _logger.LogError("🔌 Proxy {IP}:{Port} ping FAILED - Socket error: {Error}", 
                proxy.IpAddress, proxy.Port, ex.Message);
        }
        catch (Exception ex)
        {
            result.Status = ProxyStatus.Failed;
            result.Error = ex.Message.Length > 100 ? ex.Message[..100] + "..." : ex.Message;
            _logger.LogError("💥 Proxy {IP}:{Port} ping FAILED - Error: {Error}", 
                proxy.IpAddress, proxy.Port, ex.Message);
        }

        return result;
    }

    public async Task<BulkTestProgress> TestProxiesAsync(List<ProxyInfo> proxies, string testUrl, int timeoutSeconds, IProgress<BulkTestProgress> progress)
    {
        var results = new List<ProxyTestResult>();
        var semaphore = new SemaphoreSlim(10); // Limit concurrent tests
        var tasks = new List<Task>();

        var progressData = new BulkTestProgress
        {
            Total = proxies.Count,
            Results = results
        };

        foreach (var proxy in proxies)
        {
            tasks.Add(Task.Run(async () =>
            {
                await semaphore.WaitAsync();
                try
                {
                    var result = await TestProxyAsync(proxy, testUrl, timeoutSeconds);

                    lock (results)
                    {
                        results.Add(result);
                        progressData.Completed = results.Count;
                        progressData.Active = results.Count(r => r.Status == ProxyStatus.Active);
                        progressData.Failed = results.Count(r => r.Status == ProxyStatus.Failed);
                    }

                    progress?.Report(progressData);
                }
                finally
                {
                    semaphore.Release();
                }
            }));
        }

        await Task.WhenAll(tasks);
        return progressData;
    }

    private async Task GetGeolocationAsync(ProxyTestResult result, string geoProvider = "ip-api")
    {
        if (string.IsNullOrEmpty(result.DetectedIp)) return;

        _logger.LogInformation("🌍 Using geolocation provider: {Provider} for IP: {IP}", geoProvider, result.DetectedIp);

        try
        {
            switch (geoProvider.ToLower())
            {
                case "ipinfo":
                    await GetIPInfoGeolocationAsync(result);
                    break;
                case "ip-api":
                default:
                    await GetIPApiGeolocationAsync(result);
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error fetching geolocation for IP {IP} using provider {Provider}: {Error}", 
                result.DetectedIp, geoProvider, ex.Message);
        }
    }

    private async Task GetIPApiGeolocationAsync(ProxyTestResult result)
    {
        var geoUrl = $"http://ip-api.com/json/{result.DetectedIp}";
        _logger.LogInformation("🌍 [IP-API] Getting location for {IP}", result.DetectedIp);
        
        var response = await _httpClient.GetStringAsync(geoUrl);
        var geoData = JsonSerializer.Deserialize<JsonElement>(response);
        
        // Extract country and city
        if (geoData.TryGetProperty("country", out var country))
        {
            result.Country = country.GetString() ?? "";
        }

        if (geoData.TryGetProperty("city", out var city))
        {
            result.City = city.GetString() ?? "";
        }
        
        _logger.LogInformation("🏳️ [IP-API] {IP} -> {Country}, {City}", result.DetectedIp, result.Country, result.City);
        
        if (geoData.TryGetProperty("status", out var status) && status.GetString() != "success")
        {
            _logger.LogWarning("⚠️ [IP-API] API returned status: {Status}", status.GetString());
        }
    }

    private async Task GetIPInfoGeolocationAsync(ProxyTestResult result)
    {
        var geoUrl = $"https://api.ipinfo.io/lite/{result.DetectedIp}?token=7b564a7c06cb6e";
        _logger.LogInformation("🌍 [IPinfo] Getting location for {IP}", result.DetectedIp);
        
        var response = await _httpClient.GetStringAsync(geoUrl);
        var geoData = JsonSerializer.Deserialize<JsonElement>(response);
        
        // Extract country and city
        if (geoData.TryGetProperty("country", out var country))
        {
            result.Country = country.GetString() ?? "";
        }

        if (geoData.TryGetProperty("city", out var city))
        {
            result.City = city.GetString() ?? "";
        }
        
        _logger.LogInformation("🏳️ [IPinfo] {IP} -> {Country}, {City}", result.DetectedIp, result.Country, result.City);
    }
}