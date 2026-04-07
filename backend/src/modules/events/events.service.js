const clients = new Set();
let clientCounter = 0;

function addClient(res) {
  const clientId = ++clientCounter;
  const client   = { id: clientId, res };
  clients.add(client);
  console.log(`[SSE] Cliente #${clientId} conectado. Total: ${clients.size}`);
  return client;
}

function removeClient(client) {
  clients.delete(client);
  console.log(`[SSE] Cliente #${client.id} desconectado. Total: ${clients.size}`);
}

function sendToClient(client, event, data) {
  try {
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    client.res.write(`event: ${event}\ndata: ${payload}\n\n`);
  } catch (err) {
    clients.delete(client);
  }
}

function broadcast(table, eventType, record = {}) {
  if (clients.size === 0) return;
  const payload = JSON.stringify({ table, eventType, record, ts: Date.now() });
  console.log(`[SSE] Broadcast → table:${table} event:${eventType} clients:${clients.size}`);
  for (const client of clients) {
    sendToClient(client, "db_change", payload);
  }
}

function getClientCount() {
  return clients.size;
}

module.exports = { addClient, removeClient, sendToClient, broadcast, getClientCount };