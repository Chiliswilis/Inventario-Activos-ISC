// ============================================================
// SGIAC-ISC | backend/src/events.js
// Endpoint SSE — Server-Sent Events para tiempo real
// ============================================================

const express = require("express");
const router  = express.Router();

// Conjunto de clientes conectados por SSE
const clients = new Set();

let clientCounter = 0;

// ── GET /api/events ─────────────────────────────────────────
router.get("/", (req, res) => {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const clientId = ++clientCounter;
  const client   = { id: clientId, res };
  clients.add(client);

  console.log(`[SSE] Cliente #${clientId} conectado. Total: ${clients.size}`);

  sendToClient(client, "ping", { message: "Conectado al servidor SSE", clientId });

  const heartbeat = setInterval(() => {
    sendToClient(client, "ping", { ts: Date.now() });
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(client);
    console.log(`[SSE] Cliente #${clientId} desconectado. Total: ${clients.size}`);
  });
});

// ── GET /api/events/ping ─────────────────────────────────────
router.get("/ping", (req, res) => {
  res.json({ ok: true, clients: clients.size, ts: Date.now() });
});

// ── FUNCIÓN PÚBLICA: broadcast ───────────────────────────────
function broadcast(table, eventType, record = {}) {
  if (clients.size === 0) return;

  const payload = JSON.stringify({ table, eventType, record, ts: Date.now() });
  console.log(`[SSE] Broadcast → table:${table} event:${eventType} clients:${clients.size}`);

  for (const client of clients) {
    sendToClient(client, "db_change", payload);
  }
}

function sendToClient(client, event, data) {
  try {
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    client.res.write(`event: ${event}\ndata: ${payload}\n\n`);
  } catch (err) {
    clients.delete(client);
  }
}

module.exports = { router, broadcast };