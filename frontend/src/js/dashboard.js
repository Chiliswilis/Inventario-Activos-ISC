const STATS_URL = "/api/stats";

const statusLabel = {
  available:   { text: "Disponible",    cls: "status-available" },
  borrowed:    { text: "Prestado",      cls: "status-borrowed" },
  maintenance: { text: "Mantenimiento", cls: "status-maintenance" }
};

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)     return "Hace un momento";
  if (diff < 3600)   return `Hace ${Math.floor(diff/60)} min`;
  if (diff < 86400)  return `Hace ${Math.floor(diff/3600)} hora${Math.floor(diff/3600)>1?"s":""}`;
  if (diff < 172800) return "Ayer";
  return new Date(dateStr).toLocaleDateString("es-MX");
}

function animateCount(el, target) {
  const duration = 600;
  const start = performance.now();
  const from = 0;
  el.classList.remove("loading-val");
  (function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (target - from) * ease);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  })(start);
}

async function loadStats() {
  try {
    const res  = await fetch(STATS_URL);
    if (!res.ok) throw new Error();
    const data = await res.json();

    animateCount(document.getElementById("cardAssets"),       data.totalAssets);
    animateCount(document.getElementById("cardConsumables"),  data.totalConsumables);
    animateCount(document.getElementById("cardRequests"),     data.totalRequests);
    animateCount(document.getElementById("cardReservations"), data.todayReservations);

    renderMovements(data.lastMovements);
    renderActivity(data.recentActivity);
  } catch {
    console.warn("No se pudieron cargar las estadísticas");
    // Mostrar — en las tarjetas si falla
    ["cardAssets","cardConsumables","cardRequests","cardReservations"].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = "—"; el.classList.remove("loading-val"); }
    });
  }
}

function renderMovements(movements) {
  const tbody = document.getElementById("movementsBody");
  if (!tbody) return;
  if (!movements || !movements.length) {
    tbody.innerHTML = `<tr class="loading-row"><td colspan="4">Sin movimientos recientes</td></tr>`;
    return;
  }
  tbody.innerHTML = "";
  movements.forEach(m => {
    const st = statusLabel[m.status] || { text: m.status, cls: "" };
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">#${m.id}</td>
      <td>${m.name}</td>
      <td style="color:var(--ibm-gray-50);">—</td>
      <td><span class="status-badge ${st.cls}">${st.text}</span></td>`;
    tbody.appendChild(tr);
  });
}

function renderActivity(activities) {
  const container = document.getElementById("activityContainer");
  if (!container) return;
  if (!activities || !activities.length) {
    container.innerHTML = `
      <div class="activity-item">
        <div class="activity-dot" style="background:var(--ibm-gray-30);"></div>
        <div class="activity-text" style="color:var(--ibm-gray-50);">Sin actividad reciente</div>
        <div class="activity-time">—</div>
      </div>`;
    return;
  }
  container.innerHTML = "";
  activities.forEach(a => {
    const div = document.createElement("div");
    div.className = "activity-item";
    div.innerHTML = `
      <div class="activity-dot"></div>
      <div class="activity-text">
        ${a.action}${a.table_name ? ` en <strong>${a.table_name}</strong>` : ""}
      </div>
      <div class="activity-time">${timeAgo(a.timestamp)}</div>`;
    container.appendChild(div);
  });
}

document.addEventListener("DOMContentLoaded", loadStats);

// ── Tiempo real — cualquier cambio actualiza las tarjetas ──
document.addEventListener("DOMContentLoaded", () => {
  if (typeof REALTIME !== "undefined") {
    REALTIME.on("*", () => {
      if (typeof loadDashboard === "function") loadDashboard();
      else if (typeof loadStats === "function") loadStats();
    });
  }
});