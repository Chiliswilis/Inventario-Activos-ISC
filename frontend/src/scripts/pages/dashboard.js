const STATS_URL = "/api/stats";

const statusLabel = {
  available:   { text: "Disponible",    cls: "status-available" },
  borrowed:    { text: "Prestado",      cls: "status-borrowed" },
  maintenance: { text: "Mantenimiento", cls: "status-maintenance" }
};

// ─── Utilidades ────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)     return "Hace un momento";
  if (diff < 3600)   return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400)  return `Hace ${Math.floor(diff / 3600)} hora${Math.floor(diff / 3600) > 1 ? "s" : ""}`;
  if (diff < 172800) return "Ayer";
  return new Date(dateStr).toLocaleDateString("es-MX");
}

function animateCount(el, target) {
  if (!el) return;
  const duration = 600;
  const start    = performance.now();
  el.classList.remove("loading-val");
  (function tick(now) {
    const t    = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(ease * target);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  })(start);
}

// ─── Detección del rol ────────────────────────────────
/**
 * Obtiene el rol del usuario desde las múltiples fuentes
 * que puede usar common.js / auth.js del proyecto:
 *   1. window.USER_ROLE  (asignado por common.js antes de este script)
 *   2. localStorage / sessionStorage → clave "role" | "userRole" | "user"
 *   3. JWT en localStorage → campo "role" del payload
 *   4. Badge del DOM (el header ya pinta "Alumno" / "Docente" / "Admin")
 *
 * Devuelve: "admin" | "docente" | "alumno"
 */
function detectRole() {
  // 1 — variable global (más confiable, la pone common.js)
  if (window.USER_ROLE) return window.USER_ROLE.toLowerCase().trim();

  // 2 — storage directo
  const storageKeys = ["role", "userRole", "user_role", "rol"];
  for (const store of [localStorage, sessionStorage]) {
    for (const key of storageKeys) {
      const val = store.getItem(key);
      if (val) return val.toLowerCase().trim();
    }
    // objeto "user" serializado
    const raw = store.getItem("user") || store.getItem("currentUser") || store.getItem("userData");
    if (raw) {
      try {
        const obj = JSON.parse(raw);
        const r = obj.role || obj.rol || obj.tipo || obj.type || obj.user_role;
        if (r) return r.toLowerCase().trim();
      } catch { /* no es JSON */ }
    }
  }

  // 3 — JWT (token → payload → role)
  const tokenKeys = ["token", "access_token", "jwt", "authToken"];
  for (const store of [localStorage, sessionStorage]) {
    for (const key of tokenKeys) {
      const tok = store.getItem(key);
      if (tok && tok.includes(".")) {
        try {
          const payload = JSON.parse(atob(tok.split(".")[1]));
          const r = payload.role || payload.rol || payload.tipo || payload.user_role;
          if (r) return r.toLowerCase().trim();
        } catch { /* token inválido */ }
      }
    }
  }

  // 4 — Leer el badge que ya está pintado en el DOM por common.js
  //     El header renderiza: <span class="role-badge">Alumno</span>
  //     o variantes: #userRole, .badge-role, #rolBadge, etc.
  const badgeSelectors = [
    "#rolBadge", "#userRole", "#role-badge", ".role-badge",
    ".badge-role", "[data-role]", "#headerRole"
  ];
  for (const sel of badgeSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const txt = (el.dataset.role || el.textContent || "").toLowerCase().trim();
      if (txt) return txt;
    }
  }

  // 5 — Fallback: si el username contiene "admin"
  const uname = (document.getElementById("username")?.textContent || "").toLowerCase();
  if (uname.includes("admin")) return "admin";
  if (uname.includes("docente") || uname.includes("prof")) return "docente";

  return "admin"; // default seguro para no romper el sistema
}

// ─── Cache de usuarios (admin) ────────────────────────
let _usersCache = null;

async function fetchUsersMap() {
  if (_usersCache) return _usersCache;
  try {
    // Intentar endpoint estándar de usuarios
    const endpoints = ["/api/users", "/api/usuarios", "/api/students", "/api/alumnos"];
    for (const url of endpoints) {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.users || data.data || data.alumnos || []);
      if (list.length) {
        // Construir mapa id → nombre
        const map = {};
        list.forEach(u => {
          const id   = u.id || u.user_id || u.id_usuario;
          const name = u.nombre || u.name || u.username || u.nombre_completo ||
                       ((u.first_name || u.nombre) ? `${u.first_name || u.nombre} ${u.last_name || u.apellido || ""}`.trim() : null);
          if (id && name) map[id] = name;
        });
        _usersCache = map;
        return map;
      }
    }
  } catch { /* silencioso */ }
  return {};
}

// ─── Render Movimientos ───────────────────────────────
async function renderMovements(movements) {
  const tbody = document.getElementById("movementsBody");
  if (!tbody) return;
  if (!movements || !movements.length) {
    tbody.innerHTML = `<tr class="loading-row"><td colspan="4">Sin movimientos recientes</td></tr>`;
    return;
  }

  // Verificar si algún movimiento no tiene usuario → enriquecer con mapa de usuarios
  const needsEnrich = movements.some(m =>
    !(m.user || m.username || m.user_name || m.assigned_to ||
      m.borrower || m.nombre_usuario || m.nombre)
  );
  const usersMap = needsEnrich ? await fetchUsersMap() : {};

  tbody.innerHTML = "";
  movements.forEach(m => {
    const st = statusLabel[m.status] || { text: m.status || "—", cls: "" };

    // Resolver nombre del usuario
    let usuario =
      m.user || m.username || m.user_name || m.assigned_to ||
      m.borrower || m.nombre_usuario || m.nombre || m.alumno || m.student;

    // Si sigue vacío, buscar en el mapa por user_id / alumno_id
    if (!usuario) {
      const uid = m.user_id || m.alumno_id || m.student_id || m.id_usuario || m.borrower_id;
      if (uid && usersMap[uid]) {
        usuario = usersMap[uid];
      }
    }

    // Último recurso: mostrar el id del usuario si existe
    if (!usuario) {
      const uid = m.user_id || m.alumno_id || m.student_id || m.id_usuario || m.borrower_id;
      usuario = uid ? `<span class="mono" style="font-size:11px;color:var(--ibm-gray-50);">ID ${uid}</span>` : "—";
    }

    const activo = m.name || m.asset_name || m.activo || m.nombre_activo || "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">#${m.id}</td>
      <td>${activo}</td>
      <td>${usuario}</td>
      <td><span class="status-badge ${st.cls}">${st.text}</span></td>`;
    tbody.appendChild(tr);
  });
}

// ─── Render Actividad ─────────────────────────────────
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

// ─── Acceso rápido (alumno / docente) ─────────────────
function renderQuickCards(role) {
  const containers = document.querySelectorAll(".quickAccessCards");
  if (!containers.length) return;

  const base = [
    { icon:"fa-clipboard-list", color:"yellow", label:"Mis Solicitudes",    desc:"Consulta y envía solicitudes de materiales", href:"solicitudes.html" },
    { icon:"fa-calendar-check", color:"green",  label:"Mis Reservas",       desc:"Administra tus reservas de equipos",         href:"reservas.html" },
    { icon:"fa-box",            color:"blue",   label:"Catálogo de Activos",desc:"Consulta el inventario disponible",          href:"activos.html" },
    { icon:"fa-flask",          color:"teal",   label:"Consumibles",        desc:"Visualiza materiales de laboratorio",        href:"consumibles.html" },
  ];
  const docente = [
    ...base,
    { icon:"fa-file-alt", color:"purple", label:"Reportes", desc:"Revisa reportes de uso del laboratorio", href:"reportes.html" },
  ];

  const cards = role === "docente" ? docente : base;
  const html  = cards.map(c => `
    <a href="${c.href}" class="quick-card quick-card-${c.color}">
      <div class="quick-card-icon"><i class="fas ${c.icon}"></i></div>
      <div class="quick-card-info">
        <div class="quick-card-label">${c.label}</div>
        <div class="quick-card-desc">${c.desc}</div>
      </div>
      <i class="fas fa-chevron-right quick-card-arrow"></i>
    </a>`).join("");

  containers.forEach(el => { el.innerHTML = html; });
}

// ─── Carga stats (admin / docente) ───────────────────
async function loadStats() {
  try {
    const res  = await fetch(STATS_URL);
    if (!res.ok) throw new Error();
    const data = await res.json();

    // Admin usa IDs directos; docente usa sufijo D
    [["cardAssets","cardAssetsD"], ["cardConsumables","cardConsumablesD"],
     ["cardRequests","cardRequestsD"], ["cardReservations","cardReservationsD"]]
      .forEach(([a, b]) => {
        animateCount(document.getElementById(a), data.totalAssets      || 0);
        animateCount(document.getElementById(b), data.totalAssets      || 0);
      });
    // Valores correctos por tarjeta
    animateCount(document.getElementById("cardAssets"),        data.totalAssets);
    animateCount(document.getElementById("cardConsumables"),   data.totalConsumables);
    animateCount(document.getElementById("cardRequests"),      data.totalRequests);
    animateCount(document.getElementById("cardReservations"),  data.todayReservations);
    animateCount(document.getElementById("cardAssetsD"),       data.totalAssets);
    animateCount(document.getElementById("cardConsumablesD"),  data.totalConsumables);
    animateCount(document.getElementById("cardRequestsD"),     data.totalRequests);
    animateCount(document.getElementById("cardReservationsD"), data.todayReservations);

    await renderMovements(data.lastMovements);
    renderActivity(data.recentActivity);
  } catch {
    console.warn("No se pudieron cargar las estadísticas");
    const ids = ["cardAssets","cardConsumables","cardRequests","cardReservations",
                 "cardAssetsD","cardConsumablesD","cardRequestsD","cardReservationsD"];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = "—"; el.classList.remove("loading-val"); }
    });
  }
}

// ─── Carga stats personales (alumno) ─────────────────
async function loadStudentStats() {
  try {
    const res  = await fetch("/api/stats/me");
    if (!res.ok) throw new Error();
    const data = await res.json();
    animateCount(document.getElementById("myRequests"),     data.myRequests     ?? 0);
    animateCount(document.getElementById("myReservations"), data.myReservations ?? 0);
    animateCount(document.getElementById("myPending"),      data.myPending      ?? 0);
  } catch {
    ["myRequests","myReservations","myPending"].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = "0"; el.classList.remove("loading-val"); }
    });
  }
}

// ─── Aplicar vista según rol ──────────────────────────
function applyRoleView() {
  const role = detectRole();

  // Ocultar todo primero
  ["view-admin","view-docente","view-alumno"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  document.querySelectorAll(".menu-admin,.menu-docente,.menu-alumno").forEach(el => {
    el.style.display = "none";
  });

  const todayStr = new Date().toLocaleDateString("es-MX", { weekday:"long", day:"numeric", month:"short" });
  ["todayDate","todayDateD"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = todayStr;
  });

  const titleEl = document.getElementById("headerTitle");

  if (role === "alumno") {
    const v = document.getElementById("view-alumno");
    if (v) v.style.display = "block";
    document.querySelectorAll(".menu-alumno").forEach(el => el.style.display = "block");
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-home"></i> Bienvenido al Sistema';

    // Nombre personalizado en banner
    const nameEl = document.getElementById("welcomeName");
    if (nameEl) {
      const uname = document.getElementById("username")?.textContent?.trim();
      if (uname && uname !== "Cargando...") nameEl.textContent = `Bienvenido/a, ${uname}`;
    }

    loadStudentStats();
    renderQuickCards("alumno");

  } else if (role === "docente") {
    const v = document.getElementById("view-docente");
    if (v) v.style.display = "block";
    document.querySelectorAll(".menu-docente").forEach(el => el.style.display = "block");
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-chart-line"></i> Panel Docente';

    loadStats();
    renderQuickCards("docente");

  } else {
    // admin (default)
    const v = document.getElementById("view-admin");
    if (v) v.style.display = "block";
    document.querySelectorAll(".menu-admin").forEach(el => el.style.display = "block");
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-chart-line"></i> Panel de Administración';

    loadStats();
  }
}

// ─── Init ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // common.js se carga DESPUÉS de este script según el HTML original,
  // así que esperamos un tick para que inicialice window.USER_ROLE
  setTimeout(applyRoleView, 0);

  // Tiempo real
  if (typeof REALTIME !== "undefined") {
    REALTIME.on("*", () => applyRoleView());
  }
});

// También exponer loadDashboard por compatibilidad con otros scripts
window.loadDashboard = applyRoleView;