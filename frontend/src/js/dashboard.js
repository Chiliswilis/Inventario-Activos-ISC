const STATS_URL = "/api/stats";

const statusLabel = {
  available:   { text: "Disponible",    color: "#16a34a" },
  borrowed:    { text: "Prestado",      color: "#d97706" },
  maintenance: { text: "Mantenimiento", color: "#dc2626" }
};

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)     return "Hace un momento";
  if (diff < 3600)   return `Hace ${Math.floor(diff/60)} min`;
  if (diff < 86400)  return `Hace ${Math.floor(diff/3600)} hora${Math.floor(diff/3600)>1?"s":""}`;
  if (diff < 172800) return "Ayer";
  return new Date(dateStr).toLocaleDateString("es-MX");
}

async function loadStats() {
  try {
    const res  = await fetch(STATS_URL);
    if (!res.ok) throw new Error();
    const data = await res.json();

    document.getElementById("cardAssets").textContent       = data.totalAssets;
    document.getElementById("cardConsumables").textContent  = data.totalConsumables;
    document.getElementById("cardRequests").textContent     = data.totalRequests;
    document.getElementById("cardReservations").textContent = data.todayReservations;

    renderMovements(data.lastMovements);
    renderActivity(data.recentActivity);
  } catch {
    console.warn("No se pudieron cargar las estadísticas");
  }
}

function renderMovements(movements) {
  const tbody = document.getElementById("movementsBody");
  if (!tbody) return;
  if (!movements.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#9ca3af;">Sin movimientos recientes</td></tr>`;
    return;
  }
  tbody.innerHTML = "";
  movements.forEach(m => {
    const st = statusLabel[m.status] || { text: m.status, color: "#6b7280" };
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${m.id}</td><td>${m.name}</td><td>—</td><td><span style="color:${st.color};font-weight:500;">${st.text}</span></td>`;
    tbody.appendChild(tr);
  });
}

function renderActivity(activities) {
  const container = document.getElementById("activityContainer");
  if (!container) return;
  if (!activities.length) {
    container.innerHTML = `<div class="activity-item">Sin actividad reciente<div class="time">—</div></div>`;
    return;
  }
  container.innerHTML = "";
  activities.forEach(a => {
    const div = document.createElement("div");
    div.className = "activity-item";
    div.innerHTML = `${a.action}${a.table_name ? ` en <strong>${a.table_name}</strong>` : ""}<div class="time">${timeAgo(a.timestamp)}</div>`;
    container.appendChild(div);
  });
}

document.addEventListener("DOMContentLoaded", loadStats);

// ── Tiempo real — cualquier cambio actualiza las tarjetas ──
  document.addEventListener("DOMContentLoaded", () => {
    REALTIME.on("*", () => {
      // Recargar estadísticas del dashboard
      if (typeof loadDashboard === "function") loadDashboard();
      else if (typeof loadStats === "function") loadStats();
    });
  });