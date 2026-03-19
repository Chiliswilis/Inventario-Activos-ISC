// ============================================
// SGIAC-ISC | common.js
// ============================================

function getUser() {
  try { return JSON.parse(localStorage.getItem("user")) || null; }
  catch { return null; }
}
function getUserRole()  { return getUser()?.role     || "alumno"; }
function getUsername()  { return getUser()?.username || "Usuario"; }

const rolePhotos = {
  administrador: "public/Captura de pantalla 2026-03-18 201833.png",
  docente:       "public/Captura de pantalla 2026-03-18 201617.png",
  alumno:        "public/Captura de pantalla 2026-03-18 201757.png"
};

function applyProfilePhoto() {
  const user = getUser();
  if (!user) return;
  const photo = rolePhotos[user.role] || rolePhotos.alumno;
  document.querySelectorAll(".user img").forEach(img => { img.src = photo; img.alt = user.role; });
}

function requireAuth() {
  if (!getUser()) window.location.href = "login.html";
}

// Páginas que requieren rol mínimo
const PAGE_PERMISSIONS = {
  "usuarios.html":      "administrador",
  "configuracion.html": "administrador",
  "reportes.html":      "administrador"   // docente ya NO tiene acceso
};

function requirePagePermission() {
  const page    = window.location.pathname.split("/").pop();
  const minRole = PAGE_PERMISSIONS[page];
  if (!minRole) return; // página sin restricción especial

  const role = getUserRole();
  if (role !== minRole) {
    // Redirigir según rol
    window.location.href = role === "alumno" ? "solicitudes.html" : "reservas.html";
  }
}

function hasPermission(permission) {
  const perms = {
    administrador: ["read","write","delete","manage_users","manage_assets","approve_requests","view_reports"],
    docente:       ["read","approve_requests","create_requests"],
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
      z-index:9999;display:flex;align-items:center;justify-content:center;
      animation:fadeIn 0.2s ease;
    `;
    overlay.innerHTML = `
      <style>
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        #logoutCard{animation:slideUp 0.25s ease;}
      </style>
      <div id="logoutCard" style="
        background:white;border-radius:16px;padding:32px;width:340px;
        box-shadow:0 20px 60px rgba(0,0,0,0.2);text-align:center;
      ">
        <div style="width:56px;height:56px;background:#fee2e2;border-radius:50%;
          display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <i class="fas fa-sign-out-alt" style="color:#dc2626;font-size:22px;"></i>
        </div>
        <h3 style="color:#1f2a3a;font-size:18px;margin-bottom:8px;">Cerrar sesión</h3>
        <p style="color:#6b7280;font-size:14px;margin-bottom:24px;">¿Estás seguro que deseas salir del sistema?</p>
        <div style="display:flex;gap:10px;">
          <button onclick="document.getElementById('logoutOverlay').remove()" style="
            flex:1;padding:11px;background:#f3f4f6;color:#374151;border:none;
            border-radius:8px;font-size:14px;font-family:'Poppins',sans-serif;cursor:pointer;
          ">Cancelar</button>
          <button onclick="doLogout()" style="
            flex:1;padding:11px;background:#dc2626;color:white;border:none;
            border-radius:8px;font-size:14px;font-family:'Poppins',sans-serif;cursor:pointer;
          ">Cerrar sesión</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  }
}

function doLogout() {
  localStorage.removeItem("user");
  localStorage.removeItem("session");
  window.location.href = "login.html";
}

function applyMenuByRole() {
  const role = getUserRole();

  // Solo admin ve estas páginas en el menú
  const adminOnly = ["usuarios.html", "configuracion.html", "reportes.html"];

  document.querySelectorAll(".menu a").forEach(link => {
    const page = (link.getAttribute("href") || "").split("/").pop();
    if (adminOnly.includes(page) && role !== "administrador") {
      link.style.display = "none";
    }
  });
}

function applyRoleUI() {
  const user = getUser();
  if (!user) return;

  ["username","usernameDisplay","userDisplayName"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = user.username;
  });
  document.querySelectorAll(".username-display").forEach(el => el.textContent = user.username);

  applyProfilePhoto();

  if (user.role !== "administrador")
    document.querySelectorAll(".admin-only").forEach(el => el.style.display = "none");
  if (user.role === "alumno")
    document.querySelectorAll(".docente-plus").forEach(el => el.style.display = "none");

  // Botón logout con modal
  const userDiv = document.querySelector(".user");
  if (userDiv && !document.getElementById("logoutBtn")) {
    const btn = document.createElement("button");
    btn.id = "logoutBtn";
    btn.title = "Cerrar sesión";
    btn.innerHTML = `<i class="fas fa-sign-out-alt"></i>`;
    btn.style.cssText = `background:none;border:none;cursor:pointer;color:#6b7280;font-size:18px;margin-left:8px;padding:4px;transition:0.2s;`;
    btn.onmouseenter = () => btn.style.color = "#dc2626";
    btn.onmouseleave = () => btn.style.color = "#6b7280";
    btn.onclick = showLogoutModal;
    userDiv.appendChild(btn);
  }

  applyMenuByRole();
}

document.addEventListener("DOMContentLoaded", () => {
  requireAuth();
  requirePagePermission(); // bloquear acceso directo por URL
  applyRoleUI();
});