using ProxyTester.Api.Models;

namespace ProxyTester.Api.Services;

public interface IProxyTesterService
{
    Task<ProxyTestResult> TestProxyAsync(ProxyInfo proxy, string testUrl, int timeoutSeconds);
    Task<BulkTestProgress> TestProxiesAsync(List<ProxyInfo> proxies, string testUrl, int timeoutSeconds, IProgress<BulkTestProgress> progress);
}