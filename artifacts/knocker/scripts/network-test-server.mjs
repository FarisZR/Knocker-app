// Local-only fixture for handover QA; addresses are documentation ranges.
import { createServer } from "node:http";
const grants = new Map();
let ip = "203.0.113.42";
const requests = [];
createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.url.startsWith("/control")) {
    const query = new URL(req.url, "http://localhost").searchParams;
    if (query.has("ip")) ip = query.get("ip");
    if (query.has("covered"))
      grants.set(
        ip,
        query.get("covered") === "true"
          ? Math.floor(Date.now() / 1000) + 3600
          : 0,
      );
    res.end(JSON.stringify({ ip, requests }));
    return;
  }
  if (req.headers["x-api-key"] !== "demo-key") {
    res.writeHead(401).end("{}");
    return;
  }
  requests.push({ method: req.method, path: req.url, ip, at: Date.now() });
  console.log(JSON.stringify(requests.at(-1)));
  const now = Math.floor(Date.now() / 1000);
  if (req.method === "POST" && req.url.endsWith("/knock")) {
    for await (const _ of req) {
    }
    grants.set(ip, now + 3600);
    res.end(
      JSON.stringify({
        whitelisted_entry: ip,
        expires_at: now + 3600,
        expires_in_seconds: 3600,
      }),
    );
  } else if (req.method === "GET" && req.url.endsWith("/status")) {
    const expiry = grants.get(ip) || 0;
    res.end(
      JSON.stringify({
        ip_address: ip,
        whitelisted: expiry > now,
        expires_at: expiry > now ? expiry : null,
        expires_in_seconds: Math.max(0, expiry - now),
      }),
    );
  } else res.writeHead(404).end("{}");
}).listen(19128, "127.0.0.1", () =>
  console.log("Network fixture listening on :19128"),
);
