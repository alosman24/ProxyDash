namespace ProxyTester.Api.Models;

public class ProxyTestRequest
{
    public List<ProxyInfo> Proxies { get; set; } = new();
    public string TestUrl { get; set; } = "http://httpbin.org/ip";
    public int TimeoutSeconds { get; set; } = 10;
}