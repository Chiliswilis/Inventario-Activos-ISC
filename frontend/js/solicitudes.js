const API       = "http://localhost:3000/api/requests";
const USERS_URL = "http://localhost:3000/api/users";
const ASSETS_URL= "http://localhost:3000/api/assets";
const CONS_URL  = "http://localhost:3000/api/consumibles";

let allRequests = [];
let allUsers    = [];
let currentUser = null;

const statusMap = {
  pending:          { text:"Pendiente",         cls:"badge-pending",  icon:"fa-clock"        },
  pending_admin:    { text:"Enviada al Admin",   cls:"badge-info",     icon:"fa-paper-plane"  },
  approved:         { text:"Aprobada",           cls:"badge-approved", icon:"fa-check-circle" },
  rejected:         { text:"Rechazada",          cls:"badge-rejected", icon:"fa-times-circle" },
  returned:         { text:"Devuelta",           cls:"badge-returned", icon:"fa-undo"         }
};

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  await loadUsers();
  await loadRequests();
  await loadItemsByType();
});

/* ── CARGAR USUARIOS ── */
async function loadUsers() {
  try {
    const res = await fetch(USERS_URL);
    allUsers  = await res.json();
  } catch {}
}

/* ── LISTAR ── */
async function loadRequests() {
  showLoading();
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error();
    let data = await res.json();

    // Filtrar según rol
    if (currentUser.role === "alumno") {
      data = data.filter(r => String(r.user_id) === String(currentUser.id));
    } else if (currentUser.role === "docente") {
      // Docente ve las que le enviaron sus alumnos (docente_id = él)
      // y las que ya envió al admin
      data = data.filter(r => String(r.docente_id) === String(currentUser.id));
    }
    // Admin ve todas

    allRequests = data;
    renderTable(data);
  } catch {
    showError("No se pudieron cargar las solicitudes");
  }
}

/* ── RENDER ── */
function renderTable(data) {
  const wrap = document.getElementById("tableWrapper");
  if (!data.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-clipboard"></i><p>Sin solicitudes registradas</p></div>`;
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>ID</th><th>Solicitante</th><th>Docente</th><th>Ítem</th>
        <th>Tipo</th><th>Cant.</th><th>Fecha</th><th>Estado</th><th>Acciones</th>
      </tr></thead>
      <tbody id="reqBody"></tbody>
    </table>`;

  const tbody = document.getElementById("reqBody");
  data.forEach(r => {
    const st      = statusMap[r.status] || { text: r.status, cls:"badge-pending", icon:"fa-clock" };
    const usuario = r.users?.username   || "—";
    const docente = r.docente?.username || "—";
    const item    = r.assets?.name || r.consumables?.name || "—";
    const tipo    = r.request_type === "consumable" ? "Consumible" : "Activo";
    const fecha   = r.request_date ? new Date(r.request_date).toLocaleDateString("es-MX") : "—";
    const role    = currentUser.role;

    let acciones = "";

    // DOCENTE: puede enviar al admin las que están pendientes dirigidas a él
    if (role === "docente" && r.status === "pending") {
      acciones += `
        <button class="action-btn action-approve" title="Enviar al Administrador" onclick="sendToAdmin(${r.id})">
          <i class="fas fa-paper-plane"></i>
        </button>
        <button class="action-btn action-reject" title="Rechazar" onclick="openRejectModal(${r.id})">
          <i class="fas fa-times"></i>
        </button>`;
    }

    // ADMIN: puede aprobar/rechazar las que el docente envió
    if (role === "administrador" && r.status === "pending_admin") {
      acciones += `
        <button class="action-btn action-approve" title="Aprobar con fecha" onclick="openApproveModal(${r.id})">
          <i class="fas fa-check"></i>
        </button>
        <button class="action-btn action-reject" title="Rechazar" onclick="openRejectModal(${r.id})">
          <i class="fas fa-times"></i>
        </button>`;
    }

    // DOCENTE: puede registrar devolución de las aprobadas
    if (role === "docente" && r.status === "approved") {
      acciones += `
        <button class="action-btn action-return" title="Registrar devolución" onclick="openReturnModal(${r.id})">
          <i class="fas fa-undo"></i>
        </button>`;
    }

    // Ver respuesta admin si existe
    if (r.admin_message || r.pickup_date) {
      acciones += `
        <button class="action-btn action-info" title="Ver respuesta del administrador" onclick="showAdminResponse(${r.id})">
          <i class="fas fa-info-circle"></i>
        </button>`;
    }

    // Admin puede eliminar cualquiera
    if (role === "administrador") {
      acciones += `
        <button class="action-btn action-delete" title="Eliminar" onclick="deleteRequest(${r.id})">
          <i class="fas fa-trash"></i>
        </button>`;
    }

    const incidentBadge = r.incident
      ? `<span title="Reportó incidente" style="color:#f59e0b;margin-left:4px;"><i class="fas fa-exclamation-triangle"></i></span>`
      : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${usuario}</td>
      <td>${docente}</td>
      <td>${item}${incidentBadge}</td>
      <td><span style="font-size:11px;background:#ede9fe;color:#4f46e5;padding:2px 8px;border-radius:10px;">${tipo}</span></td>
      <td>${r.quantity_requested}</td>
      <td>${fecha}</td>
      <td><span class="badge ${st.cls}"><i class="fas ${st.icon}"></i> ${st.text}</span></td>
      <td style="white-space:nowrap;">${acciones || "—"}</td>`;
    tbody.appendChild(tr);
  });
}

/* ── DOCENTE ENVÍA AL ADMIN ── */
async function sendToAdmin(id) {
  if (!confirm("¿Enviar esta solicitud al Administrador?")) return;
  try {
    const res = await fetch(`${API}/${id}`, {
      method: "PUT",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ status: "pending_admin" })
    });
    if (!res.ok) throw new Error();
    showToast("Solicitud enviada al administrador ✅", "success");
    await loadRequests();
  } catch { showToast("Error al enviar la solicitud", "error"); }
}

/* ── MODAL NUEVA SOLICITUD ── */
function openModal() {
  document.getElementById("modalTitle").textContent = "Nueva Solicitud";
  document.getElementById("requestId").value  = "";
  document.getElementById("reqType").value    = "asset";
  document.getElementById("reqQty").value     = "1";
  document.getElementById("reqNotes").value   = "";

  // Select de usuario solicitante
  const selUser = document.getElementById("reqUser");
  selUser.innerHTML = `<option value="" disabled selected>Seleccione usuario</option>`;

  if (currentUser.role === "alumno") {
    // Alumno solo se ve a sí mismo
    const opt = document.createElement("option");
    opt.value = currentUser.id;
    opt.textContent = currentUser.username;
    opt.selected = true;
    selUser.appendChild(opt);
    selUser.disabled = true;
  } else {
    selUser.disabled = false;
    allUsers.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = `${u.username} (${u.role})`;
      selUser.appendChild(opt);
    });
  }

  // Select de docente (solo visible para alumnos)
  const docenteGroup = document.getElementById("docenteGroup");
  const selDocente   = document.getElementById("reqDocente");

  if (currentUser.role === "alumno") {
    docenteGroup.style.display = "block";
    selDocente.innerHTML = `<option value="" disabled selected>Seleccione su docente</option>`;
    allUsers.filter(u => u.role === "docente").forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.username;
      selDocente.appendChild(opt);
    });
  } else {
    docenteGroup.style.display = "none";
  }

  loadItemsByType();
  document.getElementById("requestModal").classList.add("open");
}

function closeModal() {
  document.querySelectorAll(".modal").forEach(m => m.classList.remove("open"));
}

/* ── MODAL APROBAR (admin) ── */
function openApproveModal(id) {
  let modal = document.getElementById("approveModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "approveModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-box">
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3><i class="fas fa-check-circle" style="color:#16a34a;margin-right:8px;"></i>Aprobar Solicitud</h3>
        <input type="hidden" id="approveId">
        <div class="form-group">
          <label>Fecha y hora de recogida *</label>
          <input type="datetime-local" id="pickupDate">
        </div>
        <div class="form-group">
          <label>Lugar de recogida *</label>
          <input type="text" id="pickupLocation" value="Laboratorio de Sistemas A">
        </div>
        <div class="form-group">
          <label>Mensaje para el docente</label>
          <textarea id="adminMsg" placeholder="Indicaciones adicionales..."></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
          <button class="btn" style="flex:1;background:#16a34a;" onclick="submitApprove()">
            <i class="fas fa-check"></i> Confirmar aprobación
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  }
  document.getElementById("approveId").value  = id;
  document.getElementById("pickupDate").value = "";
  document.getElementById("adminMsg").value   = "";
  modal.classList.add("open");
}

async function submitApprove() {
  const id              = document.getElementById("approveId").value;
  const pickup_date     = document.getElementById("pickupDate").value;
  const pickup_location = document.getElementById("pickupLocation").value.trim();
  const admin_message   = document.getElementById("adminMsg").value.trim();

  if (!pickup_date || !pickup_location) {
    showToast("Fecha y lugar son obligatorios", "error"); return;
  }

  try {
    const res = await fetch(`${API}/${id}/approve`, {
      method: "PUT",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ pickup_date, pickup_location, admin_message })
    });
    if (!res.ok) throw new Error();
    showToast("Solicitud aprobada ✅", "success");
    closeModal();
    await loadRequests();
  } catch { showToast("Error al aprobar", "error"); }
}

/* ── MODAL RECHAZAR ── */
function openRejectModal(id) {
  let modal = document.getElementById("rejectModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "rejectModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-box">
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3><i class="fas fa-times-circle" style="color:#dc2626;margin-right:8px;"></i>Rechazar Solicitud</h3>
        <input type="hidden" id="rejectId">
        <div class="form-group">
          <label>Motivo del rechazo</label>
          <textarea id="rejectMsg" placeholder="Explica el motivo..."></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
          <button class="btn" style="flex:1;background:#dc2626;" onclick="submitReject()">
            <i class="fas fa-times"></i> Rechazar
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  }
  document.getElementById("rejectId").value  = id;
  document.getElementById("rejectMsg").value = "";
  modal.classList.add("open");
}

async function submitReject() {
  const id  = document.getElementById("rejectId").value;
  const msg = document.getElementById("rejectMsg").value.trim();
  try {
    const res = await fetch(`${API}/${id}/reject`, {
      method: "PUT",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ admin_message: msg || "Solicitud rechazada" })
    });
    if (!res.ok) throw new Error();
    showToast("Solicitud rechazada", "success");
    closeModal();
    await loadRequests();
  } catch { showToast("Error al rechazar", "error"); }
}

/* ── MODAL DEVOLUCIÓN (docente) ── */
function openReturnModal(id) {
  let modal = document.getElementById("returnModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "returnModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-box">
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3><i class="fas fa-undo" style="color:#4f46e5;margin-right:8px;"></i>Registrar Devolución</h3>
        <input type="hidden" id="returnId">
        <div class="form-group">
          <label>¿Hubo algún incidente?</label>
          <select id="incidentSelect" onchange="toggleIncidentFields()">
            <option value="no">No — Sin incidentes</option>
            <option value="yes">Sí — Hubo un incidente</option>
          </select>
        </div>
        <div id="incidentFields" style="display:none;">
          <div class="form-group">
            <label>Causa del incidente *</label>
            <textarea id="incidentCause" placeholder="Describe qué pasó..."></textarea>
          </div>
          <div class="form-group">
            <label>Solución propuesta *</label>
            <textarea id="incidentSolution" placeholder="¿Cómo se puede reponer o reparar?"></textarea>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
          <button class="btn" style="flex:1;" onclick="submitReturn()">
            <i class="fas fa-check"></i> Confirmar devolución
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  }
  document.getElementById("returnId").value       = id;
  document.getElementById("incidentSelect").value = "no";
  document.getElementById("incidentFields").style.display = "none";
  modal.classList.add("open");
}

function toggleIncidentFields() {
  const val = document.getElementById("incidentSelect").value;
  document.getElementById("incidentFields").style.display = val === "yes" ? "block" : "none";
}

async function submitReturn() {
  const id       = document.getElementById("returnId").value;
  const incident = document.getElementById("incidentSelect").value === "yes";
  const cause    = document.getElementById("incidentCause")?.value.trim();
  const solution = document.getElementById("incidentSolution")?.value.trim();

  if (incident && (!cause || !solution)) {
    showToast("Debes describir la causa y solución", "error"); return;
  }

  try {
    const res = await fetch(`${API}/${id}/return`, {
      method: "PUT",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ incident, incident_cause: cause, incident_solution: solution })
    });
    if (!res.ok) throw new Error();
    showToast(incident ? "Devolución con incidente registrada ⚠️" : "Devolución registrada ✅", "success");
    closeModal();
    await loadRequests();
  } catch { showToast("Error al registrar devolución", "error"); }
}

/* ── VER RESPUESTA ADMIN ── */
function showAdminResponse(id) {
  const r = allRequests.find(x => x.id === id);
  if (!r) return;

  let modal = document.getElementById("infoModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "infoModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-box">
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <h3><i class="fas fa-info-circle" style="color:#4f46e5;margin-right:8px;"></i>Respuesta del Administrador</h3>
        <div id="infoContent"></div>
        <div class="modal-actions" style="margin-top:16px;">
          <button class="btn" style="width:100%;" onclick="closeModal()">Cerrar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  }

  const pickupDate = r.pickup_date
    ? new Date(r.pickup_date).toLocaleString("es-MX", { dateStyle:"long", timeStyle:"short" })
    : null;

  document.getElementById("infoContent").innerHTML = `
    <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:12px;">
      <p style="font-size:13px;color:#15803d;font-weight:600;margin-bottom:10px;">
        <i class="fas fa-check-circle"></i> Solicitud Aprobada
      </p>
      ${pickupDate ? `<p style="font-size:13px;color:#374151;margin-bottom:6px;">
        <i class="fas fa-calendar" style="color:#4f46e5;width:18px;"></i>
        <strong>Fecha y hora:</strong> ${pickupDate}</p>` : ""}
      ${r.pickup_location ? `<p style="font-size:13px;color:#374151;margin-bottom:6px;">
        <i class="fas fa-map-marker-alt" style="color:#4f46e5;width:18px;"></i>
        <strong>Lugar:</strong> ${r.pickup_location}</p>` : ""}
      ${r.admin_message ? `<p style="font-size:13px;color:#374151;margin-top:8px;padding-top:8px;border-top:1px solid #bbf7d0;">
        <i class="fas fa-comment" style="color:#4f46e5;width:18px;"></i>
        <strong>Mensaje:</strong> ${r.admin_message}</p>` : ""}
    </div>
    ${r.incident ? `
    <div style="background:#fef9c3;border-radius:8px;padding:16px;">
      <p style="font-size:13px;color:#a16207;font-weight:600;margin-bottom:8px;">
        <i class="fas fa-exclamation-triangle"></i> Incidente Reportado
      </p>
      <p style="font-size:13px;color:#374151;margin-bottom:4px;"><strong>Causa:</strong> ${r.incident_cause||"—"}</p>
      <p style="font-size:13px;color:#374151;"><strong>Solución:</strong> ${r.incident_solution||"—"}</p>
    </div>` : ""}`;

  modal.classList.add("open");
}

/* ── GUARDAR NUEVA SOLICITUD ── */
async function saveRequest() {
  const user_id    = document.getElementById("reqUser").value;
  const docente_id = currentUser.role === "alumno"
    ? document.getElementById("reqDocente").value
    : (currentUser.role === "docente" ? currentUser.id : null);
  const type    = document.getElementById("reqType").value;
  const itemId  = document.getElementById("reqItem").value;
  const qty     = parseInt(document.getElementById("reqQty").value);
  const notes   = document.getElementById("reqNotes").value.trim();

  if (!user_id || !itemId) { showToast("Usuario e ítem son obligatorios", "error"); return; }
  if (currentUser.role === "alumno" && !docente_id) {
    showToast("Debes seleccionar un docente", "error"); return;
  }

  const body = {
    user_id,
    docente_id: docente_id || null,
    asset_id:      type === "asset"      ? itemId : null,
    consumable_id: type === "consumable" ? itemId : null,
    quantity_requested: qty || 1,
    notes,
    request_type: type
  };

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body)
    });
    if (!res.ok) { const e = await res.json(); showToast("Error: "+(e.message||"No se pudo guardar"), "error"); return; }
    showToast("Solicitud creada ✅", "success");
    closeModal();
    await loadRequests();
  } catch { showToast("No se pudo conectar con el servidor", "error"); }
}

/* ── ELIMINAR ── */
async function deleteRequest(id) {
  if (!confirm("¿Eliminar esta solicitud?")) return;
  try {
    const res = await fetch(`${API}/${id}`, { method:"DELETE" });
    if (!res.ok) throw new Error();
    showToast("Solicitud eliminada", "success");
    await loadRequests();
  } catch { showToast("No se pudo eliminar", "error"); }
}

/* ── SELECT ÍTEMS ── */
async function loadItemsByType() {
  const type = document.getElementById("reqType")?.value || "asset";
  const url  = type === "asset" ? ASSETS_URL : CONS_URL;
  try {
    const res   = await fetch(url);
    const items = await res.json();
    const sel   = document.getElementById("reqItem");
    sel.innerHTML = `<option value="" disabled selected>Seleccione ítem</option>`;
    items.forEach(i => {
      const opt = document.createElement("option");
      opt.value = i.id; opt.textContent = i.name;
      sel.appendChild(opt);
    });
  } catch {}
}

/* ── EXPORTAR ── */
function exportCSV() {
  let csv = "ID,Solicitante,Docente,Ítem,Tipo,Cantidad,Fecha,Estado\n";
  allRequests.forEach(r => {
    const item  = r.assets?.name || r.consumables?.name || "";
    const fecha = r.request_date ? new Date(r.request_date).toLocaleDateString("es-MX") : "";
    csv += `${r.id},"${r.users?.username||""}","${r.docente?.username||""}","${item}","${r.request_type}",${r.quantity_requested},"${fecha}","${statusMap[r.status]?.text||r.status}"\n`;
  });
  const blob = new Blob(["\ufeff"+csv], {type:"text/csv;charset=utf-8;"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "solicitudes.csv"; a.click();
  showToast("Exportado ✅", "success");
}

function showLoading() {
  document.getElementById("tableWrapper").innerHTML =
    `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Cargando...</p></div>`;
}
function showError(msg) {
  document.getElementById("tableWrapper").innerHTML =
    `<div class="empty-state"><i class="fas fa-exclamation-circle" style="color:#ef4444"></i><p>${msg}</p></div>`;
}
function showToast(msg, type="success") {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 3500);
}
document.getElementById("requestModal")?.addEventListener("click", function(e) {
  if (e.target === this) closeModal();
});