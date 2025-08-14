import React, { useState, useEffect } from "react";
import "./App.css";

const ProxyTester = () => {
  const [proxies, setProxies] = useState([]);
  const [testUrl, setTestUrl] = useState("http://httpbin.org/ip");
  const [timeoutSeconds, setTimeoutSeconds] = useState(10);
  const [isTesting, setIsTesting] = useState(false);
  const [progress, setProgress] = useState({
    total: 0,
    completed: 0,
    active: 0,
    failed: 0,
  });
  const [apiStatus, setApiStatus] = useState("checking");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [globalProtocol, setGlobalProtocol] = useState("HTTP");
  const [geoProvider, setGeoProvider] = useState("ip-api");

  // Check API health on startup
  useEffect(() => {
    checkApiHealth();
  }, []);

  const checkApiHealth = async () => {
    try {
      const result = await window.electronAPI.checkApiHealth();
      setApiStatus(result.success ? "connected" : "disconnected");
    } catch (error) {
      setApiStatus("disconnected");
    }
  };

  // Update all proxies with global protocol
  const updateAllProxiesProtocol = (protocol) => {
    setGlobalProtocol(protocol);
    setProxies((currentProxies) =>
      currentProxies.map((proxy) => ({ ...proxy, protocol }))
    );
  };

  // Update proxy data
  const updateProxy = (id, updates) => {
    console.log(`Updating proxy ${id}:`, updates);
    setProxies((currentProxies) =>
      currentProxies.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  // Remove proxy
  const removeProxy = (id) => {
    setProxies(proxies.filter((p) => p.id !== id));
  };

  // Update single proxy field
  const updateProxyField = (id, field, value) => {
    setProxies((currentProxies) =>
      currentProxies.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // Add a new proxy row
  const addProxy = () => {
    const newProxy = {
      id: proxies.length + 1,
      type: "http",
      ipAddress: "",
      port: 8080,
      protocol: globalProtocol,
      username: "",
      password: "",
      status: "Untested",
      responseTime: 0,
      country: "",
      city: "",
      lastTested: "",
      error: "",
      detectedIp: "",
    };
    setProxies([...proxies, newProxy]);
  };

  // Import proxies from text
  const importProxies = () => {
    setShowImportModal(true);
  };

  const handleImportConfirm = () => {
    if (!importText.trim()) {
      setShowImportModal(false);
      return;
    }

    const lines = importText.trim().split("\n");
    const newProxies = lines
      .map((line, index) => {
        const parts = line.trim().split(":");
        if (parts.length >= 2) {
          return {
            id: Math.max(0, ...proxies.map((p) => p.id)) + index + 1,
            type: "http",
            ipAddress: parts[0],
            port: parseInt(parts[1]) || 8080,
            protocol: globalProtocol,
            username: parts[2] || "",
            password: parts[3] || "",
            status: "Untested",
            responseTime: 0,
            country: "",
            city: "",
            lastTested: "",
            error: "",
            detectedIp: "",
          };
        }
        return null;
      })
      .filter(Boolean);

    setProxies([...proxies, ...newProxies]);
    setImportText("");
    setShowImportModal(false);
  };

  // Test single proxy
  const testSingleProxy = async (proxy) => {
    try {
      // Set testing status first
      updateProxy(proxy.id, { status: "Testing" });

      // Format the proxy data to match the API expectations
      const requestData = {
        proxies: [
          {
            id: proxy.id,
            type: proxy.type,
            ipAddress: proxy.ipAddress,
            port: proxy.port,
            protocol: proxy.protocol,
            username: proxy.username || "",
            password: proxy.password || "",
            status: 0,
            responseTime: 0,
            country: "",
            city: "",
            lastTested: "",
            error: "",
            geoProvider: geoProvider,
          },
        ],
        testUrl: testUrl,
        timeoutSeconds: timeoutSeconds,
      };

      console.log("Sending request:", requestData);

      const result = await window.electronAPI.apiRequest(
        "POST",
        "/proxy/test-single",
        requestData
      );

      console.log("API Response:", result);

      if (result.success) {
        const testResult = result.data;
        console.log("Updating proxy with result:", testResult);

        // Map API response to UI fields
        const newStatus = testResult.status === 1 ? "Active" : "Failed";
        console.log(
          `Setting status to: ${newStatus} (API status: ${testResult.status})`
        );

        // Update all fields at once
        updateProxy(proxy.id, {
          status: newStatus,
          responseTime: testResult.responseTime || 0,
          country: testResult.country || "",
          city: testResult.city || "",
          error: testResult.error || "",
          lastTested: new Date(
            testResult.testedAt || new Date()
          ).toLocaleString(),
          detectedIp: testResult.detectedIp || "",
        });
      } else {
        updateProxy(proxy.id, {
          status: "Failed",
          error: result.error?.title || "API Error",
        });
        console.error("API Error:", result.error);
      }
    } catch (error) {
      updateProxy(proxy.id, {
        status: "Failed",
        error: error.message,
      });
      console.error("Request Error:", error);
    }
  };

  // Test all proxies
  const testAllProxies = async () => {
    if (proxies.length === 0) return;

    setIsTesting(true);
    setProgress({ total: proxies.length, completed: 0, active: 0, failed: 0 });

    // Mark all as testing
    setProxies((currentProxies) =>
      currentProxies.map((p) => ({ ...p, status: "Testing" }))
    );

    try {
      // Format the proxies data to match the API expectations
      const requestData = {
        proxies: proxies.map((proxy) => ({
          id: proxy.id,
          type: proxy.type,
          ipAddress: proxy.ipAddress,
          port: proxy.port,
          protocol: proxy.protocol,
          username: proxy.username || "",
          password: proxy.password || "",
          status: 0,
          responseTime: 0,
          country: "",
          city: "",
          lastTested: "",
          error: "",
          geoProvider: geoProvider,
        })),
        testUrl: testUrl,
        timeoutSeconds: timeoutSeconds,
      };

      console.log("Sending bulk request:", requestData);

      const result = await window.electronAPI.apiRequest(
        "POST",
        "/proxy/test-bulk",
        requestData
      );

      console.log("Bulk API Response:", result);

      if (result.success) {
        const bulkResult = result.data;
        setProgress({
          total: bulkResult.total,
          completed: bulkResult.completed,
          active: bulkResult.active,
          failed: bulkResult.failed,
        });

        // Update proxy results
        bulkResult.results.forEach((testResult) => {
          const newStatus = testResult.status === 1 ? "Active" : "Failed";
          updateProxy(testResult.id, {
            status: newStatus,
            responseTime: testResult.responseTime || 0,
            country: testResult.country || "",
            city: testResult.city || "",
            error: testResult.error || "",
            lastTested: new Date(
              testResult.testedAt || new Date()
            ).toLocaleString(),
            detectedIp: testResult.detectedIp || "",
          });
        });
      } else {
        console.error("Bulk test API Error:", result.error);
      }
    } catch (error) {
      console.error("Bulk test failed:", error);
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "#28a745";
      case "Failed":
        return "#dc3545";
      case "Testing":
        return "#ffc107";
      default:
        return "#6c757d";
    }
  };

  return (
    <div className="proxy-tester">
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <img
              src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iI0ZGRDcwMCIvPgo8cGF0aCBkPSJNMTAuNSAxMi41SDE5LjVWMTkuNUgxMC41VjEyLjVaIiBmaWxsPSIjMUExQTFBIi8+CjxwYXRoIGQ9Ik0yMC41IDEyLjVIMjkuNVYxOS41SDIwLjVWMTIuNVoiIGZpbGw9IiMxQTFBMUEiLz4KPHA+PC9wPgo8cGF0aCBkPSJNMTAuNSAyMC41SDE5LjVWMjcuNUgxMC41VjIwLjVaIiBmaWxsPSIjMUExQTFBIi8+CjxwYXRoIGQ9Ik0yMC41IDIwLjVIMjkuNVYyNy41SDIwLjVWMjAuNVoiIGZpbGw9IiMxQTFBMUEiLz4KPC9zdmc+"
              alt="ProxyChimp Logo"
              className="logo-image"
            />
            <div>
              <h1>ProxyChimp</h1>
              <span className="tagline">Professional Proxy Testing Suite</span>
            </div>
          </div>
          <div className="api-status">
            <span className="status-label">API Status:</span>
            <span className={`status-indicator ${apiStatus}`}>
              {apiStatus === "connected" ? (
                <>
                  <span className="status-dot"></span>
                  Connected
                </>
              ) : (
                <>
                  <span className="status-dot"></span>
                  Disconnected
                </>
              )}
            </span>
          </div>
        </div>
      </header>

      <div className="controls">
        <div className="control-group">
          <label>Target URL/Host:</label>
          <input
            type="text"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder="https://google.com or httpbin.org"
          />
        </div>
        <div className="control-group">
          <label>Timeout (seconds):</label>
          <input
            type="number"
            value={timeoutSeconds}
            onChange={(e) => setTimeoutSeconds(parseInt(e.target.value))}
            min="1"
            max="60"
          />
        </div>
        <div className="control-group">
          <label>Global Protocol:</label>
          <select
            value={globalProtocol}
            onChange={(e) => updateAllProxiesProtocol(e.target.value)}
            className="protocol-selector"
          >
            <option value="HTTP">HTTP</option>
            <option value="HTTPS">HTTPS</option>
          </select>
        </div>
        <div className="control-group">
          <label>Geo Provider:</label>
          <select
            value={geoProvider}
            onChange={(e) => setGeoProvider(e.target.value)}
            className="geo-provider-selector"
          >
            <option value="ip-api">IP-API (Free)</option>
            <option value="ipinfo">IPinfo (Token)</option>
          </select>
        </div>
        <div className="control-actions">
          <button onClick={addProxy} className="btn btn-primary">
            <span className="btn-icon">➕</span>
            Add Proxy
          </button>
          <button onClick={importProxies} className="btn btn-secondary">
            <span className="btn-icon">📁</span>
            Import Proxies
          </button>
          <button
            onClick={testAllProxies}
            disabled={isTesting || proxies.length === 0}
            className="btn btn-success"
          >
            <span className="btn-icon">{isTesting ? "⏳" : "🏓"}</span>
            {isTesting ? "Pinging..." : "Ping All"}
          </button>
        </div>
      </div>

      {isTesting && (
        <div className="progress-bar">
          <div className="progress-info">
            <span>
              Ping Progress: {progress.completed}/{progress.total}
            </span>
            <span className="active-count">Active: {progress.active}</span>
            <span className="failed-count">Failed: {progress.failed}</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${(progress.completed / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="proxy-table-container">
        <table className="proxy-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>IP Address</th>
              <th>Port</th>
              <th>Username</th>
              <th>Password</th>
              <th>Status</th>
              <th>Response Time</th>
              <th>Detected IP</th>
              <th>Country</th>
              <th>City</th>
              <th>Last Tested</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {proxies.map((proxy, index) => (
              <tr key={proxy.id}>
                <td>{index + 1}</td>
                <td>
                  <select
                    value={proxy.type}
                    onChange={(e) =>
                      updateProxyField(proxy.id, "type", e.target.value)
                    }
                  >
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                    <option value="socks4">SOCKS4</option>
                    <option value="socks5">SOCKS5</option>
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    value={proxy.ipAddress}
                    onChange={(e) =>
                      updateProxyField(proxy.id, "ipAddress", e.target.value)
                    }
                    placeholder="127.0.0.1"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={proxy.port}
                    onChange={(e) =>
                      updateProxyField(
                        proxy.id,
                        "port",
                        parseInt(e.target.value)
                      )
                    }
                    placeholder="8080"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={proxy.username}
                    onChange={(e) =>
                      updateProxyField(proxy.id, "username", e.target.value)
                    }
                    placeholder="username"
                  />
                </td>
                <td>
                  <input
                    type="password"
                    value={proxy.password}
                    onChange={(e) =>
                      updateProxyField(proxy.id, "password", e.target.value)
                    }
                    placeholder="password"
                  />
                </td>
                <td>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(proxy.status) }}
                  >
                    {proxy.status}
                  </span>
                </td>
                <td>{proxy.responseTime}ms</td>
                <td>{proxy.detectedIp}</td>
                <td>{proxy.country}</td>
                <td>{proxy.city}</td>
                <td>{proxy.lastTested}</td>
                <td className="actions-cell">
                  <button
                    onClick={() => testSingleProxy(proxy)}
                    disabled={isTesting}
                    className="btn btn-sm btn-info"
                    title="Ping test this proxy"
                  >
                    <span className="btn-icon">🏓</span>
                    Ping
                  </button>
                  <button
                    onClick={() => removeProxy(proxy.id)}
                    className="btn btn-sm btn-danger"
                    title="Remove this proxy"
                  >
                    <span className="btn-icon">🗑️</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {proxies.length === 0 && (
          <div className="empty-state">
            <img
              src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iI0ZGRDcwMCIvPgo8cGF0aCBkPSJNMTAuNSAxMi41SDE5LjVWMTkuNUgxMC41VjEyLjVaIiBmaWxsPSIjMUExQTFBIi8+CjxwYXRoIGQ9Ik0yMC41IDEyLjVIMjkuNVYxOS41SDIwLjVWMTIuNVoiIGZpbGw9IiMxQTFBMUEiLz4KPHA+PC9wPgo8cGF0aCBkPSJNMTAuNSAyMC41SDE5LjVWMjcuNUgxMC41VjIwLjVaIiBmaWxsPSIjMUExQTFBIi8+CjxwYXRoIGQ9Ik0yMC41IDIwLjVIMjkuNVYyNy41SDIwLjVWMjAuNVoiIGZpbGw9IiMxQTFBMUEiLz4KPC9zdmc+"
              alt="ProxyChimp"
              className="empty-icon"
            />
            <h3>No proxies yet!</h3>
            <p>
              Click "Add Proxy" or "Import Proxies" to get started ping testing
              your proxies.
            </p>
            <button onClick={addProxy} className="btn btn-primary">
              <span className="btn-icon">➕</span>
              Add Your First Proxy
            </button>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                <span className="modal-icon">📁</span>
                Import Proxies
              </h3>
              <button
                className="modal-close"
                onClick={() => setShowImportModal(false)}
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>Enter proxies (one per line):</p>
              <p className="format-hint">
                Format: ip:port or ip:port:username:password
              </p>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Example:&#10;192.168.1.1:8080&#10;192.168.1.2:3128:user:pass"
                rows={8}
                className="import-textarea"
              />
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowImportModal(false)}
                className="btn btn-secondary"
              >
                <span className="btn-icon">❌</span>
                Cancel
              </button>
              <button onClick={handleImportConfirm} className="btn btn-success">
                <span className="btn-icon">✅</span>
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProxyTester;
