const express  = require("express");
const router   = express.Router();
const { addClient, removeClient, sendToClient, getClientCount } = require("./events.service");

router.get("/", (req, res) => {
  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const client = addClient(res);
  sendToClient(client, "ping", { message: "Conectado al servidor SSE", clientId: client.id });

  const heartbeat = setInterval(() => {
    sendToClient(client, "ping", { ts: Date.now() });
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeClient(client);
  });
});

router.get("/ping", (req, res) => {
  res.json({ ok: true, clients: getClientCount(), ts: Date.now() });
});

module.exports = router;