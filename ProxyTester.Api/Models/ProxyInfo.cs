namespace ProxyTester.Api.Models;

public class ProxyInfo
{
    public int Id { get; set; }
    public string Type { get; set; } = "http";
    public string IpAddress { get; set; } = "";
    public int Port { get; set; }
    public string Protocol { get; set; } = "HTTP";
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public ProxyStatus Status { get; set; } = ProxyStatus.Untested;
    public int ResponseTime { get; set; }
    public string Country { get; set; } = "";
    public string City { get; set; } = "";
    public string LastTested { get; set; } = "";
    public string Error { get; set; } = "";
    public string GeoProvider { get; set; } = "ip-api";
}