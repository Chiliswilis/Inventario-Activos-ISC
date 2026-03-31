// Reservas management functions (updated)
const API      = "/api/reservations";
let allReservations = [];
let labs        = [];
let consumables = [];
let assets      = [];
let users       = [];
let currentUser = null;

let assetRowCount = 0;
let consRowCount  = 0;

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  await loadCatalogs();
  renderLabsGrid();
  await loadReservations();
});

async function loadCatalogs() {
  const [labsRes, consRes, assetsRes, usersRes] = await Promise.all([
    fetch("/api/labs").then(r => r.json()),
    fetch("/api/consumibles").then(r => r.json()),
    fetch("/api/assets").then(r => r.json()),
    fetch("/api/users").then(r => r.json())
  ]);
  labs        = Array.isArray(labsRes)  ? labsRes  : [];
  consumables = Array.isArray(consRes)  ? consRes  : [];
  assets      = Array.isArray(assetsRes) ? assetsRes : [];
  users       = Array.isArray(usersRes) ? usersRes : [];
}

// ── LABS GRID (estado ocupado/disponible) ──
function renderLabsGrid() {
  const occupied = new Set(
    allReservations
      .filter(r => r.status === "occupied" || (r.status === "approved" && r.fecha_uso === today()))
      .map(r => r.lab_id)
  );
  const grid = document.getElementById("labsGrid");
  if (!labs.length) { grid.innerHTML = `<p style="color:#9ca3af;font-size:13px;">Sin laboratorios registrados</p>`; return; }
  grid.innerHTML = labs.map(l => {
    const isOcc = occupied.has(l.id);
    return `<div class="lab-status-card ${isOcc ? "occupied" : "available"}">
      <div class="lab-card-title">${l.nombre}</div>
      <div class="lab-card-edif">${l.edificio}</div>
      <div class="lab-status-pill ${isOcc ? "pill-occupied" : "pill-available"}">
        <span class="pill-dot"></span>${isOcc ? "Ocupado" : "Disponible"}
      </div>
      <div style="font-size:11px;color:#9ca3af;margin-top:4px;">${l.open_time}–${l.close_time}</div>
    </div>`;
  }).join("");
}

function today() { return new Date().toISOString().split("T")[0]; }

// ── CARGAR RESERVAS ──
async function loadReservations() {
  const res = await fetch(API);
  allReservations = await res.json();
  renderLabsGrid();
  applyFilters();
}

function applyFilters() {
  const st    = document.getElementById("filterStatus").value;
  const fecha = document.getElementById("filterFecha").value;
  let data = [...allReservations];
  if (st)    data = data.filter(r => r.status === st);
  if (fecha) data = data.filter(r => r.fecha_uso === fecha);
  renderTable(data);
}

// ── TABLA ──
function renderTable(data) {
  const wrap = document.getElementById("tableWrapper");
  const role = currentUser?.role;

  if (!data.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-calendar"></i><p>Sin reservas</p></div>`;
    return;
  }

  const statusMap = {
    pending:   '<span class="badge badge-pending">Pendiente</span>',
    approved:  '<span class="badge badge-approved">Aprobado</span>',
    occupied:  '<span class="badge badge-occupied">En uso</span>',
    released:  '<span class="badge badge-released">Liberado</span>',
    cancelled: '<span class="badge badge-cancelled">Cancelado</span>'
  };

  const rows = data.map(r => {
    const labName  = r.lab ? `${r.lab.nombre}<br><small style="color:#6b7280;">${r.lab.edificio}</small>` : "—";
    const consText = r.reservation_consumables?.length
      ? r.reservation_consumables.map(c => `${c.consumables?.name} ×${c.quantity_requested}`).join(", ")
      : "—";
    // We don't show assets in the table for simplicity, but they are stored.

    let acciones = "";
    if (role === "docente" && r.status === "pending") {
      acciones += `<button class="btn-success" onclick="openApprove(${r.id})" title="Aprobar"><i class="fas fa-check"></i></button>`;
    }
    if ((role === "docente" || role === "administrador") && r.status === "approved") {
      acciones += `<button class="btn-info" onclick="markOccupied(${r.id})" title="Marcar en uso"><i class="fas fa-play"></i></button>`;
    }
    if ((role === "docente" || role === "administrador") && r.status === "occupied") {
      acciones += `<button class="btn-success" onclick="openRelease(${r.id})" title="Firma de salida"><i class="fas fa-sign-out-alt"></i></button>`;
    }
    if ((role === "docente" && (r.status === "pending" || r.status === "approved") && r.docente_id === currentUser?.id)
      || role === "administrador") {
      acciones += `<button class="btn-danger" onclick="openCancel(${r.id})" title="Cancelar"><i class="fas fa-times"></i></button>`;
    }
    if (role === "administrador") {
      acciones += `<button style="background:#6b7280;color:white;border:none;padding:7px 12px;border-radius:6px;cursor:pointer;font-size:13px;" onclick="deleteReservation(${r.id})"><i class="fas fa-trash"></i></button>`;
    }

    return `<tr>
      <td>${labName}</td>
      <td>${r.docente?.username || "—"}<br><small style="color:#6b7280;">${r.grupo ? r.grupo + " · " + r.semestre : ""}</small></td>
      <td>${formatDate(r.fecha_uso)}<br><small style="color:#6b7280;">${r.hora_inicio} – ${r.hora_fin}</small></td>
      <td><small style="color:#6b7280;">${consText}</small></td>
      <td>${statusMap[r.status] || r.status}</td>
      <td><div style="display:flex;gap:5px;flex-wrap:wrap;">${acciones}</div></td>
    </tr>`;
  }).join("");

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Laboratorio</th><th>Docente / Grupo</th>
        <th>Fecha y hora</th><th>Consumibles</th>
        <th>Estado</th><th>Acciones</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── NUEVA RESERVA ──
function openNewModal() {
  // Llenar labs
  const selLab = document.getElementById("newLab");
  selLab.innerHTML = `<option value="">-- Selecciona laboratorio --</option>`;
  const grouped = labs.reduce((acc, l) => { (acc[l.edificio] = acc[l.edificio] || []).push(l); return acc; }, {});
  for (const [edif, ls] of Object.entries(grouped)) {
    const og = document.createElement("optgroup"); og.label = edif;
    ls.forEach(l => {
      const op = document.createElement("option"); op.value = l.id;
      op.textContent = l.nombre;
      op.dataset.open  = l.open_time;
      op.dataset.close = l.close_time;
      og.appendChild(op);
    });
    selLab.appendChild(og);
  }

  // Fecha mínima = hoy
  const todayStr = today();
  document.getElementById("newFecha").min = todayStr;
  document.getElementById("newFecha").value = "";

  // Limpiar activos y consumibles
  document.getElementById("assetsContainer").innerHTML = "";
  document.getElementById("consContainer").innerHTML = "";
  assetRowCount = 0;
  consRowCount = 0;

  // Configurar campos de usuario según rol
  const grpAlumno = document.getElementById("grpAlumno");
  const grpDocente = document.getElementById("grpDocente");
  const selAlumno = document.getElementById("newAlumno");
  const selDocente = document.getElementById("newDocente");

  if (currentUser.role === "alumno") {
    // ── ALUMNO: él aparece por defecto; elige el docente que lo avala ──
    grpAlumno.style.display = "block";
    grpDocente.style.display = "block";

    // El select de "alumno" lo fijamos a sí mismo (solo lectura visual)
    selAlumno.innerHTML = "";
    const selfOpt = document.createElement("option");
    selfOpt.value = currentUser.id;
    selfOpt.textContent = `${currentUser.username} (tú)`;
    selAlumno.appendChild(selfOpt);
    selAlumno.disabled = true;
    grpAlumno.querySelector("label").textContent = "Solicitante";

    // Docente responsable obligatorio
    grpDocente.querySelector("label").textContent = "Docente responsable *";
    selDocente.innerHTML = `<option value="">-- Selecciona docente --</option>`;
    users.filter(u => u.role === "docente").forEach(u => {
      const op = document.createElement("option");
      op.value = u.id; op.textContent = u.username;
      selDocente.appendChild(op);
    });
    selDocente.disabled = false;

  } else if (currentUser.role === "docente") {
    // ── DOCENTE: ya está registrado, solo elige si reserva para un alumno ──
    grpAlumno.style.display = "block";
    grpDocente.style.display = "none";

    // El docente puede reservar para sí mismo o para un alumno
    grpAlumno.querySelector("label").textContent = "Reserva para *";
    selAlumno.innerHTML = `<option value="${currentUser.id}">${currentUser.username} (yo)</option>`;
    users.filter(u => u.role === "alumno").forEach(u => {
      const op = document.createElement("option");
      op.value = u.id; op.textContent = `${u.username} (alumno)`;
      selAlumno.appendChild(op);
    });
    selAlumno.disabled = false;

  } else if (currentUser.role === "administrador") {
    // ── ADMIN: elige alumno y docente libremente ──
    grpAlumno.style.display = "block";
    grpDocente.style.display = "block";
    grpAlumno.querySelector("label").textContent = "Alumno solicitante *";
    grpDocente.querySelector("label").textContent = "Docente responsable *";

    selAlumno.disabled = false;
    selDocente.disabled = false;

    selAlumno.innerHTML = `<option value="">-- Selecciona alumno --</option>`;
    users.filter(u => u.role === "alumno").forEach(u => {
      const op = document.createElement("option"); op.value = u.id; op.textContent = u.username;
      selAlumno.appendChild(op);
    });
    selDocente.innerHTML = `<option value="">-- Selecciona docente responsable --</option>`;
    users.filter(u => u.role === "docente").forEach(u => {
      const op = document.createElement("option"); op.value = u.id; op.textContent = u.username;
      selDocente.appendChild(op);
    });
  }

  // Resetear filtros de área/categoría para activos
  refreshAreaFilter();

  document.getElementById("newModal").classList.add("open");
}

function validateWeekend(input) {
  if (!input.value) return;
  const d = new Date(input.value + "T12:00:00");
  if (d.getDay() === 0 || d.getDay() === 6) {
    showToast("No se permiten reservas en fines de semana", "error");
    input.value = "";
  }
}

function onLabChange() {
  const opt = document.getElementById("newLab").selectedOptions[0];
  if (!opt?.dataset.open) return;
  document.getElementById("newHoraInicio").min = opt.dataset.open;
  document.getElementById("newHoraInicio").max = opt.dataset.close;
  document.getElementById("newHoraFin").min    = opt.dataset.open;
  document.getElementById("newHoraFin").max    = opt.dataset.close;
}

// ── Área activa para filtrar activos en reservas ──
let _reservaArea = "";
let _reservaCat  = "";

function refreshAreaFilter() {
  _reservaArea = "";
  _reservaCat  = "";
  const sec = document.getElementById("assetsFilterSection");
  if (sec) sec.remove();

  // Inyectar filtros sobre el contenedor de activos
  const assetsSec = document.getElementById("assetsSection");
  if (!assetsSec) return;

  const div = document.createElement("div");
  div.id = "assetsFilterSection";
  div.style.cssText = "margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;";

  // Área
  const selArea = document.createElement("select");
  selArea.style.cssText = "padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:'Poppins',sans-serif;outline:none;color:#374151;";
  selArea.innerHTML = `
    <option value="">Todas las áreas</option>
    <option value="sistemas">🖥 Sistemas</option>
    <option value="laboratorio">🔬 Lab / Alimentos</option>`;
  selArea.onchange = () => {
    _reservaArea = selArea.value;
    _reservaCat  = "";
    buildReservaCatFilter(selArea.value, selCat);
    // Refrescar las filas existentes
    document.querySelectorAll("#assetsContainer .asset-row select").forEach(s => {
      const cur = s.value;
      s.innerHTML = buildAssetOptions();
      if ([...s.options].some(o => o.value === cur)) s.value = cur;
    });
  };

  // Categoría
  const selCat = document.createElement("select");
  selCat.id = "assetsFilterCat";
  selCat.style.cssText = selArea.style.cssText;
  selCat.innerHTML = `<option value="">Todas las categorías</option>`;
  selCat.onchange = () => {
    _reservaCat = selCat.value;
    document.querySelectorAll("#assetsContainer .asset-row select").forEach(s => {
      const cur = s.value;
      s.innerHTML = buildAssetOptions();
      if ([...s.options].some(o => o.value === cur)) s.value = cur;
    });
  };

  div.appendChild(document.createTextNode("Área: "));
  div.appendChild(selArea);
  div.appendChild(document.createTextNode("  Categoría: "));
  div.appendChild(selCat);
  assetsSec.insertBefore(div, assetsSec.firstChild);
}

function buildReservaCatFilter(area, selCat) {
  selCat.innerHTML = `<option value="">Todas las categorías</option>`;
  // Obtener categorías únicas de los activos disponibles según área
  const cats = [...new Map(
    assets
      .filter(a => a.status === "available" && (!area || a.area === area))
      .map(a => [a.category_id, a.categories?.name || "Sin categoría"])
  ).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  cats.forEach(([id, name]) => {
    const o = document.createElement("option");
    o.value = id; o.textContent = name;
    selCat.appendChild(o);
  });
}

function buildAssetOptions() {
  return assets
    .filter(a =>
      a.status === "available" &&
      (!_reservaArea || a.area === _reservaArea) &&
      (!_reservaCat  || String(a.category_id) === String(_reservaCat))
    )
    .map(a => {
      const area = a.area === "sistemas" ? "🖥" : a.area === "laboratorio" ? "🔬" : "";
      const cat  = a.categories?.name || "";
      return `<option value="${a.id}" data-serial="${a.serial_number||""}">${area} ${a.name}${cat ? " · " + cat : ""} (Serie: ${a.serial_number||"S/N"})</option>`;
    })
    .join("");
}

// ── Agregar filas de activos ──
function addAssetRow() {
  const id  = `asset_${++assetRowCount}`;
  const row = document.createElement("div");
  row.className = "asset-row"; row.id = id;
  const opts = buildAssetOptions();
  row.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 60px 32px;gap:6px;align-items:center;margin-bottom:6px;">
      <select onchange="onAssetRowChange(this)" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:'Poppins',sans-serif;outline:none;color:#374151;">
        <option value="">-- Activo --</option>${opts}
      </select>
      <input type="number" value="1" min="1" max="1" readonly
        style="padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:'Poppins',sans-serif;outline:none;text-align:center;">
      <button onclick="document.getElementById('${id}').remove()"
        style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:16px;padding:4px;">
        <i class="fas fa-times"></i></button>
    </div>
    <div id="info_${id}" style="font-size:11px;color:#9ca3af;display:none;padding:0 0 6px 4px;"></div>`;
  document.getElementById("assetsContainer").appendChild(row);
}

function onAssetRowChange(sel) {
  const opt = sel.selectedOptions[0];
  const row = sel.closest(".asset-row");
  const info = row?.querySelector("[id^='info_']");
  if (!info) return;
  if (!opt?.value) { info.style.display = "none"; return; }
  info.style.display = "block";
  info.innerHTML = `<i class="fas fa-info-circle" style="color:#4f46e5;"></i> Serie: <strong>${opt.dataset.serial||"S/N"}</strong>`;
}

function addConsRow() {
  const id  = `cons_${++consRowCount}`;
  const row = document.createElement("div");
  row.className = "cons-row"; row.id = id;
  const opts = consumables
    .filter(c => c.quantity > 0)
    .map(c => {
      const area = c.area === "sistemas" ? "🖥" : c.area === "laboratorio" ? "🔬" : "";
      return `<option value="${c.id}" data-qty="${c.quantity}" data-unit="${c.unit||"u"}">${area} ${c.name} (Disp: ${c.quantity} ${c.unit||"u"})</option>`;
    }).join("");
  row.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 80px 32px;gap:6px;align-items:center;margin-bottom:6px;">
      <select style="padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:'Poppins',sans-serif;outline:none;color:#374151;">
        <option value="">-- Consumible --</option>${opts}
      </select>
      <input type="number" value="1" min="1" placeholder="Cant."
        style="padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:'Poppins',sans-serif;outline:none;text-align:center;">
      <button onclick="document.getElementById('${id}').remove()"
        style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:16px;padding:4px;">
        <i class="fas fa-times"></i></button>
    </div>`;
  document.getElementById("consContainer").appendChild(row);
}

async function saveReservation() {
  const lab_id       = document.getElementById("newLab").value;
  const fecha_uso    = document.getElementById("newFecha").value;
  const hora_inicio  = document.getElementById("newHoraInicio").value;
  const hora_fin     = document.getElementById("newHoraFin").value;
  const proposito    = document.getElementById("newProposito").value.trim();

  if (!lab_id || !fecha_uso || !hora_inicio || !hora_fin || !proposito) {
    showToast("Completa todos los campos obligatorios", "error"); return;
  }

  let alumno_id  = null;
  let docente_id = null;

  if (currentUser.role === "alumno") {
    // Alumno siempre es él mismo
    alumno_id  = currentUser.id;
    docente_id = parseInt(document.getElementById("newDocente").value);
    if (!docente_id) { showToast("Selecciona un docente responsable", "error"); return; }
  } else if (currentUser.role === "docente") {
    // Docente puede reservar para sí mismo o para un alumno
    alumno_id  = parseInt(document.getElementById("newAlumno").value);
    docente_id = currentUser.id;
    if (!alumno_id) { showToast("Selecciona para quién es la reserva", "error"); return; }
  } else if (currentUser.role === "administrador") {
    alumno_id  = parseInt(document.getElementById("newAlumno").value);
    docente_id = parseInt(document.getElementById("newDocente").value);
    if (!alumno_id || !docente_id) { showToast("Selecciona alumno y docente", "error"); return; }
  }

  // Recolectar activos
  const assetsArr = [];
  document.querySelectorAll("#assetsContainer .asset-row").forEach(row => {
    const aid = row.querySelector("select").value;
    if (aid) assetsArr.push({ asset_id: parseInt(aid) });
  });

  // Recolectar consumibles
  const consumablesArr = [];
  document.querySelectorAll("#consContainer .cons-row").forEach(row => {
    const cid = row.querySelector("select").value;
    const qty = parseInt(row.querySelector("input").value) || 1;
    if (cid) consumablesArr.push({ consumable_id: parseInt(cid), quantity_requested: qty });
  });

  const body = {
    alumno_id, docente_id,
    lab_id: parseInt(lab_id),
    fecha_uso, hora_inicio, hora_fin, proposito,
    assets: assetsArr,
    consumables: consumablesArr
  };

  const res = await fetch(API, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) { const e = await res.json(); showToast(e.message || "Error", "error"); return; }
  showToast("Reserva creada exitosamente ✅", "success");
  closeModal("newModal");
  loadReservations();
}

// ── APROBAR ──
function openApprove(id) {
  document.getElementById("approveId").value = id;
  ["approveGrupo","approveSemestre","approveEncargado","approveMessage"].forEach(f => document.getElementById(f).value = "");
  document.getElementById("approveModal").classList.add("open");
}
async function approveReservation() {
  const id       = document.getElementById("approveId").value;
  const grupo    = document.getElementById("approveGrupo").value.trim();
  const semestre = document.getElementById("approveSemestre").value.trim();
  const encarg   = document.getElementById("approveEncargado").value.trim();
  const msg      = document.getElementById("approveMessage").value.trim();
  if (!grupo || !semestre) { showToast("Grupo y semestre son obligatorios", "error"); return; }
  const res = await fetch(`${API}/${id}/approve`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grupo, semestre, encargado_grupo: encarg, docente_message: msg })
  });
  if (!res.ok) { showToast("Error al aprobar", "error"); return; }
  showToast("Reserva aprobada ✅", "success");
  closeModal("approveModal");
  loadReservations();
}

// ── EN USO ──
async function markOccupied(id) {
  if (!confirm("¿Marcar laboratorio como 'En uso'?")) return;
  await fetch(`${API}/${id}/occupy`, { method: "PUT" });
  showToast("Laboratorio marcado como en uso", "info");
  loadReservations();
}

// ── LIBERAR ──
function openRelease(id) {
  const r = allReservations.find(x => x.id === id);
  document.getElementById("releaseId").value = id;
  const listEl  = document.getElementById("leftoverList");
  const section = document.getElementById("leftoverSection");
  listEl.innerHTML = "";

  const cons = r?.reservation_consumables || [];
  if (cons.length > 0) {
    section.style.display = "block";
    cons.forEach(c => {
      listEl.innerHTML += `
        <div class="leftover-row" data-rc-id="${c.id}">
          <span class="item-name">${c.consumables?.name || "Consumible"} (solicitado: ${c.quantity_requested})</span>
          <input type="number" min="0" placeholder="Sobrante" value="0">
        </div>`;
    });
  } else {
    section.style.display = "none";
  }
  document.getElementById("releaseModal").classList.add("open");
}
async function releaseReservation() {
  const id = document.getElementById("releaseId").value;
  const leftover_items = [];
  document.querySelectorAll("#leftoverList .leftover-row").forEach(row => {
    leftover_items.push({ reservation_consumable_id: parseInt(row.dataset.rcId), leftover_qty: parseInt(row.querySelector("input").value) || 0 });
  });
  const res = await fetch(`${API}/${id}/release`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leftover_items })
  });
  if (!res.ok) { showToast("Error al liberar", "error"); return; }
  showToast("Laboratorio liberado ✅", "success");
  closeModal("releaseModal");
  loadReservations();
}

// ── CANCELAR ──
function openCancel(id) {
  document.getElementById("cancelId").value = id;
  document.getElementById("cancelMessage").value = "";
  document.getElementById("cancelModal").classList.add("open");
}
async function cancelReservation() {
  const id  = document.getElementById("cancelId").value;
  const msg = document.getElementById("cancelMessage").value.trim();
  await fetch(`${API}/${id}/cancel`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ docente_message: msg })
  });
  showToast("Reserva cancelada", "info");
  closeModal("cancelModal");
  loadReservations();
}

// ── ELIMINAR ──
async function deleteReservation(id) {
  if (!confirm("¿Eliminar esta reserva?")) return;
  await fetch(`${API}/${id}`, { method: "DELETE" });
  showToast("Reserva eliminada", "info");
  loadReservations();
}

// ── UTILS ──
function closeModal(id) { document.getElementById(id).classList.remove("open"); }
function toggleMenu() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebarOverlay").classList.toggle("show");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("show");
}
function formatDate(d) {
  if (!d) return "—";
  const p = d.split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 3500);
}
document.querySelectorAll(".modal").forEach(m => {
  m.addEventListener("click", e => { if (e.target === m) m.classList.remove("open"); });
});

  // ── Tiempo real ──
  document.addEventListener("DOMContentLoaded", () => {
    REALTIME.on("reservations", (event) => {
      if (!document.querySelector(".modal.open")) {
        loadReservations();
      }
    });
  });