const apiUrl = "http://localhost:3000/api/users";

const tbody = document.querySelector("#usersTable tbody");

const roleLabel = {
  administrador: { text: "Administrador", color: "#4f46e5" },
  docente:       { text: "Docente",       color: "#0891b2" },
  alumno:        { text: "Alumno",        color: "#16a34a" }
};

/* ── LISTAR ── */
async function loadUsers() {
  try {
    const res   = await fetch(apiUrl);
    const users = await res.json();
    tbody.innerHTML = "";

    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#9ca3af;">Sin usuarios registrados</td></tr>`;
      return;
    }

    users.forEach(u => {
      const rl = roleLabel[u.role] || { text: u.role, color: "#6b7280" };
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${u.id}</td>
        <td>${u.username}</td>
        <td>${u.email}</td>
        <td><span style="background:${rl.color};color:white;padding:3px 10px;border-radius:12px;font-size:12px;">${rl.text}</span></td>
        <td>
          <i class="fas fa-edit"  title="Editar"   style="cursor:pointer;color:#4f46e5;margin-right:12px;" onclick="editUser(${u.id})"></i>
          <i class="fas fa-trash" title="Eliminar" style="cursor:pointer;color:#dc2626;" onclick="deleteUser(${u.id})"></i>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#dc2626;">Error al conectar con el servidor</td></tr>`;
  }
}

/* ── ABRIR MODAL ── */
function openModal(mode = "add", user = null) {
  // Crear modal si no existe
  let modal = document.getElementById("userModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "userModal";
    modal.style.cssText = `
      display:none;position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.5);justify-content:center;align-items:center;z-index:1000;
    `;
    modal.innerHTML = `
      <div style="background:white;padding:30px;border-radius:12px;width:420px;position:relative;box-shadow:0 8px 24px rgba(0,0,0,0.2);">
        <span onclick="closeModal()" style="position:absolute;top:12px;right:16px;font-size:22px;cursor:pointer;color:#6b7280;">&times;</span>
        <h3 id="modalTitle" style="margin-bottom:20px;color:#1f2a3a;font-size:18px;">Nuevo Usuario</h3>
        <input type="hidden" id="userId">

        <label style="font-size:13px;color:#555;">Nombre de usuario</label>
        <input type="text" id="uUsername" placeholder="Ej: Juan Pérez"
          style="width:100%;padding:10px;margin:6px 0 14px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;">

        <label style="font-size:13px;color:#555;">Correo electrónico</label>
        <input type="email" id="uEmail" placeholder="correo@ejemplo.com"
          style="width:100%;padding:10px;margin:6px 0 14px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;">

        <label style="font-size:13px;color:#555;">Contraseña <span id="passHint" style="color:#9ca3af;">(dejar vacío para no cambiar)</span></label>
        <input type="password" id="uPassword" placeholder="Mínimo 6 caracteres"
          style="width:100%;padding:10px;margin:6px 0 14px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;">

        <label style="font-size:13px;color:#555;">Rol</label>
        <select id="uRole"
          style="width:100%;padding:10px;margin:6px 0 20px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;">
          <option value="alumno">Alumno</option>
          <option value="docente">Docente</option>
          <option value="administrador">Administrador</option>
        </select>

        <button onclick="saveUser()"
          style="width:100%;padding:11px;background:#4f46e5;color:white;border:none;border-radius:6px;font-size:15px;cursor:pointer;">
          Guardar
        </button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // Resetear campos
  document.getElementById("userId").value    = "";
  document.getElementById("uUsername").value = "";
  document.getElementById("uEmail").value    = "";
  document.getElementById("uPassword").value = "";
  document.getElementById("uRole").value     = "alumno";

  if (mode === "add") {
    document.getElementById("modalTitle").innerText   = "Nuevo Usuario";
    document.getElementById("passHint").style.display = "none";
  } else if (user) {
    document.getElementById("modalTitle").innerText   = "Editar Usuario";
    document.getElementById("passHint").style.display = "inline";
    document.getElementById("userId").value           = user.id;
    document.getElementById("uUsername").value        = user.username;
    document.getElementById("uEmail").value           = user.email;
    document.getElementById("uRole").value            = user.role;
  }

  modal.style.display = "flex";
}

function closeModal() {
  const modal = document.getElementById("userModal");
  if (modal) modal.style.display = "none";
}

/* ── GUARDAR ── */
async function saveUser() {
  const id       = document.getElementById("userId").value;
  const username = document.getElementById("uUsername").value.trim();
  const email    = document.getElementById("uEmail").value.trim();
  const password = document.getElementById("uPassword").value;
  const role     = document.getElementById("uRole").value;

  if (!username || !email) {
    alert("Nombre y correo son obligatorios.");
    return;
  }
  if (!id && !password) {
    alert("La contraseña es obligatoria para nuevos usuarios.");
    return;
  }
  if (password && password.length < 6) {
    alert("La contraseña debe tener al menos 6 caracteres.");
    return;
  }

  const body   = { username, email, password, role };
  const url    = id ? `${apiUrl}/${id}` : apiUrl;
  const method = id ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      alert("Error: " + (err.message || "No se pudo guardar"));
      return;
    }

    closeModal();
    loadUsers();
  } catch (err) {
    alert("No se pudo conectar con el servidor.");
  }
}

/* ── EDITAR ── */
async function editUser(id) {
  try {
    const res  = await fetch(`${apiUrl}/${id}`);
    const user = await res.json();
    openModal("edit", user);
  } catch {
    alert("No se pudo cargar el usuario.");
  }
}

/* ── ELIMINAR ── */
async function deleteUser(id) {
  if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;
  try {
    const res = await fetch(`${apiUrl}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error();
    loadUsers();
  } catch {
    alert("No se pudo eliminar el usuario.");
  }
}

/* ── INIT ── */
loadUsers();