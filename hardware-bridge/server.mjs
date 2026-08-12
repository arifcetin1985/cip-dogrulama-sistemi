import http from "node:http";
import { createSimulator } from "./adapters/simulator.mjs";
import { createSerialLineReader } from "./adapters/serial-line.mjs";

const port = Number(process.env.BRIDGE_PORT || 8787);
const mode = process.env.READER_MODE || "simulator";
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
const clients = new Set();
let lastScan = null;

function normalizeChipId(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function publish(rawChipId, source = mode) {
  const chipId = normalizeChipId(rawChipId);
  if (!chipId) return;
  lastScan = { chipId, source, scannedAt: new Date().toISOString() };
  const message = `event: scan\ndata: ${JSON.stringify(lastScan)}\n\n`;
  for (const response of clients) response.write(message);
  process.stdout.write(`[scan] ${chipId}\n`);
}

const adapter = mode === "serial"
  ? createSerialLineReader({
      path: process.env.READER_PORT,
      baudRate: Number(process.env.READER_BAUD || 115200),
      onScan: (chipId) => publish(chipId, "serial"),
    })
  : createSimulator({ onScan: (chipId) => publish(chipId, "simulator") });

await adapter.start();

function headers(contentType = "application/json") {
  return {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
  };
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  if (request.method === "OPTIONS") { response.writeHead(204, headers()); response.end(); return; }
  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, headers());
    response.end(JSON.stringify({ ok: true, mode, reader: adapter.status(), lastScan }));
    return;
  }
  if (request.method === "GET" && url.pathname === "/last-scan") {
    response.writeHead(200, headers()); response.end(JSON.stringify({ scan: lastScan })); return;
  }
  if (request.method === "GET" && url.pathname === "/events") {
    response.writeHead(200, { ...headers("text/event-stream"), Connection: "keep-alive" });
    response.write("event: ready\ndata: {}\n\n");
    clients.add(response);
    request.on("close", () => clients.delete(response));
    return;
  }
  if (request.method === "POST" && url.pathname === "/simulate" && mode === "simulator") {
    const body = await readJson(request);
    if (normalizeChipId(body.chipId)) publish(body.chipId, "simulator");
    else adapter.next();
    response.writeHead(200, headers()); response.end(JSON.stringify({ ok: true, scan: lastScan }));
    return;
  }
  response.writeHead(404, headers()); response.end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Chip reader bridge ready on http://127.0.0.1:${port} (${mode})\n`);
});

async function shutdown() {
  await adapter.stop();
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
