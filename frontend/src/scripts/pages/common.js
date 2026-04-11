function getUser() {
  try { return JSON.parse(localStorage.getItem("user")) || null; }
  catch { return null; }
}
function getUserRole()  { return getUser()?.role     || "alumno"; }
function getUsername()  { return getUser()?.username || "Usuario"; }

/* ── CSS del sidebar inyectado globalmente (garantiza tamaño idéntico en todas las páginas) ── */
(function injectSidebarCSS() {
  if (document.getElementById("sgiac-sidebar-css")) return;
  const style = document.createElement("style");
  style.id = "sgiac-sidebar-css";
  style.textContent = `
    .sidebar {
      width: 240px !important;
      min-width: 240px !important;
      max-width: 240px !important;
      flex-shrink: 0 !important;
      overflow-x: hidden !important;
      box-sizing: border-box !important;
    }
  `;
  document.head.appendChild(style);
})();

const rolePhotos = {
  administrador: "/assets/Captura de pantalla 2026-03-18 201833.png",
  docente:       "/assets/Captura de pantalla 2026-03-18 201617.png",
  alumno:        "/assets/Captura de pantalla 2026-03-18 201757.png"
};

function applyProfilePhoto() {
  const user = getUser();
  if (!user) return;
  const photo = rolePhotos[user.role] || rolePhotos.alumno;
  document.querySelectorAll(".user img").forEach(img => { img.src = photo; img.alt = user.role; });
}

function requireAuth() {
  if (!getUser()) window.location.href = "/login.html";
}

// ── PERMISOS POR PÁGINA ──────────────────────────────────────
const PAGE_RULES = {
  "usuarios.html":      { access: "admin_only" },
  "reportes.html":      { access: "admin_only" },
};

function requirePagePermission() {
  const page = window.location.pathname.split("/").pop();
  const rule = PAGE_RULES[page];
  if (!rule) return;

  const role = getUserRole();

  if (rule.access === "admin_only" && role !== "administrador") {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                  background:#f1f3f9;font-family:'Poppins',sans-serif;">
        <div style="text-align:center;background:white;border-radius:16px;padding:48px 40px;
                    box-shadow:0 8px 24px rgba(0,0,0,0.10);max-width:400px;">
          <div style="width:64px;height:64px;background:#fee2e2;border-radius:50%;
                      display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
            <i class="fas fa-lock" style="color:#dc2626;font-size:26px;"></i>
          </div>
          <h2 style="color:#1f2a3a;margin-bottom:10px;font-size:20px;">Acceso restringido</h2>
          <p style="color:#6b7280;font-size:14px;margin-bottom:24px;line-height:1.6;">
            Esta sección es exclusiva para administradores.<br>
            Tu rol actual es <strong>${role}</strong>.
          </p>
          <a href="/pages/dashboard.html" style="display:inline-block;background:#4f46e5;color:white;
             padding:11px 28px;border-radius:8px;text-decoration:none;font-size:14px;">
            ← Volver al inicio
          </a>
        </div>
      </div>`;
    return;
  }
}

function hasPermission(permission) {
  const perms = {
    administrador: ["read","write","delete","manage_users","manage_assets","view_reports","view_logs"],
    docente:       ["read","approve_requests","create_requests","reject_requests"],
    alumno:        ["read","create_requests","view_own_requests"]
  };
  return perms[getUserRole()]?.includes(permission) || false;
}

/* ── MODAL LOGOUT ── */
function showLogoutModal() {
  let overlay = document.getElementById("logoutOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "logoutOverlay";
    overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);
      z-index:9999;display:flex;align-items:center;justify-content:center;`;
    overlay.innerHTML = `
      <div id="logoutCard" style="
        background:white;border-radius:16px;padding:32px;width:340px;
        box-shadow:0 20px 60px rgba(0,0,0,0.2);text-align:center;
        animation:slideUp 0.22s ease;">
        <style>@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}</style>
        <div style="width:56px;height:56px;background:#fee2e2;border-radius:50%;
          display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <i class="fas fa-sign-out-alt" style="color:#dc2626;font-size:22px;"></i>
        </div>
        <h3 style="color:#1f2a3a;font-size:18px;margin-bottom:8px;">Cerrar sesión</h3>
        <p style="color:#6b7280;font-size:14px;margin-bottom:24px;">
          ¿Estás seguro que deseas salir del sistema?
        </p>
        <div style="display:flex;gap:10px;">
          <button onclick="document.getElementById('logoutOverlay').remove()" style="
            flex:1;padding:11px;background:#f3f4f6;color:#374151;border:none;
            border-radius:8px;font-size:14px;font-family:'Poppins',sans-serif;cursor:pointer;">
            Cancelar
          </button>
          <button onclick="doLogout()" style="
            flex:1;padding:11px;background:#dc2626;color:white;border:none;
            border-radius:8px;font-size:14px;font-family:'Poppins',sans-serif;cursor:pointer;">
            Cerrar sesión
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  }
}

function doLogout() {
  localStorage.removeItem("user");
  localStorage.removeItem("session");
  window.location.href = "/login.html";
}

/* ── SIDEBAR: reconstruir menú completo según rol ── */
const MENU_BY_ROLE = {
  administrador: [
    {
      section: "Principal",
      links: [
        { icon: "fa-chart-line",    label: "Panel Principal", href: "/pages/dashboard.html" },
      ]
    },
    {
      section: "Inventario",
      links: [
        { icon: "fa-box",           label: "Activos",         href: "/pages/activos.html" },
        { icon: "fa-flask",         label: "Consumibles",     href: "/pages/consumibles.html" },
      ]
    },
    {
      section: "Gestión",
      links: [
        { icon: "fa-clipboard-list",label: "Solicitudes",     href: "/pages/solicitudes.html" },
        { icon: "fa-calendar-check",label: "Reservas",        href: "/pages/reservas.html" },
        { icon: "fa-users",         label: "Usuarios",        href: "/pages/usuarios.html" },
      ]
    },
    {
      section: "Sistema",
      links: [
        { icon: "fa-file-alt",      label: "Reportes",        href: "/pages/reportes.html" },
        { icon: "fa-cog",           label: "Configuración",   href: "/pages/configuracion.html" },
      ]
    },
  ],

  docente: [
    {
      section: "Principal",
      links: [
        { icon: "fa-chart-line",    label: "Panel Principal", href: "/pages/dashboard.html" },
      ]
    },
    {
      section: "Inventario",
      links: [
        { icon: "fa-box",           label: "Activos",         href: "/pages/activos.html" },
        { icon: "fa-flask",         label: "Consumibles",     href: "/pages/consumibles.html" },
      ]
    },
    {
      section: "Gestión",
      links: [
        { icon: "fa-clipboard-list",label: "Solicitudes",     href: "/pages/solicitudes.html" },
        { icon: "fa-calendar-check",label: "Reservas",        href: "/pages/reservas.html" },
      ]
    },
    {
      section: "Sistema",
      links: [
        { icon: "fa-cog",           label: "Configuración",   href: "/pages/configuracion.html" },
      ]
    },
  ],

  alumno: [
    {
      section: "Principal",
      links: [
        { icon: "fa-home",          label: "Inicio",          href: "/pages/dashboard.html" },
      ]
    },
    {
      section: "Laboratorio",
      links: [
        { icon: "fa-box",           label: "Catálogo de Activos", href: "/pages/activos.html" },
        { icon: "fa-flask",         label: "Consumibles",         href: "/pages/consumibles.html" },
      ]
    },
    {
      section: "Mis Trámites",
      links: [
        { icon: "fa-clipboard-list",label: "Mis Solicitudes", href: "/pages/solicitudes.html" },
        { icon: "fa-calendar-check",label: "Mis Reservas",    href: "/pages/reservas.html" },
      ]
    },
    {
      section: "Mi Cuenta",
      links: [
        { icon: "fa-cog",           label: "Configuración",   href: "/pages/configuracion.html" },
      ]
    },
  ],
};

function applyMenuByRole() {
  const role    = getUserRole();
  const menuEl  = document.querySelector(".menu");
  if (!menuEl) return;

  const sections = MENU_BY_ROLE[role] || MENU_BY_ROLE.alumno;
  const currentPage = window.location.pathname.split("/").pop() || "dashboard.html";

  menuEl.innerHTML = sections.map(sec => {
    const links = sec.links.map(l => {
      const page   = l.href.split("/").pop();
      const active = page === currentPage ? " active" : "";
      return `<a href="${l.href}" class="${active}">
        <i class="fas ${l.icon}"></i> ${l.label}
      </a>`;
    }).join("");
    return `<div class="menu-section">${sec.section}</div>${links}`;
  }).join("");

  if (role !== "administrador") {
    document.querySelectorAll(".admin-only").forEach(el => el.style.display = "none");
  }
  if (role === "alumno") {
    document.querySelectorAll(".docente-plus").forEach(el => el.style.display = "none");
  }
}

/* ── BADGE DE ROL en el header ── */
function buildRoleBadge(role) {
  const cfg = {
    administrador: { label:"Admin",   color:"#4f46e5", bg:"#ede9fe" },
    docente:       { label:"Docente", color:"#0891b2", bg:"#e0f2fe" },
    alumno:        { label:"Alumno",  color:"#16a34a", bg:"#dcfce7" }
  }[role] || { label: role, color:"#6b7280", bg:"#f3f4f6" };

  return `<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;
                       background:${cfg.bg};color:${cfg.color};margin-left:6px;vertical-align:middle;">
            ${cfg.label}
          </span>`;
}

/* ── INIT COMPLETO ── */
function applyRoleUI() {
  const user = getUser();
  if (!user) return;

  ["username","usernameDisplay","userDisplayName"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = user.username;
  });
  document.querySelectorAll(".username-display").forEach(el => el.textContent = user.username);

  applyProfilePhoto();

  const userDiv = document.querySelector(".user");
  if (userDiv) {
    const nameSpan = userDiv.querySelector("span");
    if (nameSpan && !userDiv.querySelector(".role-badge")) {
      const badge = document.createElement("span");
      badge.className = "role-badge";
      badge.innerHTML = buildRoleBadge(user.role);
      nameSpan.insertAdjacentElement("afterend", badge);
    }
  }

  if (userDiv && !document.getElementById("logoutBtn")) {
    const btn = document.createElement("button");
    btn.id = "logoutBtn";
    btn.title = "Cerrar sesión";
    btn.innerHTML = `<i class="fas fa-sign-out-alt"></i>`;
    btn.style.cssText = `background:none;border:none;cursor:pointer;color:#6b7280;
                         font-size:18px;margin-left:8px;padding:4px;transition:0.2s;`;
    btn.onmouseenter = () => btn.style.color = "#dc2626";
    btn.onmouseleave = () => btn.style.color = "#6b7280";
    btn.onclick = showLogoutModal;
    userDiv.appendChild(btn);
  }

  applyMenuByRole();
}

document.addEventListener("DOMContentLoaded", () => {
  requireAuth();
  requirePagePermission();
  applyRoleUI();
});