---
name: Vite proxy keep-alive bug with large uploads/downloads
description: Vite's proxy reuses TCP connections (keep-alive) by default; after a large upload + large streaming download the pooled connection corrupts, causing "Failed to fetch" on the second request with no server-side trace.
---

## Rule
Always set `agent: new http.Agent({ keepAlive: false })` on any Vite proxy route that handles large file uploads or streaming downloads.

**Why:** Vite's http-proxy pools TCP connections. After a large multipart upload followed by a large streaming response, the connection ends up in a bad state. The next request reuses that connection and fails immediately with "Failed to fetch" — nothing reaches the Express server (no log entry). This is specific to Replit's proxied iframe environment where every request is already going through an external proxy layer.

**How to apply:** In `vite.config.ts`, inside `server.proxy`:
```ts
import http from "http";
// ...
"/api": {
  target: "http://localhost:8080",
  changeOrigin: true,
  proxyTimeout: 300_000,
  timeout: 300_000,
  agent: new http.Agent({ keepAlive: false }),
}
```
