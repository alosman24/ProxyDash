using Microsoft.AspNetCore.Mvc;
using ProxyTester.Api.Models;
using ProxyTester.Api.Services;

namespace ProxyTester.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProxyController : ControllerBase
{
    private readonly IProxyTesterService _proxyTester;
    private readonly ILogger<ProxyController> _logger;

    public ProxyController(IProxyTesterService proxyTester, ILogger<ProxyController> logger)
    {
        _proxyTester = proxyTester;
        _logger = logger;
    }

    [HttpPost("test-single")]
    public async Task<ActionResult<ProxyTestResult>> TestSingleProxy([FromBody] ProxyTestRequest request)
    {
        try
        {
            _logger.LogInformation("Received test-single request: {@Request}", request);
            
            if (request?.Proxies == null || request.Proxies.Count != 1)
            {
                _logger.LogWarning("Invalid request: Expected exactly one proxy, got {Count}", request?.Proxies?.Count ?? 0);
                return BadRequest("Single proxy test requires exactly one proxy");
            }

            var proxy = request.Proxies[0];
            
            if (string.IsNullOrEmpty(proxy.IpAddress) || proxy.Port <= 0)
            {
                _logger.LogWarning("Invalid proxy data: IP={IP}, Port={Port}", proxy.IpAddress, proxy.Port);
                return BadRequest("Invalid proxy IP address or port");
            }
            
            _logger.LogInformation("Testing proxy: {IP}:{Port}", proxy.IpAddress, proxy.Port);

            var result = await _proxyTester.TestProxyAsync(proxy, request.TestUrl, request.TimeoutSeconds);
            
            _logger.LogInformation("Test result: {@Result}", result);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in test-single endpoint");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPost("test-bulk")]
    public async Task<ActionResult<BulkTestProgress>> TestBulkProxies([FromBody] ProxyTestRequest request)
    {
        _logger.LogInformation("Received test-bulk request with {Count} proxies", request?.Proxies?.Count ?? 0);
        
        if (request?.Proxies == null || request.Proxies.Count == 0)
        {
            _logger.LogWarning("No proxies provided in bulk test request");
            return BadRequest("No proxies provided");
        }

        var progress = new Progress<BulkTestProgress>();
        var result = await _proxyTester.TestProxiesAsync(request.Proxies, request.TestUrl, request.TimeoutSeconds, progress);
        
        _logger.LogInformation("Bulk test completed: {Total} total, {Active} active, {Failed} failed", 
            result.Total, result.Active, result.Failed);
        
        return Ok(result);
    }

    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "healthy", timestamp = DateTime.UtcNow });
    }
}