// ============================================
// SGIAC-ISC | common.js

// ============================================

/* ── USUARIO ── */
function getUser() {
  try { return JSON.parse(localStorage.getItem("user")) || null; }
  catch { return null; }
}
function getUserRole()  { return getUser()?.role     || "alumno"; }
function getUsername()  { return getUser()?.username || "Usuario"; }

/* ── FOTOS POR ROL ── */
const rolePhotos = {
  administrador: "../public/Captura de pantalla 2026-03-15 131358.png",
  docente:       "../public/Captura de pantalla 2026-03-15 131947.png",
  alumno:        "../public/Captura de pantalla 2026-03-15 132051.png"
};

function applyProfilePhoto() {
  try {
    const user  = getUser();
    if (!user) return;
    const photo = rolePhotos[user.role] || rolePhotos.alumno;
    document.querySelectorAll(".user img").forEach(img => {
      img.src = photo;
      img.alt = user.role;
    });
  } catch {}
}

/* ── PROTECCIÓN DE RUTAS ── */
function requireAuth() {
  if (!getUser()) window.location.href = "login.html";
}

/* ── PERMISOS ── */
function hasPermission(permission) {
  const perms = {
    administrador: ["read","write","delete","manage_users","manage_assets","approve_requests","view_reports"],
    docente:       ["read","write","view_reports","create_requests"],
    alumno:        ["read","create_requests","view_own_requests"]
  };
  return perms[getUserRole()]?.includes(permission) || false;
}

/* ── CERRAR SESIÓN ── */
function logout() {
  localStorage.removeItem("user");
  localStorage.removeItem("session");
  window.location.href = "login.html";
}

/* ── MENÚ SEGÚN ROL ── */
function applyMenuByRole() {
  const role = getUserRole();
  const adminOnly   = ["usuarios.html", "configuracion.html"];
  const docentePlus = ["reportes.html"];

  document.querySelectorAll(".menu a").forEach(link => {
    const page = (link.getAttribute("href") || "").split("/").pop();
    if (adminOnly.includes(page)   && role !== "administrador") link.style.display = "none";
    if (docentePlus.includes(page) && role === "alumno")        link.style.display = "none";
  });
}

/* ── APLICAR UI ── */
function applyRoleUI() {
  const user = getUser();
  if (!user) return;

  // Nombre en header
  ["username", "usernameDisplay", "userDisplayName"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = user.username;
  });
  document.querySelectorAll(".username-display").forEach(el => {
    el.textContent = user.username;
  });

  // Foto por rol en todas las páginas
  applyProfilePhoto();

  // Ocultar por clase
  if (user.role !== "administrador") {
    document.querySelectorAll(".admin-only").forEach(el => el.style.display = "none");
  }
  if (user.role === "alumno") {
    document.querySelectorAll(".docente-plus").forEach(el => el.style.display = "none");
  }

  // Botón logout
  const userDiv = document.querySelector(".user");
  if (userDiv && !document.getElementById("logoutBtn")) {
    const btn = document.createElement("button");
    btn.id = "logoutBtn";
    btn.title = "Cerrar sesión";
    btn.innerHTML = `<i class="fas fa-sign-out-alt"></i>`;
    btn.style.cssText = `background:none;border:none;cursor:pointer;color:#6b7280;font-size:18px;margin-left:8px;padding:4px;transition:0.2s;`;
    btn.onmouseenter = () => btn.style.color = "#dc2626";
    btn.onmouseleave = () => btn.style.color = "#6b7280";
    btn.onclick = () => { if (confirm("¿Deseas cerrar sesión?")) logout(); };
    userDiv.appendChild(btn);
  }

  
  applyMenuByRole();
}

/* ── INIT ── */
document.addEventListener("DOMContentLoaded", () => {
  requireAuth();
  applyRoleUI();
});