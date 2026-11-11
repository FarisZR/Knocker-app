// Controlled Caddy-shaped fixture for emulator UI QA. Never uses real credentials.
import { createServer } from "node:http";
const port = Number(process.env.KNOCKER_TEST_PORT || 19127);
createServer(async (req, res) => {
  if (req.method !== "POST" || !req.url?.endsWith("/knock")) {
    res.writeHead(404).end();
    return;
  }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  let ttl = 300;
  try {
    ttl = Math.min(300, Math.max(10, JSON.parse(raw || "{}").ttl || 300));
  } catch {}
  console.log(`${new Date().toISOString()} POST ${req.url}`);
  await new Promise((resolve) =>
    setTimeout(resolve, req.url.includes("/slow/") ? 8000 : 1400),
  );
  res.setHeader("Content-Type", "application/json");
  if (req.url.includes("/denied/")) {
    res.writeHead(403).end(JSON.stringify({ error: "Demo key denied" }));
    console.log(`${new Date().toISOString()} REPLY 403 ${req.url}`);
    return;
  }
  res.end(
    JSON.stringify({
      whitelisted_entry: "203.0.113.42",
      expires_at: Math.floor(Date.now() / 1000) + ttl,
      expires_in_seconds: ttl,
    }),
  );
  console.log(`${new Date().toISOString()} REPLY 200 ${req.url}`);
}).listen(port, "127.0.0.1", () =>
  console.log(`UI fixture: http://127.0.0.1:${port}`),
);
