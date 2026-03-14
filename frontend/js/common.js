// ============================================
// SGIAC-ISC | common.js
// Utilidades globales: sesión, roles, UI
// ============================================

/* ── OBTENER DATOS DEL USUARIO ── */
function getUser() {
  try { return JSON.parse(localStorage.getItem("user")) || null; }
  catch { return null; }
}
function getUserRole()  { return getUser()?.role     || "alumno"; }
function getUsername()  { return getUser()?.username || "Usuario"; }

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

  // Links del menú que solo ve el administrador
  const adminOnlyLinks = ["usuarios.html", "configuracion.html"];

  // Links del menú que ven admin y docente (no alumno)
  const docentePlusLinks = ["reportes.html"];

  document.querySelectorAll(".menu a").forEach(link => {
    const href = link.getAttribute("href") || "";
    const page = href.split("/").pop(); // obtiene solo el nombre del archivo

    if (adminOnlyLinks.includes(page) && role !== "administrador") {
      link.style.display = "none";
    }
    if (docentePlusLinks.includes(page) && role === "alumno") {
      link.style.display = "none";
    }
  });
}

/* ── APLICAR UI ── */
function applyRoleUI() {
  const user = getUser();
  if (!user) return;

  // Mostrar nombre en elementos comunes
  ["username", "usernameDisplay", "userDisplayName"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = user.username;
  });
  document.querySelectorAll(".username-display").forEach(el => {
    el.textContent = user.username;
  });

  // Badge de rol
  const roleBadge = {
    administrador: { text:"Administrador", color:"#4f46e5" },
    docente:       { text:"Docente",       color:"#0891b2" },
    alumno:        { text:"Alumno",        color:"#16a34a" }
  };
  const rb = roleBadge[user.role] || { text: user.role, color:"#6b7280" };
  document.querySelectorAll(".role-display").forEach(el => {
    el.textContent = rb.text;
    el.style.cssText = `background:${rb.color};color:white;padding:2px 10px;border-radius:10px;font-size:12px;`;
  });

  // Ocultar elementos por clase
  if (user.role !== "administrador") {
    document.querySelectorAll(".admin-only").forEach(el => el.style.display = "none");
  }
  if (user.role === "alumno") {
    document.querySelectorAll(".docente-plus").forEach(el => el.style.display = "none");
  }

  // Botón logout en el header
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

  // Aplicar menú por rol
  applyMenuByRole();
}

/* ── INIT ── */
document.addEventListener("DOMContentLoaded", () => {
  requireAuth();
  applyRoleUI();
});