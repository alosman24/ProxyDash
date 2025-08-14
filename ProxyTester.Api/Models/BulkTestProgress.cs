namespace ProxyTester.Api.Models;

public class BulkTestProgress
{
    public int Total { get; set; }
    public int Completed { get; set; }
    public int Active { get; set; }
    public int Failed { get; set; }
    public List<ProxyTestResult> Results { get; set; } = new();
}