namespace ProxyTester.Api.Models;

public class ProxyTestResult
{
    public int Id { get; set; }
    public ProxyStatus Status { get; set; }
    public int ResponseTime { get; set; }
    public string Country { get; set; } = "";
    public string City { get; set; } = "";
    public string DetectedIp { get; set; } = "";
    public string Error { get; set; } = "";
    public DateTime TestedAt { get; set; }
}