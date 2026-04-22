const REALTIME = (() => {

  // ── CONFIGURACIÓN ──────────────────────────────────────────
  const POLL_INTERVAL  = 8000;    
  const SSE_ENDPOINT   = "/api/events";
  const PING_ENDPOINT  = "/api/events/ping";  

  // ── ESTADO ─────────────────────────────────────────────────
  let _sseSource      = null;
  let _pollTimer      = null;
  let _handlers       = {};       
  let _useSSE         = false;
  let _connected      = false;
  let _lastPoll       = {};       

  // ── REGISTRO DE HANDLERS ───────────────────────────────────
  /**
   * Suscribirse a cambios de una tabla.
   * @param {string} table   - "consumables" | "assets" | "requests" | "reservations" | "logs"
   * @param {Function} fn    - callback(eventType, data)
   *   eventType: "INSERT" | "UPDATE" | "DELETE" | "REFRESH"
   */
  function on(table, fn) {
    if (!_handlers[table]) _handlers[table] = [];
    _handlers[table].push(fn);
    return () => off(table, fn);  
  }

  function off(table, fn) {
    if (!_handlers[table]) return;
    _handlers[table] = _handlers[table].filter(h => h !== fn);
  }

  function _emit(table, eventType, data) {
    (_handlers[table] || []).forEach(fn => {
      try { fn(eventType, data); } catch(e) { console.error("[REALTIME]", e); }
    });
    
    (_handlers["*"] || []).forEach(fn => {
      try { fn(table, eventType, data); } catch(e) {}
    });
  }

  // ── INDICADOR VISUAL ───────────────────────────────────────
  function _buildIndicator() {
    let el = document.getElementById("rt-indicator");
    if (el) return el;
    el = document.createElement("div");
    el.id = "rt-indicator";
    el.style.cssText = `
      position:fixed;bottom:18px;left:18px;z-index:8888;
      display:flex;align-items:center;gap:7px;
      background:white;border:1px solid #e5e7eb;
      border-radius:20px;padding:5px 12px 5px 8px;
      font-size:12px;font-family:'Poppins',sans-serif;color:#6b7280;
      box-shadow:0 2px 8px rgba(0,0,0,0.08);cursor:default;
      transition:opacity 0.3s;`;
    el.innerHTML = `<span id="rt-dot" style="width:8px;height:8px;border-radius:50%;background:#d1d5db;display:inline-block;flex-shrink:0;transition:background 0.3s;"></span>
                    <span id="rt-label">Conectando...</span>`;
    el.title = "Estado de actualización en tiempo real";
    document.body.appendChild(el);
    return el;
  }

  function _setStatus(status) {
    
    const dot   = document.getElementById("rt-dot");
    const label = document.getElementById("rt-label");
    if (!dot || !label) return;

    const cfg = {
      connecting: { color:"#f59e0b", text:"Conectando...",     blink:true  },
      live:       { color:"#10b981", text:"En vivo",            blink:false },
      polling:    { color:"#4f46e5", text:"Auto-actualización", blink:false },
      offline:    { color:"#ef4444", text:"Sin conexión",        blink:false }
    }[status] || { color:"#9ca3af", text:status, blink:false };

    dot.style.background  = cfg.color;
    label.textContent     = cfg.text;
    dot.style.animation   = cfg.blink ? "rt-blink 1s infinite" : "none";

    if (!document.getElementById("rt-blink-style")) {
      const s = document.createElement("style");
      s.id = "rt-blink-style";
      s.textContent = `@keyframes rt-blink{0%,100%{opacity:1}50%{opacity:0.3}}`;
      document.head.appendChild(s);
    }
  }

  // ── TOAST PARA CAMBIOS EN VIVO ─────────────────────────────
  function _liveToast(msg) {
    
    const existing = document.getElementById("toast");
    if (existing) {
      existing.textContent = msg;
      existing.className   = "toast info show";
      clearTimeout(existing._rtTimer);
      existing._rtTimer = setTimeout(() => existing.classList.remove("show"), 3500);
      return;
    }
    let t = document.getElementById("rt-toast");
    if (!t) {
      t = document.createElement("div"); t.id = "rt-toast";
      t.style.cssText = `position:fixed;bottom:55px;left:18px;padding:10px 16px;
        border-radius:8px;color:white;font-size:13px;z-index:8889;
        opacity:0;transform:translateY(6px);transition:all 0.3s;pointer-events:none;
        background:#4f46e5;box-shadow:0 4px 12px rgba(0,0,0,0.2);
        font-family:'Poppins',sans-serif;max-width:260px;`;
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1"; t.style.transform = "translateY(0)";
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.style.opacity = "0"; t.style.transform = "translateY(6px)";
    }, 3500);
  }

  // ── SSE (Server-Sent Events) ────────────────────────────────
  function _startSSE() {
    if (_sseSource) { _sseSource.close(); _sseSource = null; }

    try {
      const src = new EventSource(SSE_ENDPOINT);
      _sseSource = src;
      _setStatus("connecting");

      src.onopen = () => {
        _useSSE    = true;
        _connected = true;
        _setStatus("live");
        _stopPolling();  
      };

      
      src.addEventListener("db_change", e => {
        try {
          const payload = JSON.parse(e.data);
          
          const { table, eventType, record } = payload;
          _emit(table, eventType, record);
          _showChangeToast(table, eventType, record);
        } catch {}
      });

      // Ping de heartbeat
      src.addEventListener("ping", () => {
        _connected = true;
      });

      src.onerror = () => {
        _useSSE    = false;
        _connected = false;
        src.close();
        _sseSource = null;
        
        _setStatus("polling");
        _startPolling();
      };
    } catch {
      _startPolling();
    }
  }

  // ── POLLING (fallback) ─────────────────────────────────────
  
  const POLL_TABLES = [
    { table: "consumables", endpoint: "/api/consumibles" },
    { table: "assets",      endpoint: "/api/assets"      },
    { table: "requests",    endpoint: "/api/requests"     },
    { table: "reservations",endpoint: "/api/reservations" },
    { table: "labs",        endpoint: "/api/labs"         },
  ];

  function _startPolling() {
    if (_pollTimer) return;
    _setStatus("polling");

    // Primer poll inmediato para inicializar timestamps
    _doPoll();
    _pollTimer = setInterval(_doPoll, POLL_INTERVAL);
  }

  function _stopPolling() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  async function _doPoll() {
    const activeTables = POLL_TABLES.filter(t => (_handlers[t.table]?.length > 0) || (_handlers["*"]?.length > 0));
    if (!activeTables.length) return;

    for (const { table, endpoint } of activeTables) {
      try {
        
        const since = _lastPoll[table];
        const url   = since ? `${endpoint}?updated_since=${encodeURIComponent(since)}` : endpoint;

        const res  = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const data = await res.json();

        const items = Array.isArray(data) ? data : (data.items || []);
        if (!items.length) continue;

        // Si es el primer poll, solo guardamos referencias sin emitir
        if (!_lastPoll[table]) {
          _lastPoll[table] = _getNewest(items);
          continue;
        }

        const newNewest = _getNewest(items);
        if (newNewest && newNewest !== _lastPoll[table]) {
          _lastPoll[table] = newNewest;
          _emit(table, "REFRESH", items);
          _showChangeToast(table, "REFRESH", null);
        }

        _connected = true;
        _setStatus("polling");
      } catch {
        _connected = false;
        _setStatus("offline");
      }
    }
  }

  function _getNewest(items) {
    return items.reduce((max, item) => {
      const ts = item.updated_at || item.created_at || item.timestamp || "";
      return ts > max ? ts : max;
    }, "");
  }

  
  const TABLE_LABELS = {
    consumables:  "consumibles",
    assets:       "activos",
    requests:     "solicitudes",
    reservations: "reservas",
    logs:         "registros",
    users:        "usuarios",
    labs:         "laboratorios"
  };

  function _showChangeToast(table, eventType, record) {
    const tLabel = TABLE_LABELS[table] || table;
    let msg;
    if (eventType === "INSERT") msg = `Nuevo registro en ${tLabel}`;
    else if (eventType === "UPDATE") msg = `Actualización en ${tLabel}`;
    else if (eventType === "DELETE") msg = `Eliminado en ${tLabel}`;
    else if (eventType === "REFRESH") msg = `${tLabel} actualizados`;
    if (msg) _liveToast(msg);
  }

  // ── INICIALIZACIÓN ─────────────────────────────────────────
  function init() {
    document.addEventListener("DOMContentLoaded", () => {
      _buildIndicator();
      
      _startSSE();
    });
  }

  return { on, off, init };

})();

REALTIME.init();