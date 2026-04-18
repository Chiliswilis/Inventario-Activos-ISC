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
  currentUser = JSON.parse(sessionStorage.getItem("user") || "null") || {};
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

    // DOCENTE: aprobar/rechazar pendientes (solo si él es el docente responsable)
    if (role === "docente" && r.status === "pending" && Number(r.docente_id) === Number(currentUser?.id)) {
      acciones += `<button class="btn-success" onclick="openApprove(${r.id})" title="Aprobar"><i class="fas fa-check"></i></button>`;
      acciones += `<button class="btn-danger" onclick="openRejectReserva(${r.id})" title="Rechazar"><i class="fas fa-times"></i></button>`;
    }
    // DOCENTE: editar sus propias reservas pending o approved
    if (role === "docente" && (r.status === "pending" || r.status === "approved") && Number(r.docente_id) === Number(currentUser?.id)) {
      acciones += `<button class="btn-info" onclick="openEditReserva(${r.id})" title="Editar"><i class="fas fa-edit"></i></button>`;
    }
    // ALUMNO: editar o eliminar sus propias reservas pending
    if (role === "alumno" && r.status === "pending" && Number(r.alumno_id) === Number(currentUser?.id)) {
      acciones += `<button class="btn-info" onclick="openEditReserva(${r.id})" title="Editar"><i class="fas fa-edit"></i></button>`;
      acciones += `<button class="btn-danger" onclick="deleteReservation(${r.id})" title="Eliminar"><i class="fas fa-trash"></i></button>`;
    }
    // DOCENTE o ADMIN: marcar en uso (solo approved)
    if ((role === "docente" || role === "administrador") && r.status === "approved") {
      acciones += `<button class="btn-info" onclick="openOccupyModal(${r.id})" title="Marcar en uso"><i class="fas fa-play"></i></button>`;
    }
    // DOCENTE o ADMIN: firma de salida (solo occupied)
    if ((role === "docente" || role === "administrador") && r.status === "occupied") {
      acciones += `<button class="btn-success" onclick="openRelease(${r.id})" title="Firma de salida"><i class="fas fa-sign-out-alt"></i></button>`;
    }
    // ADMIN: cancelar (pending/approved) + eliminar siempre (un solo botón de cada)
    if (role === "administrador") {
      if (r.status === "pending" || r.status === "approved") {
        acciones += `<button class="btn-danger" onclick="openCancel(${r.id})" title="Cancelar"><i class="fas fa-ban"></i></button>`;
      }
      acciones += `<button class="btn-danger" onclick="deleteReservation(${r.id})" title="Eliminar"><i class="fas fa-trash"></i></button>`;
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
  if (d.getDay() === 0) {
    showToast("No se permiten reservas los domingos", "error");
    input.value = "";
    return;
  }
  updateHourLimits(input.value);
  // Resetear horas al cambiar fecha para evitar valores inválidos previos
  document.getElementById("newHoraInicio").value = "";
  document.getElementById("newHoraFin").value    = "";
}

function validateHoraFin() {
  const ini = document.getElementById("newHoraInicio").value;
  const fin = document.getElementById("newHoraFin").value;
  if (!ini || !fin) return;
  const [hI, mI] = ini.split(":").map(Number);
  const [hF, mF] = fin.split(":").map(Number);
  if (hF * 60 + mF <= hI * 60 + mI) {
    showToast("La hora de fin debe ser mayor que la de inicio", "error");
    document.getElementById("newHoraFin").value = "";
  }
}

function updateHourLimits(fechaVal) {
  const role = currentUser?.role;
  const d    = fechaVal ? new Date(fechaVal + "T12:00:00") : null;
  const isSat = d ? d.getDay() === 6 : false;

  let openTime, closeTime;
  if (role === "docente" || role === "administrador") {
    openTime  = "07:29"; // min del input: 07:29 → acepta 07:30 en punto
    closeTime = isSat ? "13:00" : "17:00";
  } else {
    // alumno: min del input = 07:59 para que el browser acepte 08:00 en punto
    openTime  = "07:59";
    closeTime = isSat ? "13:00" : "15:00";
  }

  ["newHoraInicio", "newHoraFin"].forEach(fid => {
    const el = document.getElementById(fid);
    if (el) { el.min = openTime; el.max = closeTime; }
  });
}

function onLabChange() {
  const fechaVal = document.getElementById("newFecha").value;
  updateHourLimits(fechaVal);
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

/** Ajusta el máximo del input de cantidad según área/categoría */
function onConsRowChange(sel) {
  const opt   = sel.selectedOptions[0];
  const inp   = sel.closest("div").querySelector("input[type=number]");
  if (!opt?.value) { inp.max = 9999; return; }
  const unit  = (opt.dataset.unit  || "").toLowerCase();
  const area  = (opt.dataset.area  || "").toLowerCase();
  const cat   = (opt.dataset.cat   || "").toLowerCase();
  const stock = parseInt(opt.dataset.qty) || 9999;
  const isComputo = area === "sistemas" && (cat.includes("cómputo") || cat.includes("computo"));
  if (isComputo && (unit === "metros" || unit === "pieza")) {
    inp.max = Math.min(stock, 5);
    if (parseInt(inp.value) > inp.max) inp.value = inp.max;
  } else {
    inp.max = stock;
  }
}

/** Enforces limit on each keystroke */
function enforceConsLimit(inp) {
  const max = parseInt(inp.max);
  if (!isNaN(max) && parseInt(inp.value) > max) inp.value = max;
  if (parseInt(inp.value) < 1) inp.value = 1;
}

function addConsRow() {
  const id  = `cons_${++consRowCount}`;
  const row = document.createElement("div");
  row.className = "cons-row"; row.id = id;
  const opts = consumables
    .filter(c => c.quantity > 0)
    .map(c => {
      const area    = c.area === "sistemas" ? "🖥" : c.area === "laboratorio" ? "🔬" : "";
      const catName = (c.categories?.name || "").toLowerCase();
      return `<option value="${c.id}" data-qty="${c.quantity}" data-unit="${c.unit||"u"}" data-area="${c.area||""}" data-cat="${catName}">${area} ${c.name} (Disp: ${c.quantity} ${c.unit||"u"})</option>`;
    }).join("");
  row.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 80px 32px;gap:6px;align-items:center;margin-bottom:6px;">
      <select onchange="onConsRowChange(this)"
        style="padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:'Poppins',sans-serif;outline:none;color:#374151;">
        <option value="">-- Consumible --</option>${opts}
      </select>
      <input type="number" value="1" min="1" placeholder="Cant."
        style="padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:'Poppins',sans-serif;outline:none;text-align:center;"
        oninput="enforceConsLimit(this)">
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

  // ── Validaciones de horario ──
  const [hIni, mIni] = hora_inicio.split(":").map(Number);
  const [hFin, mFin] = hora_fin.split(":").map(Number);
  const totalIni = hIni * 60 + mIni;
  const totalFin = hFin * 60 + mFin;

  if (totalFin <= totalIni) {
    showToast("La hora de fin debe ser mayor que la de inicio (no puede cruzar medianoche)", "error"); return;
  }
  if (totalFin - totalIni < 60) {
    showToast("La reserva debe durar al menos 1 hora", "error"); return;
  }

  const fechaDay = new Date(fecha_uso + "T12:00:00").getDay();
  const isSat    = fechaDay === 6;
  const role     = currentUser?.role;

  let minOpen, maxClose;
  if (role === "docente" || role === "administrador") {
    minOpen  = 7 * 60 + 30; // 07:30
    maxClose = isSat ? 13 * 60 : 17 * 60; // 13:00 sáb / 17:00 rest
  } else {
    minOpen  = 8 * 60;      // 08:00
    maxClose = isSat ? 13 * 60 : 15 * 60; // 13:00 sáb / 15:00 rest
  }

  if (totalIni < minOpen) {
    const h = String(Math.floor(minOpen/60)).padStart(2,"0");
    const m = String(minOpen%60).padStart(2,"0");
    showToast(`Hora mínima de inicio: ${h}:${m}`, "error"); return;
  }
  if (totalFin > maxClose) {
    const h = String(Math.floor(maxClose/60)).padStart(2,"0");
    const m = String(maxClose%60).padStart(2,"0");
    showToast(`Hora máxima de fin: ${h}:${m}`, "error"); return;
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
  let consLimitError = null;
  document.querySelectorAll("#consContainer .cons-row").forEach(row => {
    const sel  = row.querySelector("select");
    const opt  = sel?.selectedOptions[0];
    const cid  = sel?.value;
    const qty  = parseInt(row.querySelector("input").value) || 1;
    if (!cid) return;
    // Validación límite Sistemas > Cómputo
    const unit = (opt?.dataset.unit || "").toLowerCase();
    const area = (opt?.dataset.area || "").toLowerCase();
    const cat  = (opt?.dataset.cat  || "").toLowerCase();
    const isComputo = area === "sistemas" && (cat.includes("cómputo") || cat.includes("computo"));
    if (isComputo) {
      if (unit === "metros" && qty > 5) { consLimitError = "Máximo 5 metros por consumible de Sistemas/Cómputo"; return; }
      if (unit === "pieza"  && qty > 5) { consLimitError = "Máximo 5 piezas por consumible de Sistemas/Cómputo"; return; }
    }
    consumablesArr.push({ consumable_id: parseInt(cid), quantity_requested: qty });
  });
  if (consLimitError) { showToast(consLimitError, "error"); return; }

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

// ── EDITAR RESERVA ──
function openEditReserva(id) {
  const r = allReservations.find(x => x.id === id);
  if (!r) return;

  // Reusar el modal de nueva reserva rellenando los campos
  openNewModal();

  // Después de que openNewModal limpia y configura, rellenamos los valores
  setTimeout(() => {
    // Lab
    const selLab = document.getElementById("newLab");
    if (selLab) {
      selLab.value = r.lab_id;
      selLab.dispatchEvent(new Event("change"));
    }
    // Fecha
    const inpFecha = document.getElementById("newFecha");
    if (inpFecha) {
      inpFecha.value = r.fecha_uso;
      inpFecha.dispatchEvent(new Event("change"));
      updateHourLimits(r.fecha_uso);
    }
    // Horas
    const inpIni = document.getElementById("newHoraInicio");
    const inpFin = document.getElementById("newHoraFin");
    if (inpIni) inpIni.value = r.hora_inicio?.substring(0,5) || "";
    if (inpFin) inpFin.value = r.hora_fin?.substring(0,5) || "";
    // Propósito
    const inpProp = document.getElementById("newProposito");
    if (inpProp) inpProp.value = r.proposito || "";

    // Cambiar el título y el botón del modal para indicar que es edición
    const modalTitle = document.querySelector("#newModal h3");
    if (modalTitle) modalTitle.innerHTML = `<i class="fas fa-edit" style="color:#4f46e5;margin-right:8px;"></i>Editar Reserva`;

    const saveBtn = document.querySelector("#newModal .btn[onclick='saveReservation()']");
    if (saveBtn) {
      saveBtn.setAttribute("onclick", `updateReservation(${id})`);
      saveBtn.innerHTML = `<i class="fas fa-save"></i> Guardar cambios`;
    }
  }, 50);
}

async function updateReservation(id) {
  const lab_id      = document.getElementById("newLab").value;
  const fecha_uso   = document.getElementById("newFecha").value;
  const hora_inicio = document.getElementById("newHoraInicio").value;
  const hora_fin    = document.getElementById("newHoraFin").value;
  const proposito   = document.getElementById("newProposito").value.trim();

  if (!lab_id || !fecha_uso || !hora_inicio || !hora_fin || !proposito) {
    showToast("Completa todos los campos obligatorios", "error"); return;
  }

  const [hIni, mIni] = hora_inicio.split(":").map(Number);
  const [hFin, mFin] = hora_fin.split(":").map(Number);
  const totalIni = hIni * 60 + mIni;
  const totalFin = hFin * 60 + mFin;

  if (totalFin <= totalIni) {
    showToast("La hora de fin debe ser mayor que la de inicio", "error"); return;
  }
  if (totalFin - totalIni < 60) {
    showToast("La reserva debe durar al menos 1 hora", "error"); return;
  }

  const res = await fetch(`${API}/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lab_id: parseInt(lab_id), fecha_uso, hora_inicio, hora_fin, proposito })
  });
  if (!res.ok) { const e = await res.json(); showToast(e.message || "Error al actualizar", "error"); return; }
  showToast("Reserva actualizada ✅", "success");
  closeModal("newModal");
  loadReservations();
}

// ── APROBAR ──
function openApprove(id) {
  const r = allReservations.find(x => x.id === id);
  document.getElementById("approveId").value = id;
  // Limpiar campos editables
  document.getElementById("approveGrupo").value    = r?.grupo    || "";
  document.getElementById("approveSemestre").value = r?.semestre || "";
  document.getElementById("approveMessage").value  = "";
  // Autocompletar encargado con el usuario actual (docente logueado)
  document.getElementById("approveEncargado").value = currentUser?.username || "";
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
function openOccupyModal(id) {
  const r = allReservations.find(x => x.id === id);
  if (!r) return;

  // Validar que hoy sea la fecha de la reserva y la hora actual esté dentro del rango
  const nowDate = today();
  if (r.fecha_uso !== nowDate) {
    showToast(`Solo puedes marcar en uso el día de la reserva (${formatDate(r.fecha_uso)})`, "error");
    return;
  }
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const [hI, mI] = (r.hora_inicio || "00:00").split(":").map(Number);
  const [hF, mF] = (r.hora_fin    || "23:59").split(":").map(Number);
  const inicioMin = hI * 60 + mI;
  const finMin    = hF * 60 + mF;
  // Permitir marcar en uso desde 10 min antes de hora_inicio hasta hora_fin
  if (nowMin < inicioMin - 10 || nowMin > finMin) {
    showToast(`Solo puedes marcar en uso entre ${r.hora_inicio} y ${r.hora_fin}`, "error");
    return;
  }

  let modal = document.getElementById("occupyModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "occupyModal"; modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-box" style="max-width:440px;">
        <button class="modal-close" onclick="document.getElementById('occupyModal').classList.remove('open')">&times;</button>
        <h3 style="display:flex;align-items:center;gap:10px;">
          <span style="background:#0891b2;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="fas fa-door-open" style="color:white;font-size:16px;"></i>
          </span>
          ¿Marcar laboratorio en uso?
        </h3>
        <input type="hidden" id="occupyId">
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px;margin:16px 0;">
          <p id="occupyLabName" style="font-size:15px;font-weight:700;color:#0c4a6e;margin-bottom:6px;"></p>
          <p id="occupyDetails" style="font-size:13px;color:#6b7280;line-height:1.5;"></p>
        </div>
        <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px;margin-bottom:18px;display:flex;gap:10px;align-items:flex-start;">
          <i class="fas fa-exclamation-triangle" style="color:#ca8a04;margin-top:2px;flex-shrink:0;"></i>
          <p style="font-size:13px;color:#713f12;margin:0;">Al confirmar, el laboratorio quedará marcado como <strong>En uso</strong>. No podrá reservarse por otros hasta que se registre la salida.</p>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" onclick="document.getElementById('occupyModal').classList.remove('open')">
            <i class="fas fa-times" style="margin-right:6px;"></i>Cancelar
          </button>
          <button class="btn" style="flex:1;background:#0891b2;" onclick="confirmOccupy()">
            <i class="fas fa-door-open" style="margin-right:6px;"></i>Sí, marcar en uso
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });
  }
  document.getElementById("occupyId").value = id;
  document.getElementById("occupyLabName").textContent = r.lab ? `${r.lab.nombre} — ${r.lab.edificio}` : "Laboratorio";
  document.getElementById("occupyDetails").innerHTML =
    `<i class="fas fa-calendar-day" style="color:#0891b2;width:16px;"></i> ${r.fecha_uso ? formatDate(r.fecha_uso) : ""}
     &nbsp;·&nbsp;
     <i class="fas fa-clock" style="color:#0891b2;width:16px;"></i> ${r.hora_inicio || ""} – ${r.hora_fin || ""}
     <br><i class="fas fa-chalkboard-teacher" style="color:#0891b2;width:16px;"></i> Docente: <strong>${r.docente?.username || "—"}</strong>`;
  modal.classList.add("open");
}

async function confirmOccupy() {
  const id = document.getElementById("occupyId").value;
  await fetch(`${API}/${id}/occupy`, { method: "PUT" });
  showToast("Laboratorio marcado como en uso", "info");
  document.getElementById("occupyModal").classList.remove("open");
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
      const delivered = c.quantity_delivered ?? c.quantity_requested;
      listEl.innerHTML += `
        <div class="leftover-row" data-rc-id="${c.id}" data-delivered="${delivered}">
          <div>
            <span class="item-name">${c.consumables?.name || "Consumible"}</span>
            <small style="color:#6b7280;display:block;">Entregado: ${delivered} ${c.consumables?.unit||""}</small>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:11px;color:#6b7280;">Sobrante</label>
            <input type="number" min="0" max="${delivered}" value="${delivered}"
              style="width:80px;padding:5px;border:1px solid #d1d5db;border-radius:4px;font-size:13px;">
            <label style="font-size:11px;color:#dc2626;">Dañados</label>
            <input type="number" min="0" max="${delivered}" value="0" class="damaged-input"
              style="width:80px;padding:5px;border:1px solid #fecaca;border-radius:4px;font-size:13px;">
          </div>
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
  let valid = true;

  document.querySelectorAll("#leftoverList .leftover-row").forEach(row => {
    const delivered = parseInt(row.dataset.delivered) || 0;
    const leftover  = parseInt(row.querySelector("input:not(.damaged-input)").value) || 0;
    const damaged   = parseInt(row.querySelector(".damaged-input").value) || 0;

    if (leftover + damaged > delivered) {
      showToast("Sobrante + dañados no puede superar la cantidad entregada", "error");
      valid = false; return;
    }
    leftover_items.push({
      reservation_consumable_id: parseInt(row.dataset.rcId),
      leftover_qty: leftover,
      damaged_qty:  damaged
    });
  });

  if (!valid) return;

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

// ── RECHAZAR RESERVA (docente: pending → cancelled con motivo + hora) ──
function openRejectReserva(id) {
  const r = allReservations.find(x => x.id === id);
  let modal = document.getElementById("rejectReservaModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "rejectReservaModal"; modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-box" style="max-width:460px;">
        <button class="modal-close" onclick="document.getElementById('rejectReservaModal').classList.remove('open')">&times;</button>
        <h3><i class="fas fa-times-circle" style="color:#dc2626;margin-right:8px;"></i>Rechazar Reserva</h3>
        <input type="hidden" id="rejectReservaId">
        <div id="rejectReservaInfo" style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;color:#374151;"></div>
        <div class="form-group">
          <label>Motivo del rechazo *</label>
          <textarea id="rejectReservaReason" placeholder="Explica por qué se rechaza esta reserva..." style="height:80px;resize:none;width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;font-family:'Poppins',sans-serif;outline:none;transition:0.2s;"></textarea>
        </div>
        <div style="background:#f8f9fc;border-radius:6px;padding:10px;margin-bottom:12px;font-size:12px;color:#6b7280;">
          <i class="fas fa-clock" style="color:#4f46e5;margin-right:6px;"></i>
          Se registrará la hora del rechazo: <strong id="rejectReservaHora"></strong>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" onclick="document.getElementById('rejectReservaModal').classList.remove('open')">Cancelar</button>
          <button class="btn" style="flex:1;background:#dc2626;" onclick="submitRejectReserva()"><i class="fas fa-times"></i> Rechazar reserva</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });
  }
  document.getElementById("rejectReservaId").value = id;
  document.getElementById("rejectReservaReason").value = "";
  document.getElementById("rejectReservaHora").textContent = new Date().toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
  if (r) {
    document.getElementById("rejectReservaInfo").innerHTML =
      `<strong>${r.lab?.nombre || "Lab"}</strong> · ${r.fecha_uso ? formatDate(r.fecha_uso) : ""} · ${r.hora_inicio || ""} – ${r.hora_fin || ""}<br>
       <span style="color:#9ca3af;">Solicitante: ${r.alumno?.username || "—"}</span>`;
  }
  // Actualizar hora en tiempo real
  modal.querySelector("#rejectReservaHora").textContent = new Date().toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
  modal.classList.add("open");
}

async function submitRejectReserva() {
  const id     = document.getElementById("rejectReservaId").value;
  const reason = document.getElementById("rejectReservaReason").value.trim();
  if (!reason) { showToast("El motivo del rechazo es obligatorio", "error"); return; }
  const rejectedAt = new Date().toISOString();
  const res = await fetch(`${API}/${id}/cancel`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ docente_message: reason, rejected_at: rejectedAt })
  });
  if (!res.ok) { showToast("Error al rechazar la reserva", "error"); return; }
  showToast("Reserva rechazada", "info");
  document.getElementById("rejectReservaModal").classList.remove("open");
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